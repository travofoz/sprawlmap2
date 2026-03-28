# Sprawlmap v2 Refactor Plan (Option A)

Vanilla JS + File Split - modularize existing codebase for GitHub Pages hosting.

---

## Phase 1: Directory Structure

```
sprawlmap2/
├── index.html           (minimal - just loads CSS/JS)
├── css/
│   ├── base.css         (reset, CSS vars, fonts)
│   ├── components.css   (buttons, cards, badges, inputs)
│   ├── layout.css       (bar, panels, map container, legend)
│   └── themes.css       (dark, light, high-contrast)
├── js/
│   ├── config.js        (CLASS_CODES, RESOURCE_TYPES, HARDCODED_RESOURCES)
│   ├── state.js         (all app state variables + setters)
│   ├── map.js           (Leaflet init, tile layers, layer groups)
│   ├── api.js           (existing - minimal changes)
│   ├── providers.js     (existing - no changes)
│   ├── ui/
│   │   ├── panels.js    (bottom panel, tab switching)
│   │   ├── filters.js   (filter panel, class/resource toggles)
│   │   ├── cards.js     (parcel cards, resource cards)
│   │   ├── inspector.js (inspector mode, click handler, render)
│   │   ├── settings.js  (settings panel, display prefs)
│   │   └── context-menu.js (right-click menu)
│   ├── utils.js         (log, setStatus, formatters, $ helper)
│   └── main.js          (init, event wiring, exports to window)
├── data/
│   └── public_parcels.geojson (existing)
├── scripts/
│   └── fetch_parcels.js (existing)
├── tools.json           (existing)
├── README.md
└── CHANGELOG.md
```

---

## Phase 2: File Responsibilities

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `config.js` | ~120 | Export CLASS_CODES, RESOURCE_TYPES, HARDCODED_RESOURCES, MAP_STYLES |
| `state.js` | ~50 | State vars + getters/setters (curLat, curLon, gpsLat, gpsLon, currentParcels, inspectorMode, etc.) |
| `map.js` | ~100 | Leaflet map init, tile layer switching, layer groups (parcelLayerGroup, resourceLayer, inspectorLayerGroup) |
| `api.js` | ~700 | Existing (maybe extract CLASS_CODES to config.js) |
| `providers.js` | ~90 | Existing - unchanged |
| `utils.js` | ~40 | log(), setStatus(), $(), fmtCurrency(), fmtDate(), distMiles() |
| `ui/panels.js` | ~80 | openPanel(), panel toggle, tab switching |
| `ui/filters.js` | ~150 | buildFilterGrid(), buildResourceFilterGrid(), update visibility, filter state |
| `ui/cards.js` | ~120 | displayParcels(), displayResources(), selectParcel() |
| `ui/inspector.js` | ~350 | toggleInspectorMode(), handleInspectorClick(), renderInspectorPanel(), panToNeighbor() |
| `ui/settings.js` | ~100 | Provider/model selects, theme/font/map style, localStorage |
| `ui/context-menu.js` | ~80 | Right-click menu, coordinate actions |
| `main.js` | ~100 | Import all, init(), wire events, expose globals for inline handlers |

---

## Phase 3: Migration Steps

1. **Create directory structure** - `mkdir -p css js/ui`

2. **Extract CSS** - Split `<style>` from index.html into 4 CSS files

3. **Extract config** - Move CLASS_CODES, RESOURCE_TYPES, HARDCODED_RESOURCES, MAP_STYLES to `config.js`

4. **Extract utils** - Move log, setStatus, $, formatters to `utils.js`

5. **Extract state** - Create state module with all module-level variables

6. **Extract map logic** - Map init, tile layers, layer groups to `map.js`

7. **Extract UI modules** - One at a time:
   - filters.js
   - panels.js
   - cards.js
   - inspector.js
   - settings.js
   - context-menu.js

8. **Wire up main.js** - Import all, init function, event listeners

9. **Update index.html** - Minimal HTML + CSS/JS imports

10. **Test** - Verify all features work

11. **Commit** - One commit per phase for easy rollback

---

## Phase 4: Key Decisions

### 1. ES modules vs IIFE?
- **ES modules (recommended)** - native browser support, cleaner imports
- Requires `<script type="module">` - works on GitHub Pages

### 2. State management approach?
- Simple object with getters/setters (recommended)
- Or a tiny pub/sub pattern for reactivity

### 3. Keep inline onclick handlers?
- Current: `onclick="selectAllFilters()"`
- Better: Attach in JS, expose via window for now, clean up later

---

## Estimated Timeline

| Phase | Effort |
|-------|--------|
| Directory + CSS | 15 min |
| Config + Utils | 10 min |
| State + Map | 15 min |
| UI modules (6 files) | 45 min |
| Main.js + HTML cleanup | 15 min |
| Testing + fixes | 20 min |
| **Total** | ~2 hours |

---

## Notes

- Option B (SvelteKit + DaisyUI) can be done later if needed
- This refactor makes any future framework migration easier
- All modules use ES6 import/export
- No build step required - works directly on GitHub Pages
