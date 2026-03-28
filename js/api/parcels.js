import { API_URLS, CACHE_TTL, CLASS_CODES, getClassInfo } from '../config.js';
import { distMiles, getCentroid, bboxFromCenter } from '../utils.js';

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

export async function findPublicParcels({
  lat, lon,
  radiusMiles = 0.5,
  bounds,
  limit = 200,
  includeGeometry = true,
  classFilter = ['600','605','610','620','630','640','650','660','670','680'],
  gpsLat = null,
  gpsLon = null
} = {}) {
  const b = bounds
    ? { w: bounds._southWest?.lng ?? bounds.w, s: bounds._southWest?.lat ?? bounds.s, e: bounds._northEast?.lng ?? bounds.e, n: bounds._northEast?.lat ?? bounds.n }
    : bboxFromCenter(lat, lon, radiusMiles);

  const ck = `p_${JSON.stringify(b)}_${includeGeometry}_${classFilter.join(',')}`;
  const cached = cacheGet(ck);
  if (cached) {
    return cached.map(p => ({
      ...p,
      dist_miles: gpsLat && gpsLon && p.centroid ? distMiles(gpsLat, gpsLon, p.centroid.lat, p.centroid.lon) : null,
      dist_label: gpsLat && gpsLon && p.centroid ? distMiles(gpsLat, gpsLon, p.centroid.lat, p.centroid.lon)?.toFixed(2) + ' mi' : null
    }));
  }

  const classWhere = classFilter.length > 0
    ? `CLASSCD IN (${classFilter.map(c => `'${c}'`).join(',')})`
    : '1=0';

  const geo = JSON.stringify({ xmin: b.w, ymin: b.s, xmax: b.e, ymax: b.n, spatialReference: { wkid: 4326 } });
  const p = new URLSearchParams({
    where: classWhere,
    geometry: geo,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: 4326,
    outFields: 'PARCELID,OWNERNME1,CLASSCD,CLASSDSCRP,SITEADDRESS,ACRES,TOTVALUEBASE,SALEDATE,ZIPCD',
    returnGeometry: includeGeometry ? 'true' : 'false',
    outSR: '4326',
    resultRecordCount: limit,
    f: 'geojson'
  });

  const r = await fetch(`${API_URLS.PARCEL_FEATURES}?${p}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);

  const out = (d.features || []).map(f => {
    const a = f.properties;
    const classInfo = getClassInfo(a.CLASSCD);
    const centroid = f.geometry ? getCentroid(f.geometry) : null;
    const saleYear = a.SALEDATE ? new Date(a.SALEDATE).getFullYear() : null;

    return {
      parcel_id: a.PARCELID,
      address: a.SITEADDRESS,
      owner: a.OWNERNME1,
      classcd: a.CLASSCD,
      class_label: classInfo.label,
      class_color: classInfo.color,
      class_desc: a.CLASSDSCRP,
      risk: classInfo.risk,
      risk_desc: classInfo.desc,
      acres: a.ACRES,
      appraised: a.TOTVALUEBASE,
      last_sale_year: saleYear,
      zip: a.ZIPCD,
      property_card: API_URLS.PROPERTY_CARD + (a.PARCELID || ''),
      geometry: f.geometry || null,
      centroid,
      dist_miles: gpsLat && gpsLon && centroid ? distMiles(gpsLat, gpsLon, centroid.lat, centroid.lon) : null
    };
  });

  out.forEach(p => {
    p.dist_label = p.dist_miles !== null ? p.dist_miles.toFixed(2) + ' mi' : null;
  });

  cacheSet(ck, out);
  return out;
}

export function sortParcels(parcels, sortBy = 'risk', gpsLat = null, gpsLon = null) {
  const sorted = [...parcels];
  const riskOrder = { low: 0, med: 1, avoid: 2, high: 3 };

  switch (sortBy) {
    case 'distance':
      sorted.sort((a, b) => (a.dist_miles || 999) - (b.dist_miles || 999));
      break;
    case 'distance-desc':
      sorted.sort((a, b) => (b.dist_miles || 0) - (a.dist_miles || 0));
      break;
    case 'risk':
      sorted.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
      break;
    case 'risk-desc':
      sorted.sort((a, b) => riskOrder[b.risk] - riskOrder[a.risk]);
      break;
    case 'acres':
      sorted.sort((a, b) => (b.acres || 0) - (a.acres || 0));
      break;
    case 'acres-asc':
      sorted.sort((a, b) => (a.acres || 0) - (b.acres || 0));
      break;
    case 'class':
      sorted.sort((a, b) => (a.classcd || '').localeCompare(b.classcd || ''));
      break;
    case 'owner':
      sorted.sort((a, b) => (a.owner || '').localeCompare(b.owner || ''));
      break;
  }

  return sorted;
}

export async function findParcelAtPoint(lat, lon) {
  const geo = JSON.stringify({
    x: lon,
    y: lat,
    spatialReference: { wkid: 4326 }
  });

  const outFields = 'PARCELID,OWNERNME1,CLASSCD,CLASSDSCRP,SITEADDRESS,ACRES,TOTVALUEBASE,SALEDATE,ZIPCD';

  const p = new URLSearchParams({
    where: '1=1',
    geometry: geo,
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: 4326,
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: 1,
    f: 'geojson'
  });

  const url = `${API_URLS.PARCEL_FEATURES}?${p}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.error) {
    throw new Error(`ArcGIS error: ${d.error.message} (code ${d.error.code})`);
  }

  if (!d.features || d.features.length === 0) return null;

  const f = d.features[0];
  const a = f.properties;
  const classInfo = getClassInfo(a.CLASSCD);
  const centroid = f.geometry ? getCentroid(f.geometry) : null;

  return {
    parcel_id: a.PARCELID,
    address: a.SITEADDRESS,
    owner: a.OWNERNME1,
    classcd: a.CLASSCD,
    class_label: classInfo.label,
    class_color: classInfo.color,
    class_desc: a.CLASSDSCRP,
    risk: classInfo.risk,
    risk_desc: classInfo.desc,
    acres: a.ACRES,
    zip: a.ZIPCD,
    appraised: a.TOTVALUEBASE,
    last_sale_year: a.SALEDATE ? new Date(a.SALEDATE).getFullYear() : null,
    sale_date: a.SALEDATE,
    property_card: API_URLS.PROPERTY_CARD + (a.PARCELID || ''),
    geometry: f.geometry,
    centroid
  };
}

export async function findAdjacentParcels(geometry, parcelId) {
  if (!geometry || !geometry.coordinates || !geometry.coordinates[0]) {
    return [];
  }

  const outFields = 'PARCELID,OWNERNME1,CLASSCD,CLASSDSCRP,SITEADDRESS,ACRES,TOTVALUEBASE,SALEDATE';
  const results = [];

  try {
    const esriGeometry = {
      rings: geometry.coordinates,
      spatialReference: { wkid: 4326 }
    };

    const params = new URLSearchParams({
      where: `PARCELID <> '${parcelId}'`,
      geometry: JSON.stringify(esriGeometry),
      geometryType: 'esriGeometryPolygon',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: 4326,
      outFields,
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: 50,
      f: 'geojson'
    });

    const resp = await fetch(`${API_URLS.PARCEL_FEATURES}?${params}`);
    const data = await resp.json();

    if (data.features) {
      for (const f of data.features) {
        const classInfo = getClassInfo(f.properties.CLASSCD);
        results.push({
          parcel_id: f.properties.PARCELID,
          address: f.properties.SITEADDRESS,
          owner: f.properties.OWNERNME1,
          classcd: f.properties.CLASSCD,
          class_label: classInfo.label,
          class_desc: f.properties.CLASSDSCRP,
          risk: classInfo.risk,
          risk_text: classInfo.risk === 'low' ? '🟢 LOW' : classInfo.risk === 'avoid' ? '🔴 AVOID' : '🟡 MED',
          acres: f.properties.ACRES,
          appraised: f.properties.TOTVALUEBASE,
          last_sale_year: f.properties.SALEDATE ? new Date(f.properties.SALEDATE).getFullYear() : null,
          geometry: f.geometry
        });
      }
    }
  } catch (e) {
    console.warn('Adjacent parcels query failed:', e);
  }

  return results;
}

export async function getParcelDetail(pin) {
  const r = await fetch(`${API_URLS.AUDITOR}/${encodeURIComponent(pin)}`);
  if (!r.ok) throw new Error(`Auditor API ${r.status}`);
  return r.json();
}

export async function geocode(query) {
  const q = query.toLowerCase().includes('columbus') ? query : `${query}, Columbus OH`;
  const p = new URLSearchParams({ format: 'json', q, countrycodes: 'us', limit: 1 });
  const r = await fetch(`${API_URLS.NOMINATIM}?${p}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'Sprawlmap/1.0 humanitarian-tool' }
  });
  const d = await r.json();
  if (!d.length) return null;
  return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), display_name: d[0].display_name };
}
