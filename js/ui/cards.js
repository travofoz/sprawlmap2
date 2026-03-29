import { state } from '../state.js';
import { riskText } from '../config.js';
import { getMap, getParcelLayerGroup, getResourceLayer } from '../map.js';
import { log } from '../utils.js';

export function displayParcels(parcels, searchParams = {}) {
  state.currentParcels = parcels;
  const parcelLayerGroup = getParcelLayerGroup();
  if (parcelLayerGroup) parcelLayerGroup.clearLayers();
  state.parcelPolygons = {};
  
  const el = document.getElementById('parcelResults');
  if (!el) return;

  if (!parcels.length) {
    el.innerHTML = `
      <div class="search-summary" style="margin-bottom:8px;padding:6px;background:#21262d;border-radius:4px;">
        <span style="color:#8b949e;font-size:0.75rem">No results for ${searchParams.radius || '?'} mi radius, ${searchParams.classCount || '?'} class codes</span>
      </div>
      <button class="btn sm" id="modifySearchBtn" style="width:100%">Modify Search Filters</button>
      <p style="color:#8b949e;font-size:0.8rem;margin-top:8px">Try expanding radius or selecting more class codes.</p>`;
    wireModifySearchBtn();
    return;
  }

  const counts = { low: 0, med: 0, avoid: 0, high: 0 };
  parcels.forEach(p => counts[p.risk] = (counts[p.risk] || 0) + 1);
  
  el.innerHTML = `
    <div class="search-summary" style="margin-bottom:8px;padding:6px;background:#21262d;border-radius:4px;">
      <span style="color:#8b949e;font-size:0.75rem">${searchParams.radius || '?'} mi radius · ${searchParams.classCount || '?'} class codes</span>
      <span style="color:#3fb950;font-size:0.75rem;margin-left:8px">${parcels.length} parcels — 🟢${counts.low} 🟡${counts.med} 🔴${counts.avoid + counts.high}</span>
    </div>
    <button class="btn sm" id="modifySearchBtn" style="width:100%;margin-bottom:8px">Modify Search Filters</button>
    <div id="parcelCards"></div>`;
  
  wireModifySearchBtn();
  
  const cardsContainer = document.getElementById('parcelCards');

  for (const p of parcels) {
    if (p.geometry && p.geometry.coordinates && p.geometry.coordinates[0]) {
      try {
        const coords = p.geometry.coordinates[0].map(c => [c[1], c[0]]);
        const polygon = L.polygon(coords, {
          color: p.class_color || '#6b7280',
          fillColor: p.class_color || '#6b7280',
          fillOpacity: 0.2,
          weight: 2
        });

        polygon.on('click', () => selectParcel(p.parcel_id));
        polygon.bindPopup(`<b>${p.address || 'No address'}</b><br>${p.class_label || 'Unknown'}<br><a href="${p.property_card}" target="_blank">Property Card</a>`);
        polygon.feature = { properties: { PARCELID: p.parcel_id } };

        if (!state.enabledClasses || state.enabledClasses.includes(p.classcd)) {
          polygon.addTo(parcelLayerGroup);
        }
        state.parcelPolygons[p.parcel_id] = polygon;
      } catch (e) { }
    }

    const card = document.createElement('div');
    card.className = `card ${p.risk}`;
    card.dataset.parcelId = p.parcel_id;
    card.onclick = () => selectParcel(p.parcel_id);

    const distHtml = p.dist_label ? `<span class="dist">${p.dist_label}</span> · ` : '';
    card.innerHTML = `
      <span class="badge ${p.risk}">${riskText(p.risk)}</span>
      <span style="font-size:0.65rem;color:${p.class_color || '#6b7280'}">${p.class_label || 'Unknown'}</span>
      <h3>${p.address || '(no address)'}</h3>
      <p>${distHtml}${p.acres?.toFixed(2) || '?'} ac · ${p.owner?.slice(0, 30) || 'Unknown'}</p>`;

    cardsContainer.appendChild(card);
  }
}

function wireModifySearchBtn() {
  const btn = document.getElementById('modifySearchBtn');
  if (btn) {
    btn.onclick = () => {
      const filters = document.querySelector('.parcel-filters');
      if (filters) {
        filters.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }
}

export function selectParcel(pid) {
  const map = getMap();
  const parcelLayerGroup = getParcelLayerGroup();
  
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
  if (state.selectedParcelId && state.parcelPolygons[state.selectedParcelId]) {
    state.parcelPolygons[state.selectedParcelId].setStyle({ weight: 2, fillOpacity: 0.2 });
  }

  state.selectedParcelId = pid;

  const card = document.querySelector(`[data-parcel-id="${pid}"]`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const polygon = state.parcelPolygons[pid];
  if (polygon && map) {
    polygon.setStyle({ weight: 4, fillOpacity: 0.4 });
    map.fitBounds(polygon.getBounds(), { maxZoom: 16 });
  }

  const panel = document.getElementById('panel');
  if (panel) panel.classList.add('open');
}

export function displayResources(resources) {
  const resourceLayer = getResourceLayer();
  if (resourceLayer) resourceLayer.clearLayers();
  state.resourceMarkers = {};
  
  const el = document.getElementById('tab-resources');
  if (!el) return;

  const filtered = state.enabledResourceTypes && state.enabledResourceTypes.length > 0
    ? resources.filter(r => state.enabledResourceTypes.includes(r.type))
    : resources;
    
  el.innerHTML = `<p style="color:#8b949e;font-size:0.7rem;margin-bottom:6px">${filtered.length} resources (of ${resources.length} total)</p>`;

  for (const r of filtered) {
    if (!r.lat) continue;

    const marker = L.marker([r.lat, r.lon], {
      icon: L.divIcon({
        html: `<span style="font-size:0.8rem;line-height:1">${r.icon || '📍'}</span>`,
        className: '',
        iconSize: [14, 14]
      })
    })
    .bindPopup(`<b>${r.icon || '📍'} ${r.type_label || r.type}</b><br>${r.name}${r.address ? `<br>${r.address}` : ''}`)
    .addTo(resourceLayer);

    if (!state.resourceMarkers[r.type]) state.resourceMarkers[r.type] = [];
    state.resourceMarkers[r.type].push(marker);

    const c = document.createElement('div');
    c.className = 'card med';
    c.innerHTML = `
      <h3>${r.icon || '📍'} ${r.type_label || r.type}</h3>
      <p><b>${r.name}</b><br>
      ${r.address || `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`}<br>
      <small>${r.dist_miles?.toFixed(2) || '?'} mi${r.source === 'hardcoded' ? ' ★' : ''}</small></p>`;
    el.appendChild(c);
  }
}
