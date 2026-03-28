export function log(msg, type = 'info') {
  const el = document.getElementById('log');
  if (!el) { console.log(msg); return; }
  const colors = { info: '#8b949e', error: '#f85149', success: '#3fb950', warn: '#eab308' };
  const icons = { info: '•', error: '✗', success: '✓', warn: '!' };
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.innerHTML += `<div style="color:${colors[type] || colors.info}">${icons[type] || '•'} ${time} ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

export function setStatus(s) {
  const el = document.getElementById('status');
  if (el) el.innerHTML = s;
}

export function $(id) {
  const el = document.getElementById(id);
  if (!el) log(`Element not found: ${id}`, 'error');
  return el;
}

export const fmtCurrency = n => n ? '$' + n.toLocaleString() : null;

export const fmtDate = d => d ? new Date(d).toLocaleDateString() : null;

export function distMiles(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function getCentroid(geometry) {
  if (!geometry || !geometry.coordinates || !geometry.coordinates[0]) return null;
  const coords = geometry.coordinates[0];
  const n = coords.length;
  let sumLat = 0, sumLon = 0;
  for (const c of coords) {
    sumLon += c[0];
    sumLat += c[1];
  }
  return { lat: sumLat / n, lon: sumLon / n };
}

export function bboxFromCenter(lat, lon, mi) {
  const d = mi / 69;
  return {
    n: lat + d,
    s: lat - d,
    e: lon + d / Math.cos(lat * Math.PI / 180),
    w: lon - d / Math.cos(lat * Math.PI / 180)
  };
}

export function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}
