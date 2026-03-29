import { state } from '../state.js';
import { getMap } from '../map.js';
import { setStatus } from '../utils.js';
import * as searchManager from '../search/manager.js';
import { showNewSearchModal } from '../search/ui.js';

export function initContextMenu() {
  const map = getMap();
  const ctxMenu = document.getElementById('ctx-menu');
  
  if (!map || !ctxMenu) return;

  map.on('contextmenu', e => {
    e.originalEvent.preventDefault();

    state.ctxLat = e.latlng.lat;
    state.ctxLon = e.latlng.lng;

    const clickedLayer = findParcelAtLatLng(e.latlng);
    state.ctxParcelId = clickedLayer?.feature?.properties?.PARCELID || null;

    ctxMenu.style.left = `${e.originalEvent.clientX}px`;
    ctxMenu.style.top = `${e.originalEvent.clientY}px`;
    ctxMenu.classList.add('show');
  });

  document.addEventListener('click', () => {
    ctxMenu.classList.remove('show');
  });

  document.getElementById('ctx-set-center')?.addEventListener('click', setSearchCenter);
  document.getElementById('ctx-property-card')?.addEventListener('click', openPropertyCard);
  document.getElementById('ctx-copy-coords')?.addEventListener('click', copyCoords);
  document.getElementById('ctx-zoom-in')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('ctx-zoom-out')?.addEventListener('click', () => map.zoomOut());
}

function findParcelAtLatLng(latlng) {
  for (const [pid, layer] of Object.entries(state.parcelPolygons)) {
    if (pointInPolygon([latlng.lat, latlng.lng], layer)) {
      return layer;
    }
  }
  return null;
}

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  const coords = polygon.getLatLngs()[0];
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lat, yi = coords[i].lng;
    const xj = coords[j].lat, yj = coords[j].lng;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function setSearchCenter() {
  const map = getMap();
  
  showNewSearchModal({
    lat: state.ctxLat,
    lon: state.ctxLon,
    source: 'map-click'
  });
  
  document.getElementById('ctx-menu')?.classList.remove('show');
}

function openPropertyCard() {
  if (state.ctxParcelId) {
    const url = `https://property.franklincountyauditor.com/_web/propertycard/propertycard.aspx?pin=${state.ctxParcelId}`;
    window.open(url, '_blank');
  } else {
    setStatus('⚠️ No parcel at this location');
  }
  document.getElementById('ctx-menu')?.classList.remove('show');
}

function copyCoords() {
  navigator.clipboard.writeText(`${state.ctxLat.toFixed(6)}, ${state.ctxLon.toFixed(6)}`);
  setStatus('📋 Coordinates copied');
  document.getElementById('ctx-menu')?.classList.remove('show');
}
