import { state } from './state.js';
import { RESOURCE_TYPES, DEFAULT_CENTER } from './config.js';
import { log, setStatus, $ } from './utils.js';
import { initMap, getMap } from './map.js';
import { findPublicParcels, sortParcels } from './api/parcels.js';
import { findNearbyResources } from './api/resources.js';
import { bestAvailable } from '../providers.js';

import { buildFilterGrid, buildResourceFilterGrid, selectAllFilters, selectNoFilters, selectRecommended, selectAllResFilters, selectNoResFilters } from './ui/filters.js';
import { openPanel, togglePanel, toggleLegend } from './ui/panels.js';
import { displayParcels, displayResources, selectParcel } from './ui/cards.js';
import { toggleInspectorMode, handleInspectorClick } from './ui/inspector.js';
import { initSettings, applyDisplaySettings, saveSettings, openSettings, closeSettings } from './ui/settings.js';
import { initContextMenu } from './ui/context-menu.js';

window.onerror = (msg, src, line) => { alert(`Error L${line}: ${msg}`); return false; };
window.addEventListener('unhandledrejection', e => alert('Async error: ' + (e.reason?.message || e.reason)));

async function searchParcels() {
  setStatus('⏳ Searching...');
  document.getElementById('panel')?.classList.add('open');

  const radius = parseFloat(document.getElementById('radiusSlider')?.value || 0.5);
  const sortBy = document.getElementById('sortSel')?.value || 'risk';

  let center;
  if (state.searchCenter) {
    center = state.searchCenter;
  } else if (state.gpsLat) {
    center = { lat: state.gpsLat, lon: state.gpsLon };
  } else {
    const map = getMap();
    center = { lat: map.getCenter().lat, lon: map.getCenter().lng };
  }

  log(`Search: ${radius}mi from ${center.lat.toFixed(4)},${center.lon.toFixed(4)}`, 'info');

  try {
    let parcels = await findPublicParcels({
      lat: center.lat,
      lon: center.lon,
      radiusMiles: radius,
      classFilter: state.enabledClasses,
      includeGeometry: true,
      gpsLat: state.gpsLat,
      gpsLon: state.gpsLon
    });

    parcels = sortParcels(parcels, sortBy, state.gpsLat, state.gpsLon);
    displayParcels(parcels);
    setStatus(`✅ ${parcels.length} parcels`);
    log(`Search: found ${parcels.length} parcels`, 'success');
  } catch (e) {
    setStatus('❌ ' + e.message);
    log(`Search: ${e.message}`, 'error');
  }
}

async function searchResources() {
  setStatus('🔍 Loading resources...');
  document.getElementById('panel')?.classList.add('open');
  openPanel('resources');

  log('Resources: loading...', 'info');

  try {
    const map = getMap();
    const center = state.searchCenter || { lat: map.getCenter().lat, lon: map.getCenter().lng };
    const resources = await findNearbyResources({
      lat: center.lat,
      lon: center.lon,
      radiusMeters: 1500,
      types: state.enabledResourceTypes
    });
    displayResources(resources);
    setStatus(`✅ ${resources.length} resources`);
    log(`Resources: found ${resources.length}`, 'success');
  } catch (e) {
    setStatus('❌ ' + e.message);
    log(`Resources: ${e.message}`, 'error');
  }
}

async function ask(question) {
  const out = document.getElementById('llm-output');
  out.innerHTML = '<span class="thinking">⏳ Thinking...</span>';
  log(`AI: asking "${question.slice(0, 30)}..."`, 'info');

  const map = getMap();

  try {
    const [parcels, resources] = await Promise.all([
      findPublicParcels({ bounds: map.getBounds(), classFilter: state.enabledClasses, gpsLat: state.gpsLat, gpsLon: state.gpsLon }),
      findNearbyResources({ lat: map.getCenter().lat, lon: map.getCenter().lng, radiusMeters: 1500 })
    ]);

    const llm = bestAvailable();
    if (!llm) {
      out.innerHTML = '<span style="color:#f85149">No AI configured. Tap ⚙️</span>';
      log('AI: no provider configured', 'warn');
      return;
    }

    const ctx = {
      location: { lat: state.curLat, lon: state.curLon, gps: state.gpsLat ? `${state.gpsLat.toFixed(4)}, ${state.gpsLon.toFixed(4)}` : 'map center' },
      parcels: parcels.slice(0, 10).map(p => ({ address: p.address, class: p.class_label, risk: p.risk, dist: p.dist_label })),
      resources: resources.slice(0, 10).map(r => ({ type: r.type_label, name: r.name, dist: r.dist_miles?.toFixed(2) + ' mi' }))
    };

    const sys = `You are Sprawlmap, a humanitarian field assistant for Columbus OH. Help find safe public land and resources.

RISK: LOW(640/605)=City/Land Bank safest. MED=Other public. AVOID(650)=Schools - active enforcement.
Prioritize LOW risk. Be specific with addresses. Be brief and practical.`;

    const reply = await llm.chat([{ role: 'user', content: `Data:\n${JSON.stringify(ctx)}\n\n${question}` }], sys);
    out.innerHTML = `<div class="answer">${reply}</div>`;
    log('AI: got response', 'success');
  } catch (e) {
    out.innerHTML = `<span style="color:#f85149">Error: ${e.message}</span>`;
    log(`AI: ${e.message}`, 'error');
  }
}

function getLocation() {
  setStatus('📡 Getting GPS...');
  log('GPS: requesting location...', 'info');
  
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.curLat = pos.coords.latitude;
      state.curLon = pos.coords.longitude;
      state.gpsLat = state.curLat;
      state.gpsLon = state.curLon;
      
      const map = getMap();
      map.setView([state.curLat, state.curLon], 15);
      
      if (state.userMarker) state.userMarker.remove();
      state.userMarker = L.circleMarker([state.curLat, state.curLon], {
        radius: 8, fillColor: '#58a6ff', fillOpacity: 1, color: '#fff', weight: 2
      }).addTo(map).bindPopup('📍 You').openPopup();
      
      setStatus('✅ GPS locked. Tap Search.');
      log(`GPS: locked ${state.curLat.toFixed(4)}, ${state.curLon.toFixed(4)}`, 'success');
    },
    err => {
      setStatus('❌ GPS unavailable');
      log(`GPS: failed (code ${err.code}) - ${err.message}`, 'error');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function wireEvents() {
  document.getElementById('locBtn')?.addEventListener('click', getLocation);
  document.getElementById('searchBtn')?.addEventListener('click', searchParcels);
  document.getElementById('applySearch')?.addEventListener('click', searchParcels);
  document.getElementById('resBtn')?.addEventListener('click', searchResources);
  document.getElementById('inspectorBtn')?.addEventListener('click', toggleInspectorMode);
  document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  
  document.getElementById('filterBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('filters-panel');
    panel?.classList.toggle('open');
  });
  
  document.getElementById('handle')?.addEventListener('click', togglePanel);
  
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => openPanel(t.dataset.tab));
  });
  
  document.getElementById('legend-header')?.addEventListener('click', toggleLegend);
  
  document.getElementById('sendQ')?.addEventListener('click', () => {
    const q = document.getElementById('q')?.value?.trim();
    if (q) ask(q);
  });
  
  document.getElementById('q')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('sendQ')?.click();
    }
  });
  
  document.getElementById('radiusSlider')?.addEventListener('input', e => {
    const val = document.getElementById('radiusVal');
    if (val) val.textContent = e.target.value + ' mi';
  });
  
  document.querySelectorAll('.filter-actions .btn').forEach(btn => {
    const text = btn.textContent.trim();
    if (text === 'All') btn.addEventListener('click', selectAllFilters);
    else if (text === 'None') btn.addEventListener('click', selectNoFilters);
    else if (text === 'Recommended') btn.addEventListener('click', selectRecommended);
  });
  
  document.querySelectorAll('#tab-resources .filter-actions .btn, #filters-panel .filter-actions:last-child .btn').forEach(btn => {
    const text = btn.textContent.trim();
    if (text === 'All') btn.addEventListener('click', selectAllResFilters);
    else if (text === 'None') btn.addEventListener('click', selectNoResFilters);
  });
  
  const map = getMap();
  if (map) {
    map.on('click', handleInspectorClick);
  }
}

function init() {
  try {
    initMap();
    initSettings();
    applyDisplaySettings();
    initContextMenu();
    
    state.enabledResourceTypes = Object.keys(RESOURCE_TYPES);
    
    buildFilterGrid();
    buildResourceFilterGrid();
    
    wireEvents();
    
    log('Sprawlmap initialized', 'success');
  } catch (e) {
    log('Init error: ' + e.message, 'error');
    alert('Initialization failed: ' + e.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
