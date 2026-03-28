# Sprawlmap v2 Status

**Repo:** https://github.com/travofoz/sprawlmap2
**Live:** https://travofoz.github.io/sprawlmap2/
**Branch:** `refactor/sprawlmap2-v2`

---

## Refactor: COMPLETE ✅

Modular ES modules refactor complete. All 14 modules extracted and working.

---

## File Structure

```
sprawlmap2/
├── index.html              (170 lines, pure HTML)
├── css/
│   ├── base.css            (CSS vars, reset)
│   └── app.css             (components, layout)
├── js/
│   ├── config.js           (CLASS_CODES, RESOURCE_TYPES, API_URLS)
│   ├── state.js            (centralized mutable state)
│   ├── utils.js            (log, setStatus, formatters)
│   ├── map.js              (Leaflet init, layers)
│   ├── main.js             (init, event wiring)
│   ├── api/
│   │   ├── parcels.js      (findPublicParcels, sortParcels, etc.)
│   │   ├── resources.js    (findNearbyResources, scoreLocation)
│   │   └── city.js         (fetch311Data, fetchCodeEnforcement)
│   └── ui/
│       ├── filters.js      (filter grids, visibility)
│       ├── panels.js       (panel/tab management)
│       ├── cards.js        (parcel/resource cards)
│       ├── inspector.js    (inspector mode + render)
│       ├── settings.js     (settings panel)
│       └── context-menu.js (right-click menu)
├── providers.js            (LLM provider config)
├── tools.json              (LLM tool definitions)
├── data/
│   └── public_parcels.geojson
├── scripts/
│   └── fetch_parcels.js
├── docs/
│   ├── done/               (completed planning docs)
│   ├── pending/            (in-progress)
│   └── future/             (ideas, backlog)
└── .github/workflows/
    └── refresh.yml         (auto-refresh parcel data)
```

---

## Features Status

| Feature | Status | Notes |
|---------|--------|-------|
| GPS location | ✅ | |
| Parcel search | ✅ | Franklin County GIS |
| Filter toggles | ✅ | |
| Parcel selection | ✅ | Click to highlight |
| Inspector mode | ✅ | Click parcels for detail |
| 311 data | ✅ | Columbus 311 API |
| Code enforcement | ✅ | Columbus Building/Zoning |
| Resource search | ⚠️ | Limited OSM data - see `docs/future/RESOURCES_IMPROVEMENT.md` |
| Settings panel | ✅ | Theme, font, map style |
| Context menu | ✅ | Right-click on map |
| AI ask | ✅ | Multi-provider LLM |

---

## Known Issues

| Issue | Status | Docs |
|-------|--------|------|
| Resources return few results | Open | `docs/future/RESOURCES_IMPROVEMENT.md` |
| Leaflet `L` is global | Minor | Works, but not pure ES modules |

---

## Notes

- No build step - works directly on GitHub Pages
- All modules use ES6 `import`/`export`
- Ready for future SvelteKit migration if needed
