import { API_URLS } from '../config.js';

export async function fetch311Data(address, lat, lon, radiusMeters = 300) {
  if (!lat || !lon) {
    return { available: false, entries: [] };
  }

  try {
    const dLat = radiusMeters / 111000;
    const dLon = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));

    const bbox = {
      xmin: lon - dLon,
      ymin: lat - dLat,
      xmax: lon + dLon,
      ymax: lat + dLat,
      spatialReference: { wkid: 4326 }
    };

    const params = new URLSearchParams({
      where: '1=1',
      geometry: JSON.stringify(bbox),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outFields: 'CASE_ID,STATUS,REPORTED_DATE,STATUS_DATE,REQUEST_TYPE,REQUEST_CATEGORY,REQUEST_SUBCATEGORY,STREET,CITY,ZIP,LATITUDE,LONGITUDE,DEPARTMENT_NAME,DIVISION_NAME,TEAM_NAME,SECTION_NAME,COUNCILDISTRICT,REQUEST_MODIFIED',
      orderByFields: 'REPORTED_DATE DESC',
      resultRecordCount: '50',
      returnGeometry: 'false',
      f: 'json'
    });

    const response = await fetch(`${API_URLS.COLUMBUS_311}?${params}`);
    const data = await response.json();

    if (data.error) {
      console.warn('311 query error:', data.error);
      return { available: false, entries: [] };
    }

    const entries = (data.features || []).map(f => ({
      case_id: f.attributes.CASE_ID,
      type: f.attributes.REQUEST_TYPE,
      category: f.attributes.REQUEST_CATEGORY,
      subcategory: f.attributes.REQUEST_SUBCATEGORY,
      status: f.attributes.STATUS,
      reported_date: f.attributes.REPORTED_DATE,
      status_date: f.attributes.STATUS_DATE,
      street: f.attributes.STREET,
      city: f.attributes.CITY,
      zip: f.attributes.ZIP,
      lat: f.attributes.LATITUDE,
      lon: f.attributes.LONGITUDE,
      department: f.attributes.DEPARTMENT_NAME,
      division: f.attributes.DIVISION_NAME,
      team: f.attributes.TEAM_NAME,
      section: f.attributes.SECTION_NAME,
      council_district: f.attributes.COUNCILDISTRICT,
      modified_date: f.attributes.REQUEST_MODIFIED
    }));

    return { available: true, entries };
  } catch (e) {
    console.warn('311 query failed:', e);
    return { available: false, entries: [] };
  }
}

export async function fetchCodeEnforcement(parcelId) {
  if (!parcelId) return { available: false, entries: [] };

  const cleanParcelId = parcelId.replace(/-/g, '');

  try {
    const params = new URLSearchParams({
      where: `B1_PARCEL_NBR = '${cleanParcelId}'`,
      outFields: 'B1_ALT_ID,B1_PER_TYPE,B1_PER_SUB_TYPE,B1_PER_CATEGORY,B1_APPL_STATUS,B1_FILE_DD,INSP_LAST_DATE,INSP_LAST_RESULT,SITE_ADDRESS,ACA_URL',
      orderByFields: 'B1_FILE_DD DESC',
      resultRecordCount: '25',
      returnGeometry: 'false',
      f: 'json'
    });

    const url = `${API_URLS.CODE_ENFORCEMENT}?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { available: false, entries: [], error: `HTTP ${response.status}` };
    }
    const data = await response.json();

    if (data.error) {
      return { available: false, entries: [], error: data.error.message || JSON.stringify(data.error) };
    }

    const entries = (data.features || []).map(f => ({
      case_id: f.attributes.B1_ALT_ID,
      type: f.attributes.B1_PER_TYPE,
      subtype: f.attributes.B1_PER_SUB_TYPE,
      category: f.attributes.B1_PER_CATEGORY,
      status: f.attributes.B1_APPL_STATUS,
      filed_date: f.attributes.B1_FILE_DD,
      last_insp_date: f.attributes.INSP_LAST_DATE,
      last_insp_result: f.attributes.INSP_LAST_RESULT,
      address: f.attributes.SITE_ADDRESS,
      url: f.attributes.ACA_URL
    }));

    return { available: true, entries };
  } catch (e) {
    return { available: false, entries: [], error: e.message };
  }
}
