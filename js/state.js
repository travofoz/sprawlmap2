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
  enabledResourceTypes: [],
  
  ctxLat: 0,
  ctxLon: 0,
  ctxParcelId: null,
};
