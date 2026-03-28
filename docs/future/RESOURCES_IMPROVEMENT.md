# Resources Data Improvement

**Status:** Future
**Priority:** Medium
**Related:** `js/api/resources.js`, `js/config.js` (RESOURCE_TYPES, HARDCODED_RESOURCES)

---

## Problem

Many resource types return few or no results when searching in Columbus OH area.

---

## Root Causes

1. **Sparse OSM data** - Columbus OpenStreetMap has limited tagging for:
   - `drinking_water`
   - `toilets`
   - `shelter`
   - `food_bank`
   - `wifi`
   - `mental_health`

2. **Node-only queries** - Many Overpass queries only search `node[]` but OSM often uses `way[]` for buildings (stores, libraries, hospitals)

3. **Brand regex issues** - Queries like `["name"~"McDonald"]` are case-sensitive and miss variations

4. **Rate limiting** - Overpass API has aggressive rate limits (429 errors)

5. **Limited hardcoded fallbacks** - Only 11 hardcoded Columbus resources exist

---

## Potential Solutions

| Approach | Effort | Impact | Notes |
|----------|--------|--------|-------|
| Expand Overpass queries | Low | Medium | Add `way[]` and `relation[]` to queries |
| Add more hardcoded resources | Medium | Medium | Manual research for Columbus area |
| Use alternative APIs | High | High | Google Places, Foursquare, Yelp (requires API keys) |
| Columbus open data import | High | High | City has open data portals |
| Community contribution | Medium | Medium | Allow users to submit resources |

---

## Files to Modify

- `js/config.js` - RESOURCE_TYPES, HARDCODED_RESOURCES
- `js/api/resources.js` - Overpass query logic, batching

---

## Notes

- Overpass API docs: https://wiki.openstreetmap.org/wiki/Overpass_API
- Columbus open data: https://opendata.columbus.gov/
- Franklin County GIS: https://gis.franklincountyohio.gov/
