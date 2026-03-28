import { state } from '../state.js';
import { CLASS_CODES, RESOURCE_TYPES } from '../config.js';
import { getParcelLayerGroup, getResourceLayer } from '../map.js';
import { log } from '../utils.js';

export function buildFilterGrid() {
  const grid = document.getElementById('filterGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (const [code, info] of Object.entries(CLASS_CODES)) {
    const checked = state.enabledClasses.includes(code) ? 'checked' : '';
    const row = document.createElement('label');
    row.className = `filter-row ${info.risk === 'avoid' ? 'avoid' : ''}`;
    row.innerHTML = `
      <input type="checkbox" data-class="${code}" ${checked}>
      <span class="color-dot" style="background:${info.color}"></span>
      <span>${info.label} (${code})</span>
    `;
    row.querySelector('input').onchange = e => {
      if (e.target.checked) {
        if (!state.enabledClasses.includes(code)) state.enabledClasses.push(code);
      } else {
        state.enabledClasses = state.enabledClasses.filter(c => c !== code);
      }
      updateMapVisibility();
    };
    grid.appendChild(row);
  }
}

export function buildResourceFilterGrid() {
  const grid = document.getElementById('resourceFilterGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  if (state.enabledResourceTypes.length === 0) {
    state.enabledResourceTypes = Object.keys(RESOURCE_TYPES);
  }
  
  for (const [type, info] of Object.entries(RESOURCE_TYPES)) {
    const checked = state.enabledResourceTypes.includes(type) ? 'checked' : '';
    const row = document.createElement('label');
    row.className = 'filter-row';
    row.innerHTML = `
      <input type="checkbox" data-resource="${type}" ${checked}>
      <span style="font-size:1rem">${info.icon}</span>
      <span>${info.label}</span>
    `;
    row.querySelector('input').onchange = e => {
      if (e.target.checked) {
        if (!state.enabledResourceTypes.includes(type)) state.enabledResourceTypes.push(type);
      } else {
        state.enabledResourceTypes = state.enabledResourceTypes.filter(t => t !== type);
      }
      updateResourceVisibility();
    };
    grid.appendChild(row);
  }
}

export function updateMapVisibility() {
  const parcelLayerGroup = getParcelLayerGroup();
  if (!parcelLayerGroup) return;
  
  for (const [pid, polygon] of Object.entries(state.parcelPolygons)) {
    const parcel = state.currentParcels.find(p => p.parcel_id === pid);
    if (parcel && state.enabledClasses.includes(parcel.classcd)) {
      if (!parcelLayerGroup.hasLayer(polygon)) {
        polygon.addTo(parcelLayerGroup);
      }
    } else {
      parcelLayerGroup.removeLayer(polygon);
    }
  }
}

export function updateResourceVisibility() {
  const resourceLayer = getResourceLayer();
  if (!resourceLayer) return;
  
  for (const [type, markers] of Object.entries(state.resourceMarkers)) {
    markers.forEach(m => {
      if (state.enabledResourceTypes.includes(type)) {
        if (!resourceLayer.hasLayer(m)) resourceLayer.addLayer(m);
      } else {
        resourceLayer.removeLayer(m);
      }
    });
  }
}

export function selectAllFilters() {
  state.enabledClasses = Object.keys(CLASS_CODES);
  document.querySelectorAll('[data-class]').forEach(cb => cb.checked = true);
  updateMapVisibility();
}

export function selectNoFilters() {
  state.enabledClasses = [];
  document.querySelectorAll('[data-class]').forEach(cb => cb.checked = false);
  updateMapVisibility();
}

export function selectRecommended() {
  state.enabledClasses = ['640', '605'];
  document.querySelectorAll('[data-class]').forEach(cb => {
    cb.checked = state.enabledClasses.includes(cb.dataset.class);
  });
  updateMapVisibility();
}

export function selectAllResFilters() {
  state.enabledResourceTypes = Object.keys(RESOURCE_TYPES);
  document.querySelectorAll('[data-resource]').forEach(cb => cb.checked = true);
  updateResourceVisibility();
}

export function selectNoResFilters() {
  state.enabledResourceTypes = [];
  document.querySelectorAll('[data-resource]').forEach(cb => cb.checked = false);
  updateResourceVisibility();
}
