# Sprawlmap Enhancement Plan

## Issues Identified

### 1. Wrong Field Name (CRITICAL)
**Problem**: Code uses `USECD` but it's always null. The actual classification is in `CLASSCD`.

**Discovery**:
```
USECD = null (always)
CLASSCD = "640", "605", "650", etc. ← This is what we need
CLASSDSCRP = "EXEMPT PROPERTY OWNED BY MUNICIPALS" ← Human readable
```

**Fix**: Change all `USECD` references to `CLASSCD` in api.js and fetch_parcels.js.

---

### 2. Debug Assistant - How It Works

**Current implementation**:
- Uses the same `providers.js` multi-LLM system as the main Ask feature
- API key stored in `localStorage` as `key_{provider}` (e.g., `key_openrouter`)
- Client-side only, never sent to any server except the LLM API

**To use GLM**:
1. Tap ⚙️ Settings
2. Select Provider: `OpenRouter`
3. Model: `zhipu/glm-4-plus` (or any GLM model)
4. API Key: Your OpenRouter key (get free at openrouter.ai)
5. Save

**Security**: Keys stored in browser localStorage. Only visible to code running in same origin. Not sent to GitHub or anywhere else.

---

### 3. Search Improvements Needed

| Feature | Current | Needed |
|---------|---------|--------|
| Radius | Fixed 0.5mi | User-selectable: 0.25, 0.5, 1, 2 miles |
| Filters | Owner name keywords | Filter by CLASSCD (640, 605, etc.) |
| Sort | By risk only | By distance, risk, acres, class |

---

### 4. Resource Labels Missing

**Problem**: Resources show icon but no type label. User can't tell what 📍 vs 🚌 means.

**Fix**: Add type label to resource cards:
```
🚌 Bus Stop - High St & Broad St
💧 Drinking Water - Columbus Library
```

---

### 5. Parcel-Map Interaction

| Action | Current | Needed |
|--------|---------|--------|
| Click parcel in list | Nothing | Highlight polygon on map, pan to center |
| Click parcel on map | Popup only | Also scroll to card in list, highlight card |
| Selected state | None | Visual highlight (thicker border, glow) |

---

## Implementation Plan

### Phase 1: Fix CLASSCD Field (Critical)

**Files**: `api.js`, `scripts/fetch_parcels.js`, `tools.json`

1. Replace all `USECD` with `CLASSCD`
2. Update `outFields` to include `CLASSCD, CLASSDSCRP`
3. Update risk classification to use CLASSCD
4. Update LUC_LABELS to match CLASSDSCRP values
5. Test query: `CLASSCD IN ('640','605','610','620','630','650','660')`

---

### Phase 2: Search UI Improvements

**File**: `index.html`

1. Add radius selector above Search button:
   ```html
   <select id="radiusSel">
     <option value="0.25">0.25 mi</option>
     <option value="0.5" selected>0.5 mi</option>
     <option value="1">1 mi</option>
     <option value="2">2 mi</option>
   </select>
   ```

2. Add filter toggles:
   ```html
   <div id="filters">
     <label><input type="checkbox" checked data-class="640"> Municipal (640)</label>
     <label><input type="checkbox" checked data-class="605"> Land Bank (605)</label>
     <label><input type="checkbox" data-class="610"> County (610)</label>
     <label><input type="checkbox" data-class="620"> State (620)</label>
     <label><input type="checkbox" data-class="650" class="avoid"> School (650) ⚠️</label>
   </div>
   ```

3. Add sort dropdown:
   ```html
   <select id="sortSel">
     <option value="risk">Sort by Risk</option>
     <option value="distance">Sort by Distance</option>
     <option value="acres">Sort by Acres</option>
     <option value="class">Sort by Class</option>
   </select>
   ```

---

### Phase 3: Resource Labels

**File**: `index.html` (displayResources function)

1. Add type label to resource cards:
   ```javascript
   c.innerHTML = `
     <h3>${r.icon} ${RESOURCE_TYPES[r.type]?.label || r.type} - ${r.name}</h3>
     ...
   `;
   ```

2. Add resource type legend to Resources tab header

---

### Phase 4: Parcel-Map Interaction

**File**: `index.html`

1. **Click parcel card → highlight on map**:
   ```javascript
   card.onclick = () => {
     // Clear previous highlight
     // Find polygon by parcel_id
     // Set style to highlighted
     // Pan map to polygon center
     // Scroll card into view
   };
   ```

2. **Click polygon on map → highlight card**:
   ```javascript
   polygon.on('click', () => {
     // Add 'selected' class to matching card
     // Scroll card into view
     // Open panel if closed
   });
   ```

3. **Visual highlight styles**:
   ```css
   .card.selected { border-width: 4px; box-shadow: 0 0 12px #58a6ff; }
   .polygon-selected { weight: 4; fillOpacity: 0.4; }
   ```

4. **Store polygon reference on card** and **store parcel_id on polygon**

---

### Phase 5: Distance Calculation

**File**: `api.js`

1. Calculate distance from map center to each parcel centroid
2. Add `dist_miles` to parcel object
3. Sort by distance when sort dropdown = "distance"

---

## Data Model Reference

### ArcGIS Field Mapping (CORRECTED)

| Field | Alias | Example Values |
|-------|-------|----------------|
| `CLASSCD` | Property Class Code | "640", "605", "650" |
| `CLASSDSCRP` | Property Class Description | "EXEMPT PROPERTY OWNED BY MUNICIPALS" |
| `OWNERNME1` | Owner Name 1 | "CITY OF COLUMBUS" |
| `PARCELID` | Parcel ID | "230-000116" |
| `SITEADDRESS` | Site Address | "7336 JACKSON PI" |
| `ACRES` | GIS Acres | 2.24 |
| `TOTVALUEBASE` | Base Total Value | 0 (for exempt) |
| `SALEDATE` | Sale Date | timestamp (ms) |
| `ZIPCD` | Zip Code | "43215" |

### CLASSCD Codes (Property Class)

| Code | Description | Risk |
|------|-------------|------|
| 640 | Exempt - Municipals | LOW |
| 605 | Exempt - County Land Reutilization | LOW |
| 610 | Exempt - State | MED |
| 620 | Exempt - County | MED |
| 630 | Exempt - Township | MED |
| 650 | Exempt - School District | AVOID |
| 660 | Exempt - Other | MED |
| 670 | Exempt - Religious/Charitable | MED |
| 680 | Exempt - Other | MED |

---

## Questions for User

Before implementing, please confirm:

1. **API Key storage**: Is localStorage acceptable? Or do you want a different approach?

2. **Default filters**: Should 650 (School District) be unchecked by default since it's AVOID?

3. **Resource types**: Do you want all 13 resource types shown, or a subset? Currently:
   - bus, laundry, water, power, mental_health, toilet, food_bank, shelter, dog_park, wifi, hospital, pharmacy, library

4. **Hardcoded resources**: Should I add more Columbus-specific locations to the hardcoded list?

5. **Map click behavior**: When clicking a parcel on map, should it:
   - A) Just highlight and show popup (current)
   - B) Highlight, show popup, AND scroll to card
   - C) Highlight, scroll to card, close popup

---

## Estimated Changes

| File | Lines Changed | Complexity |
|------|---------------|------------|
| api.js | ~30 | Low (field rename) |
| index.html | ~100 | Medium (UI + interaction) |
| fetch_parcels.js | ~10 | Low (field rename) |
| tools.json | ~5 | Low |

**Total**: ~145 lines across 4 files
