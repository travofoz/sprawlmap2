import { save, load, remove, KEYS, getStorageUsage } from './storage.js';
import { createDefaultParcelConfig, createDefaultResourceConfig } from './types.js';
import { generateSearchName } from './geocode.js';

let searches = [];
let activeSearchId = null;
const listeners = new Map();
const loadQueue = [];
let isProcessingQueue = false;

export function init() {
  try {
    searches = load(KEYS.SEARCHES, []);
    activeSearchId = load(KEYS.ACTIVE_ID, null);
    
    if (searches.length > 0 && !activeSearchId) {
      activeSearchId = searches[0].id;
    }
    
    emit('initialized', { searchCount: searches.length, activeId: activeSearchId });
  } catch (e) {
    console.error('Search manager init failed:', e);
    searches = [];
    activeSearchId = null;
  }
}

export function createSearch(location, options = {}) {
  const id = generateUUID();
  const now = new Date().toISOString();
  
  const search = {
    id,
    name: options.name || null,
    location: {
      lat: location.lat,
      lon: location.lon,
      label: location.label || null,
      source: location.source || 'unknown'
    },
    created: now,
    updated: now,
    favorite: false,
    locked: false,
    parcels: options.parcels || createDefaultParcelConfig(),
    resources: options.resources || createDefaultResourceConfig(),
    uiState: {
      expandedLevel: 0,
      expandedSections: []
    }
  };
  
  try {
    searches.unshift(search);
    saveSearches();
    emit('created', { search });
    
    if (!search.name) {
      generateSearchName(location.lat, location.lon, searches.map(s => s.name).filter(Boolean))
        .then(name => {
          search.name = name;
          search.updated = new Date().toISOString();
          saveSearches();
          emit('renamed', { searchId: search.id, name });
        })
        .catch(err => {
          console.error('Failed to generate search name:', err);
          search.name = `Search ${searches.length}`;
          search.updated = new Date().toISOString();
          saveSearches();
        });
    }
  } catch (e) {
    console.error('Error creating search:', e);
  }
  
  return search;
}

export function getSearch(id) {
  return searches.find(s => s.id === id) || null;
}

export function updateSearch(id, updates) {
  const search = getSearch(id);
  if (!search) return null;
  
  if (search.locked && !updates.unlockOverride) {
    emit('locked:attempt', { searchId: id });
    return null;
  }
  
  const { unlockOverride, ...safeUpdates } = updates;
  Object.assign(search, safeUpdates);
  search.updated = new Date().toISOString();
  
  saveSearches();
  emit('updated', { search, changes: safeUpdates });
  
  return search;
}

export function deleteSearch(id) {
  const index = searches.findIndex(s => s.id === id);
  if (index === -1) return false;
  
  const search = searches[index];
  if (search.locked) {
    emit('locked:attempt', { searchId: id });
    return false;
  }
  
  searches.splice(index, 1);
  saveSearches();
  
  if (activeSearchId === id) {
    activeSearchId = searches.length > 0 ? searches[0].id : null;
    saveActiveId();
  }
  
  emit('deleted', { searchId: id, search });
  return true;
}

export function getAllSearches() {
  return [...searches];
}

export function getActiveSearch() {
  return activeSearchId ? getSearch(activeSearchId) : null;
}

export function setActiveSearch(id) {
  if (id && !getSearch(id)) return false;
  
  const previousId = activeSearchId;
  activeSearchId = id;
  saveActiveId();
  
  emit('activated', { 
    searchId: id, 
    search: id ? getSearch(id) : null,
    previousId 
  });
  
  return true;
}

export function toggleFavorite(id) {
  const search = getSearch(id);
  if (!search) return null;
  
  search.favorite = !search.favorite;
  search.updated = new Date().toISOString();
  saveSearches();
  
  resortSearches();
  emit('favorite', { searchId: id, favorite: search.favorite });
  
  return search;
}

export function toggleLock(id) {
  const search = getSearch(id);
  if (!search) return null;
  
  search.locked = !search.locked;
  search.updated = new Date().toISOString();
  saveSearches();
  
  emit('lock', { searchId: id, locked: search.locked });
  
  return search;
}

export function clearAllNonLocked() {
  const lockedSearches = searches.filter(s => s.locked);
  const deletedCount = searches.length - lockedSearches.length;
  
  searches = lockedSearches;
  saveSearches();
  
  if (activeSearchId && !getSearch(activeSearchId)) {
    activeSearchId = searches.length > 0 ? searches[0].id : null;
    saveActiveId();
  }
  
  emit('cleared', { deletedCount, preservedCount: lockedSearches.length });
  
  return { deletedCount, preservedCount: lockedSearches.length };
}

export function getFavorites() {
  return searches.filter(s => s.favorite);
}

export function sortBy(spec) {
  saveSettings({ sortBy: spec.sortBy, sortOrder: spec.sortOrder });
  resortSearches();
}

function resortSearches() {
  const settings = load(KEYS.SETTINGS, { sortBy: 'updated', sortOrder: 'desc' });
  
  const favorites = searches.filter(s => s.favorite);
  const nonFavorites = searches.filter(s => !s.favorite);
  
  const sortFn = (a, b) => {
    let cmp = 0;
    switch (settings.sortBy) {
      case 'name':
        cmp = (a.name || '').localeCompare(b.name || '');
        break;
      case 'created':
        cmp = new Date(a.created) - new Date(b.created);
        break;
      case 'updated':
      default:
        cmp = new Date(a.updated) - new Date(b.updated);
        break;
    }
    return settings.sortOrder === 'desc' ? -cmp : cmp;
  };
  
  favorites.sort(sortFn);
  nonFavorites.sort(sortFn);
  
  searches = [...favorites, ...nonFavorites];
  saveSearches();
}

function saveSearches() {
  const result = save(KEYS.SEARCHES, searches);
  if (!result) {
    emit('storage:quota', getStorageUsage());
  }
}

function saveActiveId() {
  if (activeSearchId) {
    save(KEYS.ACTIVE_ID, activeSearchId);
  } else {
    remove(KEYS.ACTIVE_ID);
  }
}

function saveSettings(updates) {
  const current = load(KEYS.SETTINGS, {});
  save(KEYS.SETTINGS, { ...current, ...updates });
}

export async function queueLoad(searchId, type, loadFn) {
  return new Promise((resolve, reject) => {
    loadQueue.push({
      searchId,
      type,
      loadFn,
      resolve,
      reject,
      queuedAt: Date.now()
    });
    
    emit('queue:added', { 
      searchId, 
      type, 
      queueLength: loadQueue.length 
    });
    
    if (!isProcessingQueue) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (loadQueue.length === 0) {
    isProcessingQueue = false;
    emit('queue:empty', {});
    return;
  }
  
  isProcessingQueue = true;
  const item = loadQueue.shift();
  
  emit('queue:processing', { 
    searchId: item.searchId, 
    type: item.type, 
    queueLength: loadQueue.length 
  });
  
  try {
    const result = await item.loadFn();
    item.resolve(result);
    emit('loaded', { 
      searchId: item.searchId, 
      type: item.type, 
      result 
    });
  } catch (e) {
    item.reject(e);
    emit('error', { 
      searchId: item.searchId, 
      type: item.type, 
      error: e 
    });
  }
  
  processQueue();
}

export function getQueueLength() {
  return loadQueue.length;
}

export function isQueueProcessing() {
  return isProcessingQueue;
}

export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  
  return () => off(event, callback);
}

export function off(event, callback) {
  if (listeners.has(event)) {
    listeners.get(event).delete(callback);
  }
}

export function emit(event, data) {
  if (listeners.has(event)) {
    for (const callback of listeners.get(event)) {
      try {
        callback(data);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    }
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getSearchStats() {
  const usage = getStorageUsage();
  return {
    totalSearches: searches.length,
    favorites: searches.filter(s => s.favorite).length,
    locked: searches.filter(s => s.locked).length,
    withParcels: searches.filter(s => s.parcels?.count > 0).length,
    withResources: searches.filter(s => 
      Object.values(s.resources?.types || {}).some(t => t.count > 0)
    ).length,
    storage: usage
  };
}
