# Sprawlmap Enhancement Plan (Revised)

## Critical Bug Fix

### Wrong Field Name
**Problem**: Code uses `USECD` but it's always null. The actual classification is in `CLASSCD`.

```
USECD = null (always)
CLASSCD = "640", "605", "650", etc. ← This is what we need
CLASSDSCRP = "EXEMPT PROPERTY OWNED BY MUNICIPALS" ← Human readable
```

---

## Feature Requirements

### 1. Distance from GPS (IMPORTANT)
- Calculate distance from **user's GPS location** (not map center)
- Show distance in parcel cards
- Sort by distance option
- If no GPS lock, fall back to map center with "(from map center)" label

### 2. Multi-Filter for CLASSCD
- User selects which classes to show (checkboxes)
- Multiple selections allowed
- Default: 640, 605 checked; 650 unchecked (AVOID)
- Filters apply to both map polygons AND list

### 3. GLM Direct Integration (Not OpenRouter)
- Add GLM as a direct provider option
- API endpoint: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- Model: `glm-4-plus` (or user-selectable)
- Requires user's GLM API key (from open.bigmodel.cn)
- Store key in localStorage like other providers

### 4. Legend for Shading/Colors
- Always-visible legend showing what colors mean
- Toggleable (can collapse)
- Shows all CLASSCD types with their colors

### 5. Hide/Show Types (Reduce Visual Noise)
- Same checkboxes that filter also hide/show on map
- When unchecked: remove polygons from map
- When checked: add polygons back
- Independent of list filter (can show on map but not in list, or vice versa)

---

## CLASSCD Reference (with Colors)

| Code | Description | Color | Risk | Default |
|------|-------------|-------|------|---------|
| 640 | Municipal (City) | 🟢 Green | LOW | ✅ ON |
| 605 | Land Bank/CLRC | 🟢 Teal | LOW | ✅ ON |
| 610 | State | 🔵 Blue | MED | OFF |
| 620 | County | 🔵 Indigo | MED | OFF |
| 630 | Township | 🟣 Purple | MED | OFF |
| 650 | School District | 🔴 Red | AVOID | ❌ OFF |
| 660 | Metro Parks/COTA | 🟡 Yellow | MED | OFF |
| 670 | Religious/Charitable | ⚪ Gray | MED | OFF |
| 680 | Other Exempt | ⚪ Light Gray | MED | OFF |

---

## Implementation Plan

### Phase 1: Fix CLASSCD Field (Critical)

**Files**: `api.js`, `scripts/fetch_parcels.js`

1. Replace all `USECD` references with `CLASSCD`
2. Update `outFields` to include `CLASSCD, CLASSDSCRP`
3. Update risk classification to use CLASSCD
4. Update LUC_LABELS to match CLASSCD values
5. Query filter: `CLASSCD IN ('640','605','610',...)`

---

### Phase 2: GLM Direct Provider

**File**: `providers.js`

Add GLM provider:

```javascript
glm: {
  label: 'GLM (Zhipu AI)',
  models: ['glm-4-plus', 'glm-4', 'glm-4-flash', 'glm-3-turbo'],
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  keyHint: 'Get key at open.bigmodel.cn',
  chat: async (msgs, sys, key, model) => {
    const r = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'glm-4-plus',
        messages: [{role: 'system', content: sys}, ...msgs]
      })
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content || d.error?.message || 'No response';
  }
}
```

---

### Phase 3: Multi-Filter UI + Legend

**File**: `index.html`

1. **Filter Panel** (collapsible, above Search button):

```html
<div id="filter-panel">
  <div id="filter-header" onclick="toggleFilters()">
    <span>Filters</span>
    <span id="filter-toggle">▼</span>
  </div>
  <div id="filter-content">
    <div class="filter-group">
      <label class="filter-row low">
        <input type="checkbox" checked data-class="640">
        <span class="color-dot green"></span>
        Municipal (640)
      </label>
      <label class="filter-row low">
        <input type="checkbox" checked data-class="605">
        <span class="color-dot teal"></span>
        Land Bank (605)
      </label>
      <label class="filter-row med">
        <input type="checkbox" data-class="610">
        <span class="color-dot blue"></span>
        State (610)
      </label>
      <label class="filter-row med">
        <input type="checkbox" data-class="620">
        <span class="color-dot indigo"></span>
        County (620)
      </label>
      <label class="filter-row med">
        <input type="checkbox" data-class="630">
        <span class="color-dot purple"></span>
        Township (630)
      </label>
      <label class="filter-row avoid">
        <input type="checkbox" data-class="650">
        <span class="color-dot red"></span>
        School (650) ⚠️ AVOID
      </label>
      <label class="filter-row med">
        <input type="checkbox" data-class="660">
        <span class="color-dot yellow"></span>
        Metro Parks (660)
      </label>
      <label class="filter-row med">
        <input type="checkbox" data-class="670">
        <span class="color-dot gray"></span>
        Religious (670)
      </label>
      <label class="filter-row med">
        <input type="checkbox" data-class="680">
        <span class="color-dot lightgray"></span>
        Other Exempt (680)
      </label>
    </div>
    <div class="filter-actions">
      <button onclick="selectAll()">Select All</button>
      <button onclick="selectNone()">Select None</button>
      <button onclick="selectRecommended()">Recommended</button>
    </div>
  </div>
</div>
```

2. **Legend** (always visible, collapsible):

```html
<div id="legend">
  <div id="legend-header" onclick="toggleLegend()">
    <span>🗺️ Legend</span>
    <span id="legend-toggle">▼</span>
  </div>
  <div id="legend-content">
    <div class="legend-row"><span class="color-box green"></span> LOW Risk - City/Land Bank</div>
    <div class="legend-row"><span class="color-box yellow"></span> MED Risk - Other Public</div>
    <div class="legend-row"><span class="color-box red"></span> AVOID - School District</div>
  </div>
</div>
```

3. **Radius Selector**:

```html
<select id="radiusSel">
  <option value="0.25">0.25 mi</option>
  <option value="0.5" selected>0.5 mi</option>
  <option value="1">1 mi</option>
  <option value="2">2 mi</option>
  <option value="5">5 mi</option>
</select>
```

4. **Sort Dropdown**:

```html
<select id="sortSel">
  <option value="distance">Distance</option>
  <option value="risk">Risk Level</option>
  <option value="acres">Acres (largest)</option>
  <option value="class">Class Code</option>
</select>
```

---

### Phase 4: Distance from GPS

**File**: `api.js`, `index.html`

1. Store GPS coordinates when location obtained:
```javascript
let gpsLat = null, gpsLon = null;
// On GPS success:
gpsLat = pos.coords.latitude;
gpsLon = pos.coords.longitude;
```

2. Calculate distance for each parcel:
```javascript
// Get parcel centroid from geometry
const centroid = getPolygonCenter(parcel.geometry);
const distMiles = distMiles(gpsLat, gpsLon, centroid.lat, centroid.lon);
parcel.dist_miles = distMiles;
parcel.dist_label = gpsLat ? `${distMiles.toFixed(2)} mi` : `${distMiles.toFixed(2)} mi (from map)`;
```

3. Sort by distance:
```javascript
if (sortBy === 'distance') {
  parcels.sort((a, b) => (a.dist_miles || 999) - (b.dist_miles || 999));
}
```

4. Show distance in card:
```html
<b>Distance:</b> ${p.dist_label}
```

---

### Phase 5: Map/List Interaction

**File**: `index.html`

1. **Filter changes → update map**:
```javascript
function updateMapFromFilters() {
  const enabledClasses = [...document.querySelectorAll('[data-class]:checked')]
    .map(cb => cb.dataset.class);

  parcelLayer.eachLayer(layer => {
    if (enabledClasses.includes(layer.feature.properties.CLASSCD)) {
      layer.addTo(parcelLayer);
    } else {
      parcelLayer.removeLayer(layer);
    }
  });
}
```

2. **Click card → highlight polygon**:
```javascript
let selectedPolygon = null;
function selectParcel(parcelId) {
  // Clear previous
  if (selectedPolygon) {
    selectedPolygon.setStyle({weight: 2, fillOpacity: 0.2});
  }
  // Find and highlight
  const polygon = parcelLayers[parcelId];
  if (polygon) {
    polygon.setStyle({weight: 4, fillOpacity: 0.5});
    map.fitBounds(polygon.getBounds());
    selectedPolygon = polygon;
  }
}
```

3. **Click polygon → scroll to card**:
```javascript
polygon.on('click', () => {
  const card = document.querySelector(`[data-parcel-id="${parcelId}"]`);
  if (card) {
    card.scrollIntoView({behavior: 'smooth'});
    card.classList.add('selected');
  }
});
```

---

### Phase 6: Resource Labels

**File**: `index.html`

Add type label to resource cards:
```javascript
const typeLabel = RESOURCE_TYPES[r.type]?.label || r.type;
c.innerHTML = `
  <h3>${r.icon} ${typeLabel}</h3>
  <p><b>${r.name}</b><br>
  ${r.address || ''}<br>
  <small>${r.dist_miles?.toFixed(2) || '?'} mi away</small></p>
`;
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `api.js` | CLASSCD fix, distance calc, filter support |
| `providers.js` | Add GLM direct provider |
| `index.html` | Filter UI, legend, radius, sort, interactions |
| `scripts/fetch_parcels.js` | CLASSCD fix |
| `style.css` (inline) | Filter/legend styles |

---

## UI Mockup

```
┌─────────────────────────────────────┐
│ 🗺 Sprawlmap  [📍 Me] [🔍 Search]  │
├─────────────────────────────────────┤
│ ▼ Filters                    [▼]   │
│ ┌─────────────────────────────────┐ │
│ │ ☑ 🟢 Municipal (640)           │ │
│ │ ☑ 🟢 Land Bank (605)           │ │
│ │ ☐ 🔵 State (610)               │ │
│ │ ☐ 🔵 County (620)              │ │
│ │ ☐ 🔴 School (650) ⚠️ AVOID     │ │
│ │ ...                            │ │
│ │ [All] [None] [Recommended]     │ │
│ └─────────────────────────────────┘ │
│ Radius: [0.5 mi ▼] Sort: [Distance]│
├─────────────────────────────────────┤
│                                     │
│            [MAP]                    │
│                                     │
├─────────────────────────────────────┤
│ ▼ Legend                     [▼]   │
│ 🟢 LOW - City/Land Bank            │
│ 🟡 MED - Other Public              │
│ 🔴 AVOID - School District         │
├─────────────────────────────────────┤
│ ⌄ [Parcels] [Resources] [Ask]      │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 LOW                          │ │
│ │ 123 Main St                     │ │
│ │ City of Columbus | 0.3 mi       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Implementation Order

1. **Phase 1**: Fix CLASSCD (blocking everything)
2. **Phase 2**: Add GLM provider
3. **Phase 3**: Filter UI + Legend + Radius + Sort
4. **Phase 4**: Distance calculation
5. **Phase 5**: Map/List interaction
6. **Phase 6**: Resource labels

---

## Ready to Implement?

Reply with:
- ✅ Go ahead with all phases
- 🔧 Specific phases only
- ❓ Questions

Or just say "do it" and I'll implement everything.
