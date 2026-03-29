import { state, getResourceSettings, setResourceSettings } from '../state.js';
import { CLASS_CODES, RESOURCE_TYPES, RESOURCE_CATEGORIES, RADIUS_OPTIONS } from '../config.js';
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

export function buildResourceCategoryFilters() {
  const container = document.getElementById('resourceCategories');
  if (!container) return;
  container.innerHTML = '';

  for (const [catKey, catInfo] of Object.entries(RESOURCE_CATEGORIES)) {
    const section = document.createElement('div');
    section.className = 'resource-category';
    section.dataset.category = catKey;

    const typesContainer = document.createElement('div');
    typesContainer.className = 'category-types';

    for (const type of catInfo.types) {
      const typeInfo = RESOURCE_TYPES[type];
      if (!typeInfo) continue;
      const settings = getResourceSettings(type);
      
      const row = document.createElement('div');
      row.className = 'resource-type-row';
      row.dataset.type = type;

      const radiusOptions = RADIUS_OPTIONS.map(r => 
        `<option value="${r}" ${settings.radius === r ? 'selected' : ''}>${r} mi</option>`
      ).join('');

      row.innerHTML = `
        <label class="resource-checkbox">
          <input type="checkbox" data-type="${type}" ${settings.enabled ? 'checked' : ''}>
          <span class="resource-icon">${typeInfo.icon}</span>
          <span class="resource-label">${typeInfo.label}</span>
        </label>
        <select class="resource-radius" data-type="${type}">${radiusOptions}</select>
        <button class="btn sm resource-load" data-type="${type}">Load</button>
        <span class="resource-status" data-type="${type}">${settings.loaded ? '✅ ' + settings.count : '—'}</span>
      `;

      typesContainer.appendChild(row);
    }

    section.innerHTML = `
      <div class="category-header">
        <span class="category-label">${catInfo.label}</span>
        <div class="category-actions">
          <button class="btn sm cat-load-selected" data-category="${catKey}">Load Selected</button>
          <button class="btn sm cat-clear-selected" data-category="${catKey}">Clear Selected</button>
          <button class="btn sm cat-load-all" data-category="${catKey}">Load All</button>
          <button class="btn sm cat-clear-all" data-category="${catKey}">Clear All</button>
        </div>
      </div>
    `;

    section.appendChild(typesContainer);
    container.appendChild(section);
  }

  wireResourceFilterEvents();
}

function wireResourceFilterEvents() {
  document.querySelectorAll('[data-type]').forEach(el => {
    const type = el.dataset.type;
    
    if (el.type === 'checkbox') {
      el.onchange = () => {
        setResourceSettings(type, { enabled: el.checked });
        updateResourceVisibility();
      };
    }
    
    if (el.classList.contains('resource-radius')) {
      el.onchange = () => {
        setResourceSettings(type, { radius: parseFloat(el.value) });
      };
    }
    
    if (el.classList.contains('resource-load')) {
      el.onclick = () => {
        el.dispatchEvent(new CustomEvent('loadResourceType', { detail: { type }, bubbles: true }));
      };
    }
  });
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
    const settings = getResourceSettings(type);
    markers.forEach(m => {
      if (settings.enabled) {
        if (!resourceLayer.hasLayer(m)) resourceLayer.addLayer(m);
      } else {
        resourceLayer.removeLayer(m);
      }
    });
  }
}

export function updateResourceStatus(type, count) {
  const status = document.querySelector(`.resource-status[data-type="${type}"]`);
  if (status) {
    status.textContent = `✅ ${count}`;
  }
  setResourceSettings(type, { loaded: true, count });
}

export function getCheckedTypesInCategory(categoryKey) {
  const cat = RESOURCE_CATEGORIES[categoryKey];
  if (!cat) return [];
  return cat.types.filter(type => {
    const cb = document.querySelector(`input[data-type="${type}"]`);
    return cb?.checked;
  });
}

export function getAllTypesInCategory(categoryKey) {
  return RESOURCE_CATEGORIES[categoryKey]?.types || [];
}

export function checkAllInCategory(categoryKey, checked) {
  const types = getAllTypesInCategory(categoryKey);
  types.forEach(type => {
    const cb = document.querySelector(`input[data-type="${type}"]`);
    if (cb) cb.checked = checked;
    setResourceSettings(type, { enabled: checked });
  });
  updateResourceVisibility();
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

export function getRadiusForType(type) {
  const settings = getResourceSettings(type);
  return settings.radius || 0.5;
}
