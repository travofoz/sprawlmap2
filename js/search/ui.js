import * as manager from './manager.js';
import { PARCEL_CATEGORIES, RESOURCE_TYPES, RESOURCE_CATEGORIES, DEFAULT_RESOURCE_RADII } from './types.js';
import { setStatus } from '../../utils.js';
import { getMap, getParcelLayerGroup, getResourceLayer } from '../../map.js';
import { findPublicParcels, sortParcels } from '../../api/parcels.js';
import { findResourcesByType } from '../../api/resources.js';
import { state } from '../../state.js';
import { riskText, CLASS_CODES } from '../../config.js';

let panelEl = null;
let listEl = null;
let isPanelOpen = false;

export function init() {
  try {
    panelEl = document.getElementById('searchManagerPanel');
    listEl = document.getElementById('searchManagerList');
    
    if (!panelEl) {
      createPanelHTML();
      panelEl = document.getElementById('searchManagerPanel');
      listEl = document.getElementById('searchManagerList');
    }
    
    if (!panelEl || !listEl) {
      console.warn('Search Manager: panel elements not available');
      return;
    }
    
    wireEvents();
    
    manager.on('created', () => renderList());
    manager.on('updated', () => renderList());
    manager.on('deleted', () => renderList());
    manager.on('activated', () => renderList());
    manager.on('favorite', () => renderList());
    manager.on('lock', () => renderList());
    manager.on('cleared', () => renderList());
    manager.on('loaded', ({ searchId }) => updateSearchCard(searchId));
    manager.on('queue:added', updateQueueIndicator);
    manager.on('queue:processing', updateQueueIndicator);
    manager.on('queue:empty', updateQueueIndicator);
    
    renderList();
  } catch (e) {
    console.error('Search UI init failed:', e);
  }
}

function createPanelHTML() {
  try {
    const panel = document.createElement('div');
    panel.id = 'searchManagerPanel';
    panel.className = 'search-manager-panel';
    panel.innerHTML = `
      <div class="sm-header">
        <span class="sm-title">🔍 Search Manager</span>
        <button class="sm-close" id="smClose" title="Close">✕</button>
      </div>
      <div class="sm-actions">
        <button class="btn green sm" id="smNewSearch">+ New Search</button>
        <button class="btn sm" id="smClearAll">🗑 Clear All</button>
        <span class="sm-queue" id="smQueue"></span>
      </div>
      <div class="sm-list" id="searchManagerList"></div>
      <div class="sm-footer">
        <span class="sm-stats" id="smStats"></span>
      </div>
    `;
    document.body.appendChild(panel);
    panelEl = panel;
    listEl = document.getElementById('searchManagerList');
  } catch (e) {
    console.error('Failed to create search panel:', e);
  }
}

function wireEvents() {
  try {
    document.getElementById('smClose')?.addEventListener('click', closePanel);
    document.getElementById('smNewSearch')?.addEventListener('click', showNewSearchModal);
    document.getElementById('smClearAll')?.addEventListener('click', showClearAllConfirm);
    
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isPanelOpen) {
        if (document.querySelector('.sm-modal.show')) {
          closeAllModals();
        } else {
          closePanel();
        }
      }
    });
  } catch (e) {
    console.error('Error wiring search UI events:', e);
  }
}

export function openPanel() {
  if (!panelEl) init();
  panelEl.classList.add('open');
  isPanelOpen = true;
  renderList();
}

export function closePanel() {
  panelEl?.classList.remove('open');
  isPanelOpen = false;
}

export function togglePanel() {
  if (isPanelOpen) {
    closePanel();
  } else {
    openPanel();
  }
}

export function renderList() {
  if (!listEl) return;
  
  try {
    const searches = manager.getAllSearches();
    const activeId = manager.getActiveSearch()?.id;
    
    if (searches.length === 0) {
      listEl.innerHTML = `
        <div class="sm-empty">
          <p>No saved searches</p>
          <p style="font-size:0.8rem;color:#8b949e">Click "+ New Search" or right-click the map to create one</p>
        </div>
      `;
    } else {
      listEl.innerHTML = searches.map(search => renderSearchCard(search, search.id === activeId)).join('');
      wireSearchCardEvents();
    }
    
    updateStats();
  } catch (e) {
    console.error('Error rendering search list:', e);
  }
}

function renderSearchCard(search, isActive) {
  const expandedLevel = search.uiState?.expandedLevel || 0;
  const classes = [
    'sm-search-item',
    isActive ? 'active' : '',
    search.favorite ? 'favorite' : '',
    search.locked ? 'locked' : '',
    expandedLevel === 1 ? 'card' : '',
    expandedLevel === 2 ? 'expanded' : ''
  ].filter(Boolean).join(' ');
  
  const stale = getStaleBadge(search.updated);
  const parcelCount = search.parcels?.count || 0;
  const resourceCount = getResourceCount(search);
  
  if (expandedLevel === 0) {
    return `
      <div class="${classes}" data-search-id="${search.id}">
        <div class="sm-search-collapsed" data-action="expand">
          <span class="sm-fav-star ${search.favorite ? 'active' : ''}" data-action="favorite">⭐</span>
          <span class="sm-search-name">${escapeHtml(search.name || 'Unnamed')}</span>
          <span class="sm-search-summary">${parcelCount}p · ${resourceCount}r · ${formatRelativeTime(search.updated)}</span>
          <span class="sm-expand-icon">▼</span>
        </div>
      </div>
    `;
  }
  
  if (expandedLevel >= 1) {
    return `
      <div class="${classes}" data-search-id="${search.id}">
        <div class="sm-search-header">
          <span class="sm-fav-star ${search.favorite ? 'active' : ''}" data-action="favorite">⭐</span>
          <span class="sm-search-name" data-action="rename">${escapeHtml(search.name || 'Unnamed')}</span>
          <span class="sm-search-actions">
            <button class="sm-action-btn lock ${search.locked ? 'active' : ''}" data-action="lock" title="${search.locked ? 'Unlock' : 'Lock'}">${search.locked ? '🔒' : '🔓'}</button>
            <button class="sm-action-btn delete" data-action="delete" title="Delete" ${search.locked ? 'disabled' : ''}>🗑</button>
          </span>
          <span class="sm-expand-icon" data-action="${expandedLevel === 1 ? 'expand-full' : 'collapse'}">${expandedLevel === 1 ? '▼' : '▲'}</span>
        </div>
        <div class="sm-search-meta">
          <span class="sm-location">📍 ${search.location.label || `${search.location.lat.toFixed(4)}, ${search.location.lon.toFixed(4)}`}</span>
          <span class="sm-source">(${search.location.source})</span>
          <span class="sm-time">Updated ${formatRelativeTime(search.updated)} ${stale.badge}</span>
        </div>
        
        ${renderParcelSection(search, expandedLevel)}
        ${renderResourceSection(search, expandedLevel)}
        
        <div class="sm-search-footer">
          <button class="btn green sm" data-action="activate">📍 Activate on Map</button>
          <button class="btn sm" data-action="${expandedLevel === 2 ? 'collapse-card' : 'collapse'}">${expandedLevel === 2 ? '▲ Card' : '▲ Collapse'}</button>
          ${expandedLevel === 1 ? '<button class="btn sm" data-action="expand-full">▼▼ Full</button>' : ''}
        </div>
      </div>
    `;
  }
}

function renderParcelSection(search, expandedLevel) {
  const parcels = search.parcels || {};
  const categories = Object.values(PARCEL_CATEGORIES);
  
  const categoryHtml = categories.map(cat => {
    const codes = cat.classCodes;
    const enabledCodes = parcels.classCodes || [];
    const checked = codes.map(c => enabledCodes.includes(c) ? 'checked' : '').join(' ');
    const count = codes.length;
    const checkedCount = codes.filter(c => enabledCodes.includes(c)).length;
    
    if (expandedLevel === 1) {
      return `
        <div class="sm-type-row" data-category="${cat.key}">
          <label class="sm-type-label">
            <input type="checkbox" class="sm-cat-check" data-category="${cat.key}" ${checkedCount > 0 ? 'checked' : ''}>
            <span class="sm-cat-name ${cat.risk}">${cat.label}</span>
          </label>
          <span class="sm-type-count">${checkedCount}/${count}</span>
        </div>
      `;
    } else {
      return `
        <div class="sm-category-section" data-category="${cat.key}">
          <div class="sm-category-header">
            <label class="sm-type-label">
              <input type="checkbox" class="sm-cat-check" data-category="${cat.key}" ${checkedCount > 0 ? 'checked' : ''}>
              <span class="sm-cat-name ${cat.risk}">${cat.label}</span>
              <span class="sm-cat-risk">${getRiskLabel(cat.risk)}</span>
            </label>
          </div>
          <div class="sm-category-codes">
            ${codes.map(code => {
              const info = CLASS_CODES[code] || {};
              return `
                <label class="sm-code-label">
                  <input type="checkbox" class="sm-code-check" data-code="${code}" ${enabledCodes.includes(code) ? 'checked' : ''}>
                  <span style="color:${info.color || '#8b949e'}">${code}</span>
                  <span class="sm-code-label-text">${info.label || ''}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  }).join('');
  
  return `
    <div class="sm-section parcels">
      <div class="sm-section-header">
        <label class="sm-section-check">
          <input type="checkbox" class="sm-section-toggle" data-section="parcels" ${parcels.enabled ? 'checked' : ''}>
          <span>🏛️ PARCELS</span>
          <span class="sm-section-count">${parcels.count || 0}</span>
        </label>
        <div class="sm-section-radius">
          <input type="range" class="sm-radius-slider" data-section="parcels" min="0.25" max="5" step="0.25" value="${parcels.radius || 0.5}">
          <span class="sm-radius-val">${parcels.radius || 0.5} mi</span>
        </div>
        <button class="btn sm sm-load" data-action="load-parcels" data-search-id="${search.id}">Load</button>
      </div>
      <div class="sm-section-content">
        ${categoryHtml}
      </div>
    </div>
  `;
}

function renderResourceSection(search, expandedLevel) {
  const resources = search.resources || {};
  const categories = Object.entries(RESOURCE_CATEGORIES);
  
  const categoryHtml = categories.map(([catKey, cat]) => {
    const types = cat.types;
    const typeConfigs = types.map(t => ({
      type: t,
      config: resources.types?.[t] || { enabled: false, radius: DEFAULT_RESOURCE_RADII[t] || 0.5, count: 0 }
    }));
    
    const loadedCount = typeConfigs.filter(t => t.config.count > 0).length;
    const enabledCount = typeConfigs.filter(t => t.config.enabled).length;
    
    if (expandedLevel === 1) {
      return `
        <div class="sm-type-row sm-cat-row" data-resource-category="${catKey}">
          <span class="sm-cat-expand" data-action="toggle-cat" data-category="${catKey}">▶</span>
          <span class="sm-cat-label">${cat.label}</span>
          <span class="sm-type-count">${enabledCount}/${types.length} enabled, ${loadedCount} loaded</span>
          <button class="btn sm sm-load" data-action="load-category" data-category="${catKey}">Load All</button>
        </div>
      `;
    } else {
      const typeRows = typeConfigs.map(({ type, config }) => {
        const info = RESOURCE_TYPES[type] || {};
        return `
          <div class="sm-type-row" data-type="${type}">
            <label class="sm-type-label">
              <input type="checkbox" class="sm-type-check" data-type="${type}" ${config.enabled ? 'checked' : ''}>
              <span class="sm-type-icon">${info.icon || '📍'}</span>
              <span class="sm-type-name">${info.label || type}</span>
            </label>
            <div class="sm-type-radius">
              <input type="range" class="sm-radius-slider" data-type="${type}" min="0.25" max="5" step="0.25" value="${config.radius || 0.5}">
              <span class="sm-radius-val">${config.radius || 0.5} mi</span>
            </div>
            <span class="sm-type-count">${config.count || 0}</span>
            <button class="btn sm sm-load" data-action="load-type" data-type="${type}">Load</button>
          </div>
        `;
      }).join('');
      
      return `
        <div class="sm-category-section sm-resource-cat" data-resource-category="${catKey}">
          <div class="sm-category-header">
            <span class="sm-cat-expand" data-action="toggle-cat" data-category="${catKey}">▼</span>
            <span class="sm-cat-label">${cat.label}</span>
            <span class="sm-type-count">${enabledCount}/${types.length} enabled</span>
            <button class="btn sm sm-load" data-action="load-category" data-category="${catKey}">Load All</button>
          </div>
          <div class="sm-category-types">
            ${typeRows}
          </div>
        </div>
      `;
    }
  }).join('');
  
  return `
    <div class="sm-section resources">
      <div class="sm-section-header">
        <label class="sm-section-check">
          <input type="checkbox" class="sm-section-toggle" data-section="resources" ${resources.enabled ? 'checked' : ''}>
          <span>💡 RESOURCES</span>
          <span class="sm-section-count">${getResourceCount(search)}</span>
        </label>
      </div>
      <div class="sm-section-content">
        ${categoryHtml}
      </div>
    </div>
  `;
}

function wireSearchCardEvents() {
  listEl?.addEventListener('click', handleListClick);
  listEl?.addEventListener('change', handleListChange);
  listEl?.addEventListener('input', handleListInput);
  listEl?.addEventListener('dblclick', handleListDblClick);
}

function handleListClick(e) {
  const target = e.target;
  const actionEl = target.closest('[data-action]');
  if (!actionEl) return;
  
  const action = actionEl.dataset.action;
  const searchEl = actionEl.closest('[data-search-id]');
  const searchId = searchEl?.dataset.searchId;
  
  switch (action) {
    case 'expand':
      if (searchId) {
        const search = manager.getSearch(searchId);
        if (search) {
          manager.updateSearch(searchId, { uiState: { ...search.uiState, expandedLevel: 1 } });
          renderList();
        }
      }
      break;
    
    case 'expand-full':
      if (searchId) {
        const search = manager.getSearch(searchId);
        if (search) {
          manager.updateSearch(searchId, { uiState: { ...search.uiState, expandedLevel: 2 } });
          renderList();
        }
      }
      break;
    
    case 'collapse':
    case 'collapse-card':
      if (searchId) {
        const search = manager.getSearch(searchId);
        const newLevel = action === 'collapse-card' ? 2 : 0;
        if (search) {
          manager.updateSearch(searchId, { uiState: { ...search.uiState, expandedLevel: newLevel } });
          renderList();
        }
      }
      break;
    
    case 'favorite':
      if (searchId) {
        manager.toggleFavorite(searchId);
      }
      e.stopPropagation();
      break;
    
    case 'lock':
      if (searchId) {
        manager.toggleLock(searchId);
      }
      break;
    
    case 'delete':
      if (searchId) {
        showDeleteConfirm(searchId);
      }
      break;
    
    case 'activate':
      if (searchId) {
        activateSearch(searchId);
      }
      break;
    
    case 'load-parcels':
      if (searchId) {
        loadParcels(searchId);
      }
      break;
    
    case 'load-type':
      const type = actionEl.dataset.type;
      if (searchId && type) {
        loadResourceType(searchId, type);
      }
      break;
    
    case 'load-category':
      const category = actionEl.dataset.category;
      if (searchId && category) {
        loadResourceCategory(searchId, category);
      }
      break;
  }
}

function handleListChange(e) {
  const target = e.target;
  const searchEl = target.closest('[data-search-id]');
  if (!searchEl) return;
  
  const searchId = searchEl.dataset.searchId;
  const search = manager.getSearch(searchId);
  if (!search || search.locked) return;
  
  if (target.classList.contains('sm-section-toggle')) {
    const section = target.dataset.section;
    if (section === 'parcels') {
      search.parcels.enabled = target.checked;
    } else if (section === 'resources') {
      search.resources.enabled = target.checked;
    }
    manager.updateSearch(searchId, { [section]: search[section] });
  }
  
  if (target.classList.contains('sm-cat-check')) {
    const catKey = target.dataset.category;
    const cat = PARCEL_CATEGORIES[catKey];
    if (cat) {
      const classCodes = search.parcels.classCodes || [];
      const catCodes = cat.classCodes;
      if (target.checked) {
        const newCodes = [...new Set([...classCodes, ...catCodes])];
        search.parcels.classCodes = newCodes;
      } else {
        search.parcels.classCodes = classCodes.filter(c => !catCodes.includes(c));
      }
      manager.updateSearch(searchId, { parcels: search.parcels });
    }
  }
  
  if (target.classList.contains('sm-code-check')) {
    const code = target.dataset.code;
    const classCodes = search.parcels.classCodes || [];
    if (target.checked) {
      if (!classCodes.includes(code)) {
        classCodes.push(code);
      }
    } else {
      const idx = classCodes.indexOf(code);
      if (idx >= 0) classCodes.splice(idx, 1);
    }
    manager.updateSearch(searchId, { parcels: search.parcels });
  }
  
  if (target.classList.contains('sm-type-check')) {
    const type = target.dataset.type;
    if (!search.resources.types[type]) {
      search.resources.types[type] = { enabled: false, radius: 0.5, count: 0 };
    }
    search.resources.types[type].enabled = target.checked;
    manager.updateSearch(searchId, { resources: search.resources });
  }
}

function handleListInput(e) {
  const target = e.target;
  if (!target.classList.contains('sm-radius-slider')) return;
  
  const searchEl = target.closest('[data-search-id]');
  if (!searchEl) return;
  
  const searchId = searchEl.dataset.searchId;
  const search = manager.getSearch(searchId);
  if (!search || search.locked) return;
  
  const valEl = target.parentElement.querySelector('.sm-radius-val');
  if (valEl) valEl.textContent = target.value + ' mi';
  
  const section = target.dataset.section;
  const type = target.dataset.type;
  
  if (section === 'parcels') {
    search.parcels.radius = parseFloat(target.value);
  } else if (type) {
    if (!search.resources.types[type]) {
      search.resources.types[type] = { enabled: false, radius: 0.5, count: 0 };
    }
    search.resources.types[type].radius = parseFloat(target.value);
  }
  
  target.addEventListener('change', () => {
    manager.updateSearch(searchId, { [section || 'resources']: search[section || 'resources'] });
  }, { once: true });
}

function handleListDblClick(e) {
  const target = e.target;
  if (!target.dataset.action === 'rename') return;
  
  const searchEl = target.closest('[data-search-id]');
  if (!searchEl) return;
  
  const searchId = searchEl.dataset.searchId;
  const search = manager.getSearch(searchId);
  if (!search || search.locked) return;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = search.name || '';
  input.className = 'sm-name-input';
  
  const originalText = target.textContent;
  target.textContent = '';
  target.appendChild(input);
  input.focus();
  input.select();
  
  const save = () => {
    const newName = input.value.trim() || search.name || 'Unnamed';
    manager.updateSearch(searchId, { name: newName });
    target.textContent = newName;
  };
  
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      target.textContent = originalText;
    }
  });
}

async function activateSearch(searchId) {
  const search = manager.getSearch(searchId);
  if (!search) return;
  
  manager.setActiveSearch(searchId);
  clearMapLayers();
  
  if (search.parcels?.results?.length > 0) {
    displayParcelsOnMap(search.parcels.results);
  }
  
  if (search.resources?.types) {
    for (const [type, config] of Object.entries(search.resources.types)) {
      if (config.enabled && config.results?.length > 0) {
        displayResourcesOnMap(config.results, type);
      }
    }
  }
  
  const map = getMap();
  if (map) {
    map.setView([search.location.lat, search.location.lon], 14);
  }
  
  setStatus(`✅ Activated: ${search.name || 'Unnamed'}`);
}

function clearMapLayers() {
  const parcelLayer = getParcelLayerGroup();
  const resourceLayer = getResourceLayer();
  
  if (parcelLayer) parcelLayer.clearLayers();
  if (resourceLayer) resourceLayer.clearLayers();
  
  state.parcelPolygons = {};
  state.resourceMarkers = {};
  state.currentParcels = [];
  state.loadedResources = {};
}

function displayParcelsOnMap(parcels) {
  const parcelLayer = getParcelLayerGroup();
  if (!parcelLayer) return;
  
  for (const p of parcels) {
    if (!p.geometry?.coordinates?.[0]) continue;
    
    try {
      const coords = p.geometry.coordinates[0].map(c => [c[1], c[0]]);
      const polygon = L.polygon(coords, {
        color: p.class_color || '#6b7280',
        fillColor: p.class_color || '#6b7280',
        fillOpacity: 0.2,
        weight: 2
      });
      
      polygon.bindPopup(`<b>${p.address || 'No address'}</b><br>${p.class_label || 'Unknown'}<br><a href="${p.property_card}" target="_blank">Property Card</a>`);
      polygon.feature = { properties: { PARCELID: p.parcel_id } };
      polygon.addTo(parcelLayer);
      state.parcelPolygons[p.parcel_id] = polygon;
    } catch (e) {
      console.warn('Failed to add parcel polygon:', e);
    }
  }
  
  state.currentParcels = parcels;
}

function displayResourcesOnMap(resources, type) {
  const resourceLayer = getResourceLayer();
  if (!resourceLayer) return;
  
  const info = RESOURCE_TYPES[type] || {};
  
  if (!state.resourceMarkers[type]) {
    state.resourceMarkers[type] = [];
  }
  
  for (const r of resources) {
    if (!r.lat) continue;
    
    const marker = L.circleMarker([r.lat, r.lon], {
      radius: 6,
      fillColor: type === 'water' ? '#58a6ff' : 
                 type === 'shelter' ? '#f85149' :
                 type === 'food_bank' ? '#f97316' : '#3fb950',
      fillOpacity: 0.9,
      color: '#fff',
      weight: 1
    });
    
    marker.bindPopup(`
      <b>${info.icon || '📍'} ${r.name}</b><br>
      <span style="color:#8b949e">${info.label || type}</span><br>
      ${r.address ? `<span style="font-size:0.85rem">${r.address}</span><br>` : ''}
      ${r.dist_miles ? `<span style="font-size:0.8rem;color:#58a6ff">${r.dist_miles.toFixed(2)} mi</span>` : ''}
    `);
    
    marker.addTo(resourceLayer);
    state.resourceMarkers[type].push(marker);
  }
  
  if (!state.loadedResources) state.loadedResources = {};
  state.loadedResources[type] = resources;
}

async function loadParcels(searchId) {
  const search = manager.getSearch(searchId);
  if (!search) return;
  
  setStatus('⏳ Loading parcels...');
  
  try {
    const parcels = await findPublicParcels({
      lat: search.location.lat,
      lon: search.location.lon,
      radiusMiles: search.parcels.radius || 0.5,
      classFilter: search.parcels.classCodes || [],
      includeGeometry: true,
      gpsLat: state.gpsLat,
      gpsLon: state.gpsLon
    });
    
    const sorted = sortParcels(parcels, 'risk', state.gpsLat, state.gpsLon);
    
    manager.updateSearch(searchId, {
      parcels: {
        ...search.parcels,
        results: sorted,
        loadedAt: new Date().toISOString(),
        count: sorted.length
      }
    });
    
    setStatus(`✅ ${sorted.length} parcels loaded`);
    
    if (manager.getActiveSearch()?.id === searchId) {
      clearMapLayers();
      displayParcelsOnMap(sorted);
    }
  } catch (e) {
    setStatus('❌ ' + e.message);
  }
}

async function loadResourceType(searchId, type) {
  const search = manager.getSearch(searchId);
  if (!search) return;
  
  const info = RESOURCE_TYPES[type] || {};
  setStatus(`⏳ Loading ${info.label || type}...`);
  
  try {
    const config = search.resources.types?.[type] || {};
    const radius = config.radius || DEFAULT_RESOURCE_RADII[type] || 0.5;
    
    const resources = await findResourcesByType(type, search.location.lat, search.location.lon, radius);
    
    if (!search.resources.types[type]) {
      search.resources.types[type] = { enabled: false, radius, count: 0 };
    }
    
    manager.updateSearch(searchId, {
      resources: {
        ...search.resources,
        types: {
          ...search.resources.types,
          [type]: {
            ...search.resources.types[type],
            results: resources,
            loadedAt: new Date().toISOString(),
            count: resources.length
          }
        }
      }
    });
    
    setStatus(`✅ ${resources.length} ${info.label || type} loaded`);
    
    if (manager.getActiveSearch()?.id === searchId && search.resources.types[type]?.enabled) {
      displayResourcesOnMap(resources, type);
    }
  } catch (e) {
    setStatus('❌ ' + e.message);
  }
}

async function loadResourceCategory(searchId, categoryKey) {
  const category = RESOURCE_CATEGORIES[categoryKey];
  if (!category) return;
  
  for (const type of category.types) {
    await loadResourceType(searchId, type);
  }
}

function updateSearchCard(searchId) {
  const searchEl = listEl?.querySelector(`[data-search-id="${searchId}"]`);
  if (!searchEl) return;
  
  const search = manager.getSearch(searchId);
  if (!search) return;
  
  const isActive = manager.getActiveSearch()?.id === searchId;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderSearchCard(search, isActive);
  const newCard = tempDiv.firstElementChild;
  
  searchEl.replaceWith(newCard);
}

function updateQueueIndicator(data) {
  const el = document.getElementById('smQueue');
  if (!el) return;
  
  const queueLen = manager.getQueueLength();
  if (queueLen > 0) {
    el.textContent = `⏳ ${queueLen} in queue`;
    el.classList.add('active');
  } else {
    el.textContent = '';
    el.classList.remove('active');
  }
}

function updateStats() {
  const el = document.getElementById('smStats');
  if (!el) return;
  
  const stats = manager.getSearchStats();
  el.textContent = `${stats.totalSearches} searches · ${stats.favorites} favorites · ${stats.storage.usedMB}MB`;
}

export function showNewSearchModal(location = null) {
  let modal = document.getElementById('smNewSearchModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'smNewSearchModal';
    modal.className = 'sm-modal';
    modal.innerHTML = `
      <div class="sm-modal-content">
        <div class="sm-modal-header">
          <span>Create New Search</span>
          <button class="sm-modal-close" data-action="close">✕</button>
        </div>
        <div class="sm-modal-body">
          <div class="sm-form-group">
            <label>Location</label>
            <div class="sm-location-info" id="smNewLocation">
              <span class="sm-coords">--</span>
              <span class="sm-address">Loading...</span>
            </div>
            <div class="sm-location-source">
              <label><input type="radio" name="locSource" value="gps" checked> Current GPS</label>
              <label><input type="radio" name="locSource" value="map"> Map Center</label>
            </div>
          </div>
          <div class="sm-form-group">
            <label>Name (optional)</label>
            <input type="text" id="smNewName" placeholder="Auto-generated from location">
          </div>
          <div class="sm-form-group">
            <label>
              <input type="checkbox" id="smNewLoadParcels">
              Load parcels immediately
            </label>
          </div>
        </div>
        <div class="sm-modal-footer">
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn green" data-action="create">Create Search</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', e => {
      const action = e.target.dataset.action;
      if (action === 'close' || action === 'cancel') {
        modal.classList.remove('show');
      } else if (action === 'create') {
        createSearchFromModal();
      }
    });
  }
  
  if (location) {
    modal.dataset.lat = location.lat;
    modal.dataset.lon = location.lon;
    modal.dataset.source = location.source || 'map-click';
  } else {
    const map = getMap();
    const center = map ? map.getCenter() : { lat: 39.9612, lng: -82.9988 };
    modal.dataset.lat = state.gpsLat || center.lat;
    modal.dataset.lon = state.gpsLon || center.lng;
    modal.dataset.source = state.gpsLat ? 'gps' : 'map';
  }
  
  const locEl = document.getElementById('smNewLocation');
  if (locEl) {
    locEl.innerHTML = `
      <span class="sm-coords">📍 ${parseFloat(modal.dataset.lat).toFixed(4)}, ${parseFloat(modal.dataset.lon).toFixed(4)}</span>
      <span class="sm-address">${modal.dataset.source}</span>
    `;
  }
  
  modal.classList.add('show');
}

function createSearchFromModal() {
  const modal = document.getElementById('smNewSearchModal');
  if (!modal) return;
  
  const lat = parseFloat(modal.dataset.lat);
  const lon = parseFloat(modal.dataset.lon);
  const source = modal.dataset.source || 'unknown';
  const name = document.getElementById('smNewName')?.value?.trim() || null;
  const loadParcels = document.getElementById('smNewLoadParcels')?.checked;
  
  const search = manager.createSearch({ lat, lon, source }, { name });
  
  modal.classList.remove('show');
  
  if (loadParcels) {
    loadParcels(search.id);
  }
  
  manager.updateSearch(search.id, { uiState: { expandedLevel: 1, expandedSections: [] } });
  renderList();
  openPanel();
}

function showDeleteConfirm(searchId) {
  const search = manager.getSearch(searchId);
  if (!search) return;
  
  let modal = document.getElementById('smDeleteModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'smDeleteModal';
    modal.className = 'sm-modal';
    modal.innerHTML = `
      <div class="sm-modal-content sm-modal-sm">
        <div class="sm-modal-header">
          <span>Delete Search?</span>
          <button class="sm-modal-close" data-action="close">✕</button>
        </div>
        <div class="sm-modal-body">
          <p id="smDeleteName"></p>
          <p style="color:#8b949e;font-size:0.85rem">This cannot be undone.</p>
        </div>
        <div class="sm-modal-footer">
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn red" data-action="delete">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  modal.dataset.searchId = searchId;
  document.getElementById('smDeleteName').textContent = `Are you sure you want to delete "${search.name || 'Unnamed'}"?`;
  
  const handleDelete = (e) => {
    if (e.target.dataset.action === 'delete') {
      manager.deleteSearch(modal.dataset.searchId);
      modal.classList.remove('show');
      modal.removeEventListener('click', handleDelete);
    } else if (e.target.dataset.action === 'close' || e.target.dataset.action === 'cancel') {
      modal.classList.remove('show');
      modal.removeEventListener('click', handleDelete);
    }
  };
  
  modal.addEventListener('click', handleDelete);
  modal.classList.add('show');
}

function showClearAllConfirm() {
  const searches = manager.getAllSearches();
  const lockedCount = searches.filter(s => s.locked).length;
  const deleteCount = searches.length - lockedCount;
  
  if (deleteCount === 0) {
    setStatus('All searches are locked');
    return;
  }
  
  let modal = document.getElementById('smClearAllModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'smClearAllModal';
    modal.className = 'sm-modal';
    modal.innerHTML = `
      <div class="sm-modal-content sm-modal-sm">
        <div class="sm-modal-header">
          <span>Clear All Searches?</span>
          <button class="sm-modal-close" data-action="close">✕</button>
        </div>
        <div class="sm-modal-body">
          <p>This will delete <span id="smClearCount">0</span> searches.</p>
          <p id="smClearLocked" style="color:#8b949e;font-size:0.85rem"></p>
          <p style="color:#f85149;font-size:0.85rem">This cannot be undone.</p>
        </div>
        <div class="sm-modal-footer">
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn red" data-action="clear">Clear</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('smClearCount').textContent = deleteCount;
  const lockedEl = document.getElementById('smClearLocked');
  if (lockedCount > 0) {
    lockedEl.textContent = `${lockedCount} locked search(es) will be preserved.`;
  } else {
    lockedEl.textContent = '';
  }
  
  const handleClear = (e) => {
    if (e.target.dataset.action === 'clear') {
      manager.clearAllNonLocked();
      modal.classList.remove('show');
      modal.removeEventListener('click', handleClear);
    } else if (e.target.dataset.action === 'close' || e.target.dataset.action === 'cancel') {
      modal.classList.remove('show');
      modal.removeEventListener('click', handleClear);
    }
  };
  
  modal.addEventListener('click', handleClear);
  modal.classList.add('show');
}

function closeAllModals() {
  document.querySelectorAll('.sm-modal.show').forEach(m => m.classList.remove('show'));
}

function getStaleBadge(timestamp) {
  if (!timestamp) return { badge: '', class: '', label: '' };
  
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  if (ageDays < 1) return { badge: '🟢', class: 'fresh', label: 'Fresh' };
  if (ageDays < 7) return { badge: '🟠', class: 'recent', label: 'Recent' };
  return { badge: '🔴', class: 'old', label: 'Old' };
}

function getResourceCount(search) {
  let count = 0;
  const types = search.resources?.types || {};
  for (const config of Object.values(types)) {
    count += config.count || 0;
  }
  return count;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'unknown';
  
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getRiskLabel(risk) {
  return { low: '🟢 LOW', med: '🟡 MED', avoid: '🔴 AVOID' }[risk] || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { isPanelOpen };
