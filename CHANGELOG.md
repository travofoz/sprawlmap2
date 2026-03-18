# Changelog

## [0.2.0] - Code Review Fixes

### Code Review Findings

**What was solid:**
- Multi-LLM support in `providers.js`
- LocalStorage caching with 24h TTL
- GH Actions nightly refresh
- Free OpenRouter fallback

**Issues found:**

| Issue | Severity |
|-------|----------|
| Code duplication between `index.html` inline script and `api.js` | Major |
| Inconsistent LUC labels between files | Minor |
| No parcel polygons on map (`returnGeometry: false`) | Major |
| School district (650) not flagged as AVOID | Medium |
| Owner name filter instead of USECD filter | Medium |
| Missing hardcoded Columbus resources | Medium |

---

### Fixes Applied

#### `api.js` — Single source of truth

- **Consolidated exports**: `LUC_LABELS`, `PUBLIC_KEYWORDS`, `RESOURCE_TYPES`, `HARDCODED_RESOURCES`
- **Risk classification**: `riskLevel()` now returns `'avoid'` for USECD 650 (school district)
- **Hardcoded resources**: Added Columbus-specific shelters, ADAMH, libraries, food banks
- **Geometry support**: `findPublicParcels({includeGeometry: true})` returns polygon data
- **Risk descriptions**: `riskDescription()` explains each risk level

#### `index.html` — Now imports from api.js

- Removed duplicated constants and functions
- Uses ES module imports from `api.js`
- **Parcel polygons**: Renders on map with color-coded fill
- **Risk badges**: Shows 🟢 LOW / 🟡 MED / 🔴 AVOID / 🔴 HIGH
- **Risk descriptions**: Displayed in parcel cards

#### `scripts/fetch_parcels.js`

- Changed filter from owner name keywords to `USECD >= 600 AND USECD < 700`
- Added `risk_counts` to output GeoJSON
- School district (650) flagged as `avoid`

#### `tools.json`

- Added `avoid` risk level
- Added LUC codes reference
- Updated descriptions

---

### Risk Levels (Updated)

| Risk | CLASSCD | Meaning |
|------|-------|---------|
| `low` | 640, 605 | City/Land Bank. CPD trespass auth required, rarely filed. **SAFEST** |
| `med` | 610, 620, 630, 660, 670, 680 | Other public entities. Verify before use. |
| `avoid` | 650 | School district. Active enforcement. **DO NOT RECOMMEND** |
| `high` | Private | Private property. Avoid. |

---

### Files Changed

```
api.js                   +275 lines
index.html               refactored
scripts/fetch_parcels.js USECD filter, risk_counts
tools.json               updated schema
```

### Commit

```
6a37401 refactor: consolidate code, add parcel polygons, flag school district as AVOID
```

Branch: `fix/refactor-consolidate`
