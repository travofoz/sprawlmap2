import { API_URLS, CACHE_TTL, RESOURCE_TYPES, HARDCODED_RESOURCES } from '../config.js';
import { distMiles, delay } from '../utils.js';

const cacheGet = k => {
  try {
    const r = localStorage.getItem(k);
    if (!r) return null;
    const { ts, data } = JSON.parse(r);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(k); return null; }
    return data;
  } catch { return null; }
};

const cacheSet = (k, d) => {
  try { localStorage.setItem(k, JSON.stringify({ ts: Date.now(), data: d })); } catch {}
};

function classifyElement(e, lat, lon) {
  const rl = e.lat || e.center?.lat, ro = e.lon || e.center?.lon;
  const t = e.tags || {};
  const name = (t.name || '').toLowerCase();
  const brand = (t.brand || '').toLowerCase();
  let type = 'other', icon = '📍';

  if (t.highway === 'bus_stop') { type = 'bus'; icon = '🚌'; }
  else if (t.amenity === 'drinking_water') { type = 'water'; icon = '💧'; }
  else if (t.amenity === 'toilets') { type = 'toilet'; icon = '🚻'; }
  else if (t.social_facility === 'shelter' || t.amenity === 'shelter') { type = 'shelter'; icon = '🏠'; }
  else if (t.amenity === 'food_bank' || t.social_facility === 'food_bank') { type = 'food_bank'; icon = '🥫'; }
  else if (t.amenity === 'hospital' || t.amenity === 'clinic') { type = 'hospital'; icon = '🏥'; }
  else if (t.amenity === 'pharmacy') { type = 'pharmacy'; icon = '💊'; }
  else if (t.amenity === 'mental_health' || t.healthcare || t.amenity === 'social_facility') { type = 'mental_health'; icon = '🧠'; }
  else if (t.amenity === 'library') { type = 'library'; icon = '📚'; }
  else if (t.shop === 'laundry' || t.shop === 'dry_cleaning') { type = 'laundry'; icon = '👕'; }
  else if (t.amenity === 'charging_station') { type = 'power'; icon = '⚡'; }
  else if (t.internet_access === 'wlan' || t.internet_access === 'yes') { type = 'wifi'; icon = '📶'; }
  else if (t.leisure === 'dog_park') { type = 'dog_park'; icon = '🐕'; }
  else if (t.amenity === 'police') { type = 'police'; icon = '🚔'; }
  else if (t.amenity === 'fast_food' && (name.includes('mcdonald') || brand.includes('mcdonald'))) { type = 'mcdonalds'; icon = '🍔'; }
  else if ((t.amenity === 'fuel' || t.shop === 'convenience') && (name.includes('speedway') || brand.includes('speedway'))) { type = 'speedway'; icon = '⛽'; }
  else if ((t.amenity === 'fuel' || t.shop === 'convenience') && (name.includes('sheetz') || brand.includes('sheetz'))) { type = 'sheetz'; icon = '🛒'; }
  else if (t.shop === 'supermarket' && (name.includes('aldi') || brand.includes('aldi'))) { type = 'aldi'; icon = '🛒'; }
  else if (t.shop === 'supermarket' && (name.includes('kroger') || brand.includes('kroger'))) { type = 'kroger'; icon = '🛒'; }
  else if (t.shop === 'variety_store' || name.includes('dollar tree') || name.includes('dollar general') || name.includes('family dollar')) { type = 'dollar_store'; icon = '💵'; }
  else if (name.includes('big lots') || brand.includes('big lots')) { type = 'big_lots'; icon = '📦'; }
  else if (name.includes('walmart') || brand.includes('walmart')) { type = 'walmart'; icon = '🏬'; }
  else if (name.includes('target') || brand.includes('target')) { type = 'target'; icon = '🎯'; }
  else if (t.shop === 'charity' || t.shop === 'second_hand' || name.includes('goodwill') || name.includes('salvation army')) { type = 'thrift'; icon = '👕'; }
  else if (t.industrial === 'scrapyard' || t['recycling:type'] === 'scrap_metal' || name.includes('scrap')) { type = 'scrap_yard'; icon = '♻️'; }
  else if (t.amenity === 'recycling') { type = 'recycling'; icon = '♻️'; }
  else if (t.shop === 'pawnbroker') { type = 'pawn_shop'; icon = '💰'; }
  else if ((t.shop === 'clothes' && t.second_hand === 'yes') || name.includes('plato') || name.includes('clothes mentor')) { type = 'used_clothes'; icon = '👗'; }
  else if (t.shop === 'electronics' || name.includes('gamestop') || name.includes('best buy')) { type = 'electronics'; icon = '📱'; }
  else if (t.building === 'apartments' || t.landuse === 'residential') { type = 'apartments'; icon = '🏢'; }

  return {
    type,
    icon,
    type_label: RESOURCE_TYPES[type]?.label || type,
    name: t.name || RESOURCE_TYPES[type]?.label || type,
    lat: rl,
    lon: ro,
    address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null,
    tags: t,
    dist_miles: rl ? distMiles(lat, lon, rl, ro) : null,
    source: 'osm'
  };
}

export async function findResourcesByType(type, lat, lon, radiusMiles) {
  const radiusMeters = Math.round(radiusMiles * 1609);
  const ck = `r_${type}_${lat.toFixed(4)}_${lon.toFixed(4)}_${radiusMeters}`;
  const cached = cacheGet(ck);
  if (cached) return cached;

  const typeConfig = RESOURCE_TYPES[type];
  if (!typeConfig?.overpass) {
    const hardcoded = HARDCODED_RESOURCES.filter(h => h.type === type).map(h => ({
      ...h,
      icon: RESOURCE_TYPES[h.type]?.icon || '📍',
      type_label: RESOURCE_TYPES[h.type]?.label || h.type,
      dist_miles: distMiles(lat, lon, h.lat, h.lon),
      source: 'hardcoded'
    })).filter(h => h.dist_miles <= radiusMiles);
    return hardcoded;
  }

  const queries = typeConfig.overpass.split(',').map(q => `${q}(around:${radiusMeters},${lat},${lon});`);
  const ql = `[out:json][timeout:25];(${queries.join('')});out center tags;`;

  let retries = 3;
  let r;
  while (retries >= 0) {
    r = await fetch(API_URLS.OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(ql) });
    if (r.ok || r.status !== 429) break;
    if (retries === 0) break;
    await delay(2000 * (4 - retries));
    retries--;
  }

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Overpass API error (${r.status}): ${text.slice(0, 200)}`);
  }

  const d = await r.json();
  const osmResults = (d.elements || []).map(e => classifyElement(e, lat, lon)).filter(res => res.type === type);

  const hardcodedResults = HARDCODED_RESOURCES.filter(h => {
    if (h.type !== type) return false;
    const d = distMiles(lat, lon, h.lat, h.lon);
    return d <= radiusMiles;
  }).map(h => ({
    ...h,
    icon: RESOURCE_TYPES[h.type]?.icon || '📍',
    type_label: RESOURCE_TYPES[h.type]?.label || h.type,
    dist_miles: distMiles(lat, lon, h.lat, h.lon),
    source: 'hardcoded'
  }));

  const out = [...osmResults, ...hardcodedResults];
  out.sort((a, b) => (a.dist_miles || 99) - (b.dist_miles || 99));

  cacheSet(ck, out);
  return out;
}

export async function findResourcesSequentially(types, lat, lon, getRadiusForType, onProgress) {
  const results = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const radius = getRadiusForType(type);
    if (onProgress) onProgress(type, i, types.length);
    
    try {
      const typeResults = await findResourcesByType(type, lat, lon, radius);
      results.push(...typeResults);
      
      if (i < types.length - 1) {
        await delay(500);
      }
    } catch (e) {
      console.warn(`Failed to load ${type}:`, e.message);
    }
  }
  results.sort((a, b) => (a.dist_miles || 99) - (b.dist_miles || 99));
  return results;
}

export async function findNearbyResources({ lat, lon, radiusMeters = 800, types } = {}) {
  const keys = types || Object.keys(RESOURCE_TYPES);
  const ck = `r_${lat.toFixed(4)}_${lon.toFixed(4)}_${radiusMeters}_${keys.join(',')}`;
  const cached = cacheGet(ck);
  if (cached) return cached;

  const allQueries = keys.flatMap(k =>
    (RESOURCE_TYPES[k]?.overpass || '').split(',').map(q => `${q}(around:${radiusMeters},${lat},${lon});`)
  );

  const BATCH_SIZE = 10;
  const allElements = [];

  for (let i = 0; i < allQueries.length; i += BATCH_SIZE) {
    const batchQueries = allQueries.slice(i, i + BATCH_SIZE);
    const ql = `[out:json][timeout:25];(${batchQueries.join('')});out center tags;`;

    let retries = 3;
    let r;
    while (retries >= 0) {
      r = await fetch(API_URLS.OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(ql) });
      if (r.ok || r.status !== 429) break;
      if (retries === 0) break;
      await delay(2000 * (4 - retries));
      retries--;
    }

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Overpass API error (${r.status}): ${text.slice(0, 200)}`);
    }
    const d = await r.json();
    allElements.push(...(d.elements || []));

    if (i + BATCH_SIZE < allQueries.length) {
      await delay(1000);
    }
  }

  const osmResults = allElements.map(e => classifyElement(e, lat, lon));

  const radiusMiles = radiusMeters / 1609;
  const hardcodedResults = HARDCODED_RESOURCES.filter(h => {
    const d = distMiles(lat, lon, h.lat, h.lon);
    return d <= radiusMiles;
  }).map(h => ({
    ...h,
    icon: RESOURCE_TYPES[h.type]?.icon || '📍',
    type_label: RESOURCE_TYPES[h.type]?.label || h.type,
    dist_miles: distMiles(lat, lon, h.lat, h.lon),
    source: 'hardcoded'
  }));

  const out = [...osmResults, ...hardcodedResults];
  out.sort((a, b) => (a.dist_miles || 99) - (b.dist_miles || 99));

  cacheSet(ck, out);
  return out;
}

export async function scoreLocation({ lat, lon, needs = [] }) {
  const [parcels, resources] = await Promise.all([
    findNearbyResources({ lat, lon, radiusMiles: 0.25 }),
    findNearbyResources({ lat, lon, radiusMeters: 1200 })
  ]);

  const needMap = {
    laundry: ['laundry'], laundromat: ['laundry'],
    bus: ['bus'], transit: ['bus'],
    water: ['water'],
    power: ['power'], charging: ['power'], battery: ['power'],
    mental: ['mental_health'], 'mental health': ['mental_health'],
    toilet: ['toilet'], restroom: ['toilet'], bathroom: ['toilet'],
    food: ['food_bank'],
    shelter: ['shelter'],
    dog: ['dog_park'],
    wifi: ['wifi'], internet: ['wifi'],
    hospital: ['hospital'], clinic: ['hospital'],
    pharmacy: ['pharmacy'],
    library: ['library']
  };

  const breakdown = needs.map(need => {
    const types = Object.entries(needMap).find(([k]) => need.toLowerCase().includes(k))?.[1] || [];
    const matches = resources.filter(r => types.includes(r.type));
    const closest = matches[0] || null;
    return {
      need,
      met: matches.length > 0,
      closest_dist_miles: closest?.dist_miles?.toFixed(2) || null,
      closest_name: closest?.name || null,
      count_nearby: matches.length
    };
  });

  const best = parcels.find(p => p.risk === 'low');
  const score = Math.round(
    (best ? 40 : 0) +
    (needs.length > 0 ? 60 * (breakdown.filter(b => b.met).length / needs.length) : 60)
  );

  return { score, has_public_land: !!best, best_parcel: best || null, breakdown, parcels, resources };
}
