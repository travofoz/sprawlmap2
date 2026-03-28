import { state } from './state.js';
import { MAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM } from './config.js';

let map = null;
let currentTileLayer = null;
let parcelLayerGroup = null;
let resourceLayer = null;
let inspectorLayerGroup = null;

export function getMap() {
  return map;
}

export function getParcelLayerGroup() {
  return parcelLayerGroup;
}

export function getResourceLayer() {
  return resourceLayer;
}

export function getInspectorLayerGroup() {
  return inspectorLayerGroup;
}

export function initMap() {
  if (typeof L === 'undefined') {
    throw new Error('Leaflet library failed to load');
  }

  map = L.map('map', { zoomControl: false }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lon], DEFAULT_ZOOM);
  
  currentTileLayer = L.tileLayer(MAP_STYLES.osm, {
    attribution: '© OSM',
    maxZoom: 19
  }).addTo(map);
  
  L.control.zoom({ position: 'topright' }).addTo(map);
  
  parcelLayerGroup = L.layerGroup().addTo(map);
  resourceLayer = L.layerGroup().addTo(map);
  inspectorLayerGroup = L.layerGroup().addTo(map);
  
  return map;
}

export function switchTileLayer(style) {
  if (!map || !currentTileLayer) return;
  map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(MAP_STYLES[style] || MAP_STYLES.osm, {
    attribution: style === 'satellite' ? '© Esri' : '© OSM',
    maxZoom: 19
  }).addTo(map);
}

export function getTileLayer() {
  return currentTileLayer;
}
