const KEYS = {
  SEARCHES: 'searchManager_searches',
  ACTIVE_ID: 'searchManager_activeId',
  SETTINGS: 'searchManager_settings'
};

function compress(data) {
  if (typeof LZString === 'undefined') {
    console.warn('LZString not available, storing uncompressed');
    return JSON.stringify(data);
  }
  return LZString.compressToUTF16(JSON.stringify(data));
}

function decompress(compressed) {
  if (!compressed) return null;
  try {
    if (typeof LZString === 'undefined') {
      return JSON.parse(compressed);
    }
    const decompressed = LZString.decompressFromUTF16(compressed);
    if (!decompressed) {
      console.warn('Decompression returned null, trying raw parse');
      return JSON.parse(compressed);
    }
    return JSON.parse(decompressed);
  } catch (e) {
    console.error('Decompression failed:', e);
    try {
      return JSON.parse(compressed);
    } catch (e2) {
      console.error('Fallback parse also failed:', e2);
      return null;
    }
  }
}

export function save(key, data) {
  try {
    const compressed = compress(data);
    localStorage.setItem(key, compressed);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.error('localStorage quota exceeded');
      emitStorageWarning();
      return false;
    }
    throw e;
  }
}

export function load(key, defaultValue = null) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const data = decompress(stored);
    return data !== null ? data : defaultValue;
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
    return defaultValue;
  }
}

export function remove(key) {
  localStorage.removeItem(key);
}

export function clear() {
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
}

export function getStorageSize() {
  let total = 0;
  for (const key of Object.values(KEYS)) {
    const item = localStorage.getItem(key);
    if (item) {
      total += item.length * 2;
    }
  }
  return total;
}

export function getStorageUsage() {
  const used = getStorageSize();
  const quota = 5 * 1024 * 1024;
  return {
    used,
    quota,
    percent: Math.round((used / quota) * 100),
    usedMB: (used / (1024 * 1024)).toFixed(2)
  };
}

function emitStorageWarning() {
  window.dispatchEvent(new CustomEvent('searchManager:storageQuota', {
    detail: getStorageUsage()
  }));
}

export function exportData() {
  return {
    searches: load(KEYS.SEARCHES, []),
    activeId: load(KEYS.ACTIVE_ID),
    settings: load(KEYS.SETTINGS, {}),
    exportedAt: new Date().toISOString()
  };
}

export function importData(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.searches) save(KEYS.SEARCHES, data.searches);
    if (data.activeId) save(KEYS.ACTIVE_ID, data.activeId);
    if (data.settings) save(KEYS.SETTINGS, data.settings);
    return { success: true, count: data.searches?.length || 0 };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export { KEYS };
