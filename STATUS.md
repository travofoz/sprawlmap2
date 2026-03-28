# Sprawlmap v2 Refactor Status

**Branch:** `refactor/sprawlmap2-v2`
**Last Commit:** `edb03ef` - "Add STATUS.md for refactor handoff"

---

## Completed

| Task | File(s) | Status |
|------|---------|--------|
| Directory structure | `css/`, `js/api/`, `js/ui/` | ✅ |
| CSS extraction | `css/base.css`, `css/app.css` | ✅ |
| Config module | `js/config.js` | ✅ |
| State module | `js/state.js` | ✅ |
| Utils module | `js/utils.js` | ✅ |
| Map module | `js/map.js` | ✅ |
| API: parcels | `js/api/parcels.js` | ✅ |
| API: resources | `js/api/resources.js` | ✅ |
| API: city | `js/api/city.js` | ✅ |
| UI: filters | `js/ui/filters.js` | ✅ |
| UI: panels | `js/ui/panels.js` | ✅ |
| UI: cards | `js/ui/cards.js` | ✅ |
| UI: inspector | `js/ui/inspector.js` | ✅ |
| UI: settings | `js/ui/settings.js` | ✅ |
| UI: context-menu | `js/ui/context-menu.js` | ✅ |
| Main entry point | `js/main.js` | ✅ |
| HTML cleanup | `index.html` | ✅ |

---

## File Structure (New)

```
sprawlmap2/
├── index.html              (~180 lines, pure HTML)
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
├── providers.js            (unchanged, kept in root)
├── api.js                  (OLD - can be deleted after testing)
└── ...
```

---

## Known Issues to Address

1. **Leaflet global (`L`)** - Modules reference `L` as global. Works since Leaflet loads via `<script>` before `main.js`, but not pure ES modules.

2. **Old files still exist:**
   - `api.js` (root) - should be deleted once new modules verified
   - Inline `<style>` and `<script>` removed from `index.html`

3. **Testing needed** - Load in browser and verify:
   - [ ] GPS location works
   - [ ] Parcel search returns results
   - [ ] Filter toggles work
   - [ ] Parcel selection + highlighting
   - [ ] Inspector mode
   - [ ] 311/code enforcement data
   - [ ] Resource search
   - [ ] Settings panel (theme, map style)
   - [ ] Context menu (right-click)
   - [ ] AI ask feature

---

## For Next Session

```bash
cd /root/sprawlmap2
git log -1  # confirm on 1561994

# Serve locally to test
npx serve .  # or python -m http.server 8000

# After testing passes:
rm api.js  # delete old monolithic file
git add -A && git commit -m "Remove old api.js after refactor"
```

---

## Notes

- `providers.js` kept in root (per plan) - already clean, no changes needed
- All modules use ES6 `import`/`export`
- No build step - works directly on GitHub Pages
- Ready for future SvelteKit migration

---

## Files in Repo (as of commit)

**NEW (from this refactor):**
- `css/base.css`, `css/app.css`
- `js/config.js`, `js/state.js`, `js/utils.js`, `js/map.js`, `js/main.js`
- `js/api/parcels.js`, `js/api/resources.js`, `js/api/city.js`
- `js/ui/filters.js`, `js/ui/panels.js`, `js/ui/cards.js`, `js/ui/inspector.js`, `js/ui/settings.js`, `js/ui/context-menu.js`

**OLD (to delete after testing):**
- `api.js` (root) - replaced by `js/api/*.js`

**UNCHANGED:**
- `providers.js` - LLM provider config (kept as-is)
- `scripts/fetch_parcels.js` - parcel data fetcher
- `data/public_parcels.geojson` - parcel data
- `tools.json` - tool definitions
- `.github/workflows/refresh.yml` - GitHub action
