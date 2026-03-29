import { state, initResourceSettings, getResourceSettings, setResourceSettings } from './state.js';
import { RESOURCE_TYPES, RESOURCE_CATEGORIES, DEFAULT_CENTER, DEFAULT_RESOURCE_RADII } from './config.js';
import { log, setStatus, delay } from './utils.js';
import { initMap, getMap, getResourceLayer } from './map.js';
import { findPublicParcels, sortParcels } from './api/parcels.js';
import { findResourcesByType, findResourcesSequentially } from './api/resources.js';
import { bestAvailable } from '../providers.js';

import { 
  buildFilterGrid, 
  buildResourceCategoryFilters, 
  selectAllFilters, 
  selectNoFilters, 
  selectRecommended,
  getCheckedTypesInCategory,
  getAllTypesInCategory,
  checkAllInCategory,
  updateResourceStatus,
  getRadiusForType
} from './ui/filters.js';
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
  openPanel('parcels');

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

async function loadResourceType(type) {
  const map = getMap();
  const center = state.searchCenter || { lat: map.getCenter().lat, lon: map.getCenter().lng };
  const radius = getRadiusForType(type);
  
  setStatus(`⏳ Loading ${RESOURCE_TYPES[type]?.label || type}...`);
  log(`Resources: loading ${type} (${radius}mi)`, 'info');
  
  try {
    const resources = await findResourcesByType(type, center.lat, center.lon, radius);
    
    if (!state.loadedResources[type]) {
      state.loadedResources[type] = [];
    }
    state.loadedResources[type] = resources;
    
    const markers = createResourceMarkers(resources);
    state.resourceMarkers[type] = markers;
    
    const settings = getResourceSettings(type);
    if (settings.enabled) {
      markers.forEach(m => m.addTo(getResourceLayer()));
    }
    
    updateResourceStatus(type, resources.length);
    setStatus(`✅ ${resources.length} ${RESOURCE_TYPES[type]?.label || type}`);
    log(`Resources: found ${resources.length} ${type}`, 'success');
    
    return resources;
  } catch (e) {
    setStatus('❌ ' + e.message);
    log(`Resources: ${e.message}`, 'error');
    return [];
  }
}

async function loadResourcesSequential(types) {
  const map = getMap();
  const center = state.searchCenter || { lat: map.getCenter().lat, lon: map.getCenter().lng };
  
  let totalLoaded = 0;
  
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const radius = getRadiusForType(type);
    
    setStatus(`⏳ ${i + 1}/${types.length}: ${RESOURCE_TYPES[type]?.label || type}...`);
    
    try {
      const resources = await findResourcesByType(type, center.lat, center.lon, radius);
      
      if (!state.loadedResources[type]) {
        state.loadedResources[type] = [];
      }
      state.loadedResources[type] = resources;
      
      const markers = createResourceMarkers(resources);
      state.resourceMarkers[type] = markers;
      
      const settings = getResourceSettings(type);
      if (settings.enabled) {
        markers.forEach(m => m.addTo(getResourceLayer()));
      }
      
      updateResourceStatus(type, resources.length);
      totalLoaded += resources.length;
      
      if (i < types.length - 1) {
        await delay(500);
      }
    } catch (e) {
      log(`Resources: ${type} failed - ${e.message}`, 'warn');
    }
  }
  
  setStatus(`✅ ${totalLoaded} resources loaded`);
  return totalLoaded;
}

function createResourceMarkers(resources) {
  const layer = getResourceLayer();
  return resources.map(r => {
    const marker = L.circleMarker([r.lat, r.lon], {
      radius: 6,
      fillColor: r.type === 'water' ? '#58a6ff' : 
                 r.type === 'shelter' ? '#f85149' :
                 r.type === 'food_bank' ? '#f97316' : '#3fb950',
      fillOpacity: 0.9,
      color: '#fff',
      weight: 1
    });
    
    marker.bindPopup(`
      <b>${r.icon} ${r.name}</b><br>
      <span style="color:#8b949e">${r.type_label}</span><br>
      ${r.address ? `<span style="font-size:0.85rem">${r.address}</span><br>` : ''}
      ${r.dist_miles ? `<span style="font-size:0.8rem;color:#58a6ff">${r.dist_miles.toFixed(2)} mi</span>` : ''}
    `);
    
    return marker;
  });
}

function clearResourceMarkers(types) {
  const layer = getResourceLayer();
  types.forEach(type => {
    const markers = state.resourceMarkers[type];
    if (markers) {
      markers.forEach(m => layer.removeLayer(m));
      state.resourceMarkers[type] = [];
      state.loadedResources[type] = [];
      updateResourceStatus(type, 0);
    }
  });
}

function clearAllResourceMarkers() {
  const layer = getResourceLayer();
  for (const [type, markers] of Object.entries(state.resourceMarkers)) {
    markers.forEach(m => layer.removeLayer(m));
  }
  state.resourceMarkers = {};
  state.loadedResources = {};
  
  for (const type of Object.keys(RESOURCE_TYPES)) {
    updateResourceStatus(type, 0);
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
  document.getElementById('inspectorBtn')?.addEventListener('click', toggleInspectorMode);
  document.getElementById('askBtn')?.addEventListener('click', () => { openPanel('ask'); document.getElementById('panel')?.classList.add('open'); });
  document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  
  document.getElementById('resBtn')?.addEventListener('click', () => {
    document.getElementById('panel')?.classList.add('open');
    openPanel('resources');
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
  
  document.getElementById('selectAllClasses')?.addEventListener('click', selectAllFilters);
  document.getElementById('selectNoClasses')?.addEventListener('click', selectNoFilters);
  document.getElementById('selectRecommended')?.addEventListener('click', selectRecommended);
  
  document.getElementById('resourceCategories')?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const cat = btn.dataset.category;
    
    if (btn.classList.contains('resource-load')) {
      const type = btn.dataset.type;
      loadResourceType(type);
    }
    else if (btn.classList.contains('cat-load-selected')) {
      const types = getCheckedTypesInCategory(cat);
      if (types.length > 0) loadResourcesSequential(types);
    }
    else if (btn.classList.contains('cat-clear-selected')) {
      const types = getCheckedTypesInCategory(cat);
      clearResourceMarkers(types);
    }
    else if (btn.classList.contains('cat-load-all')) {
      checkAllInCategory(cat, true);
      const types = getAllTypesInCategory(cat);
      loadResourcesSequential(types);
    }
    else if (btn.classList.contains('cat-clear-all')) {
      const types = getAllTypesInCategory(cat);
      clearResourceMarkers(types);
      checkAllInCategory(cat, false);
    }
  });
  
  document.getElementById('loadAllResources')?.addEventListener('click', () => {
    const allChecked = [];
    for (const type of Object.keys(RESOURCE_TYPES)) {
      const settings = getResourceSettings(type);
      if (settings.enabled) allChecked.push(type);
    }
    if (allChecked.length > 0) {
      loadResourcesSequential(allChecked);
    } else {
      setStatus('⚠️ No types selected');
    }
  });
  
  document.getElementById('clearAllResources')?.addEventListener('click', clearAllResourceMarkers);
  
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
    
    initResourceSettings(RESOURCE_TYPES, DEFAULT_RESOURCE_RADII);
    
    state.resourceMarkers = {};
    state.loadedResources = {};
    
    buildFilterGrid();
    buildResourceCategoryFilters();
    
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
