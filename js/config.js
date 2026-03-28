export const API_URLS = {
  PARCEL_FEATURES: 'https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/FeatureServer/0/query',
  AUDITOR: 'https://audr-api.franklincountyohio.gov/v1/parcel',
  OVERPASS: 'https://overpass-api.de/api/interpreter',
  NOMINATIM: 'https://nominatim.openstreetmap.org/search',
  PROPERTY_CARD: 'https://audr-apps.franklincountyohio.gov/Redir/Link/Parcel/',
  COLUMBUS_311: 'https://gis.columbus.gov/arcgis/rest/services/Applications/Neighborhood/MapServer/7/query',
  CODE_ENFORCEMENT: 'https://maps2.columbus.gov/arcgis/rest/services/Schemas/BuildingZoning/MapServer/23/query',
};

export const CACHE_TTL = 86_400_000;

export const CLASS_CODES = {
  600: { label: 'Federal',         color: '#6b7280', risk: 'med',   desc: 'Federal government property' },
  605: { label: 'Land Bank/CLRC',  color: '#2dd4bf', risk: 'low',   desc: 'County Land Reutilization Corp' },
  610: { label: 'State of Ohio',   color: '#58a6ff', risk: 'med',   desc: 'State of Ohio property' },
  620: { label: 'Franklin County', color: '#8b5cf6', risk: 'med',   desc: 'County-owned property' },
  630: { label: 'Township',        color: '#a78bfa', risk: 'med',   desc: 'Township property' },
  640: { label: 'Municipal',       color: '#3fb950', risk: 'low',   desc: 'City-owned. CPD trespass auth rarely filed' },
  650: { label: 'School District', color: '#f85149', risk: 'avoid', desc: 'Board of Education. AVOID - active enforcement' },
  660: { label: 'Metro Parks',     color: '#22c55e', risk: 'med',   desc: 'Park District public land' },
  670: { label: 'School/College',  color: '#f97316', risk: 'med',   desc: 'College/Academy/Private School' },
  680: { label: 'Charity/Hospital', color: '#9ca3af', risk: 'med',  desc: 'Charitable, Hospital, Homes for Aged' },
};

export const getClassInfo = code => CLASS_CODES[code] || { label: `Code ${code}`, color: '#6b7280', risk: 'med', desc: 'Unknown' };

export const riskLevel = classcd => getClassInfo(classcd).risk;

export const riskText = r => ({
  low: '🟢 LOW',
  med: '🟡 MED',
  avoid: '🔴 AVOID',
  high: '🔴 HIGH'
}[r] || '❓');

export const riskDescription = r => ({
  low: 'City-owned or land bank. CPD trespass auth required, rarely filed.',
  med: 'Other public entity. Verify before use.',
  avoid: 'School district. Active enforcement - AVOID.',
  high: 'Private property. Avoid.'
}[r] || '');

export const RESOURCE_TYPES = {
  bus:          { label: 'Bus Stop',        icon: '🚌', overpass: 'node["highway"="bus_stop"]' },
  water:        { label: 'Drinking Water',  icon: '💧', overpass: 'node["amenity"="drinking_water"]' },
  toilet:       { label: 'Restroom',        icon: '🚻', overpass: 'node["amenity"="toilets"]' },
  shelter:      { label: 'Shelter',         icon: '🏠', overpass: 'node["social_facility"="shelter"]' },
  food_bank:    { label: 'Food Bank',       icon: '🥫', overpass: 'node["amenity"="food_bank"],node["social_facility"="food_bank"]' },
  hospital:     { label: 'Hospital/Clinic', icon: '🏥', overpass: 'node["amenity"="hospital"],node["amenity"="clinic"]' },
  pharmacy:     { label: 'Pharmacy',        icon: '💊', overpass: 'node["amenity"="pharmacy"]' },
  mental_health:{ label: 'Mental Health',   icon: '🧠', overpass: 'node["amenity"="mental_health"],node["amenity"="social_facility"],node["healthcare"="counselling"]' },
  library:      { label: 'Library',         icon: '📚', overpass: 'node["amenity"="library"]' },
  laundry:      { label: 'Laundromat',      icon: '👕', overpass: 'node["shop"="laundry"],node["shop"="dry_cleaning"]' },
  power:        { label: 'Charging',        icon: '⚡', overpass: 'node["amenity"="charging_station"]' },
  wifi:         { label: 'Free WiFi',       icon: '📶', overpass: 'node["internet_access"="wlan"]' },
  dog_park:     { label: 'Dog Park',        icon: '🐕', overpass: 'node["leisure"="dog_park"],way["leisure"="dog_park"]' },
  police:       { label: 'Police Station',  icon: '🚔', overpass: 'node["amenity"="police"]' },
  mcdonalds:    { label: "McDonald's",      icon: '🍔', overpass: 'node["amenity"="fast_food"]["brand"="McDonald\'s"],node["name"~"McDonald"]' },
  speedway:     { label: 'Speedway',        icon: '⛽', overpass: 'node["brand"="Speedway"],node["amenity"="fuel"]["name"~"Speedway"]' },
  sheetz:       { label: 'Sheetz',          icon: '🛒', overpass: 'node["brand"="Sheetz"],node["amenity"="fuel"]["name"~"Sheetz"]' },
  aldi:         { label: 'Aldi',            icon: '🛒', overpass: 'node["shop"="supermarket"]["brand"~"ALDI"],node["name"~"ALDI"]' },
  kroger:       { label: 'Kroger',          icon: '🛒', overpass: 'node["shop"="supermarket"]["brand"~"Kroger"],node["name"~"Kroger"]' },
  dollar_store: { label: 'Dollar Store',    icon: '💵', overpass: 'node["shop"="variety_store"],node["name"~"Dollar Tree"],node["name"~"Dollar General"],node["name"~"Family Dollar"]' },
  big_lots:     { label: 'Big Lots',        icon: '📦', overpass: 'node["shop"="variety_store"]["brand"~"Big Lots"],node["name"~"Big Lots"]' },
  walmart:      { label: 'Walmart',         icon: '🏬', overpass: 'node["shop"="supermarket"]["brand"~"Walmart"],node["shop"="department_store"]["brand"~"Walmart"],node["name"~"Walmart"]' },
  target:       { label: 'Target',          icon: '🎯', overpass: 'node["shop"="department_store"]["brand"~"Target"],node["name"~"Target"]' },
  thrift:       { label: 'Thrift Store',    icon: '👕', overpass: 'node["shop"="charity"],node["shop"="second_hand"],node["name"~"Goodwill"],node["name"~"Salvation Army"]' },
  scrap_yard:   { label: 'Scrap Yard',      icon: '♻️', overpass: 'node["industrial"="scrapyard"],node["recycling:type"="scrap_metal"],node["name"~"scrap"]i' },
  recycling:    { label: 'Recycling Center', icon: '♻️', overpass: 'node["amenity"="recycling"]' },
  pawn_shop:    { label: 'Pawn Shop',       icon: '💰', overpass: 'node["shop"="pawnbroker"]' },
  used_clothes: { label: 'Buy Used Clothes', icon: '👗', overpass: 'node["shop"="clothes"]["second_hand"="yes"],node["name"~"Plato"],node["name"~"Clothes Mentor"]' },
  electronics:  { label: 'Electronics Buy', icon: '📱', overpass: 'node["shop"="electronics"],node["name"~"GameStop"],node["name"~"Best Buy"]' },
  apartments:   { label: 'Apartment Complex', icon: '🏢', overpass: 'way["building"="apartments"],node["building"="apartments"],relation["building"="apartments"]' },
};

export const HARDCODED_RESOURCES = [
  { type: 'shelter', name: "Faith Mission Men's Shelter", address: '315 N 6th St', lat: 39.9689, lon: -82.9955 },
  { type: 'shelter', name: "Faith Mission Women's Shelter", address: '620 N 4th St', lat: 39.9712, lon: -82.9988 },
  { type: 'shelter', name: 'Open Shelter', address: '24 W Starre St', lat: 39.9587, lon: -83.0021, notes: 'Year-round low-barrier' },
  { type: 'shelter', name: 'Community Shelter Board', address: '195 N Grant Ave', lat: 39.9638, lon: -82.9927, notes: 'Coordinated entry' },
  { type: 'food_bank', name: 'Mid-Ohio Foodbank', address: '3960 Brookham Dr', lat: 40.0142, lon: -82.9294 },
  { type: 'food_bank', name: 'Faith Mission Food Pantry', address: '315 N 6th St', lat: 39.9689, lon: -82.9955 },
  { type: 'water', name: 'Columbus Metropolitan Library - Main', address: '96 S Grant Ave', lat: 39.9621, lon: -82.9898, notes: 'Restrooms + water' },
  { type: 'water', name: 'Columbus Metropolitan Library - Franklinton', address: '1061 W Town St', lat: 39.9592, lon: -83.0254 },
  { type: 'water', name: 'Columbus Metropolitan Library - Martin Luther King', address: '1600 E Long St', lat: 39.9634, lon: -82.9746 },
  { type: 'mental_health', name: 'ADAMH Board', address: '447 E Broad St', lat: 39.9631, lon: -82.9865, notes: 'Crisis services' },
  { type: 'mental_health', name: 'Netcare Access', address: '199 S Central Ave', lat: 39.9602, lon: -83.0007, notes: '24/7 crisis' },
];

export const MAP_STYLES = {
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
};

export const DEFAULT_CENTER = { lat: 39.9612, lon: -82.9988 };
export const DEFAULT_ZOOM = 13;
