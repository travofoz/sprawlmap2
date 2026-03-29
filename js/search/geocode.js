import { API_URLS } from '../config.js';

let lastGeocodeTime = 0;
const GEOCODE_MIN_INTERVAL = 1100;
const geocodeCache = new Map();

function getCacheKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export async function reverseGeocode(lat, lon) {
  const cacheKey = getCacheKey(lat, lon);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const now = Date.now();
  const elapsed = now - lastGeocodeTime;
  if (elapsed < GEOCODE_MIN_INTERVAL) {
    await new Promise(r => setTimeout(r, GEOCODE_MIN_INTERVAL - elapsed));
  }
  lastGeocodeTime = Date.now();

  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: lat.toString(),
      lon: lon.toString(),
      zoom: '18',
      addressdetails: '1'
    });

    const response = await fetch(`${API_URLS.NOMINATIM.replace('/search', '/reverse')}?${params}`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'Sprawlmap/1.0 humanitarian-tool'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocode HTTP ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};

    const parts = [];
    if (address.neighbourhood) parts.push(address.neighbourhood);
    else if (address.suburb) parts.push(address.suburb);
    else if (address.hamlet) parts.push(address.hamlet);
    else if (address.village) parts.push(address.village);

    const city = address.city || address.town || address.municipality || 'Unknown';
    const state = address.state || 'OH';

    let label;
    if (parts.length > 0) {
      label = `${parts[0]}, ${city}`;
    } else {
      label = `${city}, ${state}`;
    }

    const result = {
      label,
      display_name: data.display_name,
      city,
      state,
      neighbourhood: parts[0] || null,
      components: address
    };

    geocodeCache.set(cacheKey, result);

    if (geocodeCache.size > 100) {
      const firstKey = geocodeCache.keys().next().value;
      geocodeCache.delete(firstKey);
    }

    return result;
  } catch (e) {
    console.error('Reverse geocode failed:', e);
    const fallback = {
      label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      display_name: null,
      city: null,
      state: null,
      neighbourhood: null,
      components: {},
      error: e.message
    };
    return fallback;
  }
}

export async function generateSearchName(lat, lon, existing = []) {
  const geo = await reverseGeocode(lat, lon);
  let baseName = geo.label;

  const existingNames = new Set(existing);
  let name = baseName;
  let suffix = 2;

  while (existingNames.has(name)) {
    name = `${baseName} (${suffix})`;
    suffix++;
  }

  return name;
}

export function clearGeocodeCache() {
  geocodeCache.clear();
}

export function getGeocodeCacheSize() {
  return geocodeCache.size;
}
