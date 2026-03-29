# Resources Data Improvement

**Status:** Partial (Phase 1-2 Complete)
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

## Completed Solutions

### Phase 1: Expand Overpass Queries ✅ (2026-03-29)

Added `way[]` variants to all building-based resource types:
- `water`, `toilet`, `shelter`, `food_bank`, `hospital`, `pharmacy`, `mental_health`
- `library`, `laundry`, `power`, `wifi`, `police`, `recycling`, `pawn_shop`
- All brand searches (mcdonalds, speedway, walmart, etc.)

**Result:** Columbus Metropolitan Library now found as `way` type (previously missed).

### Phase 2: Case-Insensitive Brand Regex ✅ (2026-03-29)

Added `i` flag to all brand/name regex patterns:
- `["name"~"McDonald",i]` now matches "MCDONALDS", "mcdonalds", etc.
- Applied to: mcdonalds, speedway, sheetz, aldi, kroger, dollar_store, big_lots, walmart, target, thrift, scrap_yard, used_clothes, electronics

---

## Remaining Solutions (Future)

| Approach | Effort | Impact | Status |
|----------|--------|--------|--------|
| Expand Overpass queries | Low | Medium | ✅ Done |
| Fix case-sensitive regex | Low | Medium | ✅ Done |
| Add more hardcoded resources | Medium | Medium | Pending |
| Use alternative APIs | High | High | Pending |
| Columbus open data import | High | High | Pending |
| Community contribution | Medium | Medium | Pending |

---

## Files Modified

- `js/config.js` - RESOURCE_TYPES updated with way[] variants and case-insensitive regex

---

## Notes

- Overpass API docs: https://wiki.openstreetmap.org/wiki/Overpass_API
- Columbus open data: https://opendata.columbus.gov/
- Franklin County GIS: https://gis.franklincountyohio.gov/
