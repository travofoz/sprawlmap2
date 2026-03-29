export const state = {
  curLat: 39.9612,
  curLon: -82.9988,
  gpsLat: null,
  gpsLon: null,
  searchCenter: null,
  
  userMarker: null,
  centerMarker: null,
  parcelPolygons: {},
  resourceMarkers: {},
  
  currentParcels: [],
  selectedParcelId: null,
  
  inspectorMode: false,
  currentInspectorParcel: null,
  currentInspectorNeighbors: [],
  current311Reports: [],
  currentCodeEnforcement: { available: false, entries: [] },
  
  enabledClasses: ['640', '605'],
  resourceSettings: {},
  loadedResources: {},
  
  ctxLat: 0,
  ctxLon: 0,
  ctxParcelId: null,
};

export function initResourceSettings(RESOURCE_TYPES, DEFAULT_RESOURCE_RADII) {
  const saved = localStorage.getItem('resourceSettings');
  if (saved) {
    try {
      state.resourceSettings = JSON.parse(saved);
    } catch {
      state.resourceSettings = {};
    }
  }
  
  for (const type of Object.keys(RESOURCE_TYPES)) {
    if (!state.resourceSettings[type]) {
      state.resourceSettings[type] = {
        enabled: false,
        radius: DEFAULT_RESOURCE_RADII[type] || 0.5,
        loaded: false,
        count: 0
      };
    }
  }
}

export function saveResourceSettings() {
  localStorage.setItem('resourceSettings', JSON.stringify(state.resourceSettings));
}

export function getResourceSettings(type) {
  return state.resourceSettings[type] || { enabled: false, radius: 0.5, loaded: false, count: 0 };
}

export function setResourceSettings(type, settings) {
  state.resourceSettings[type] = { ...state.resourceSettings[type], ...settings };
  saveResourceSettings();
}
