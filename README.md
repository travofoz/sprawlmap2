# Sprawlmap
**Public land finder — Columbus, OH. Humanitarian field tool.**

Identifies city-owned, land bank, and public parcels. Overlays resources (bus, laundry, water, power, mental health, food, shelters). Natural language AI queries via any provider.

No backend. No required API keys. Free to deploy.

## Live Site

**https://travofoz.github.io/sprawlmap**

## Deploy to GitHub Pages

1. Push to `master` branch
2. Repo → Settings → Pages → Source: `Deploy from a branch`
3. Branch: `master` / `(root)` → Save
4. Live at `https://{username}.github.io/sprawlmap`

Already enabled? Just push — it auto-deploys on commit.

## Local Development

```bash
cd sprawlmap
python -m http.server 8000
# open http://localhost:8000
```

No build step required. Works in any browser with JS enabled.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Map UI — standalone, no build step |
| `api.js` | Query engine — importable ES module |
| `providers.js` | Multi-LLM adapter |
| `tools.json` | OpenAI-compatible tool schema for agents |
| `scripts/fetch_parcels.js` | Nightly data refresh (Node 18+) |
| `.github/workflows/refresh.yml` | GH Action cron |
| `CHANGELOG.md` | Version history |

## AI Providers Supported

Anthropic, OpenAI, xAI Grok, OpenRouter (incl. GLM), Cloudflare AI, self-hosted proxy.

**Free fallback**: OpenRouter Llama 3 8B — no key needed.

## LLM Agent Usage

Point any tool-calling LLM at `tools.json`. Works with opencode + GLM out of the box.

```javascript
import { dispatch } from './api.js';
const result = await dispatch('findPublicParcels', {lat: 39.96, lon: -82.99});
```

## Risk Levels

| Risk | LUC | Meaning |
|------|-----|---------|
| LOW | 640, 605 | City of Columbus / Land Bank. CPD trespass auth required, rarely filed. |
| MED | 610, 620, 630, 660, 670, 680 | Other public entities. Verify before use. |
| AVOID | 650 | School district. Active enforcement. |
| HIGH | All others | Private property. Avoid. |

## Data Sources

- Franklin County Auditor GIS — nightly refresh via GH Actions
- OpenStreetMap Overpass — realtime
- Nominatim — free geocoding

## API Endpoints Used

| Service | URL |
|---------|-----|
| Parcels | `https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/FeatureServer/0/query` |
| Auditor | `https://audr-api.franklincountyohio.gov/v1/parcel/{pin}` |
| Overpass | `https://overpass-api.de/api/interpreter` |
| Nominatim | `https://nominatim.openstreetmap.org/search` |

*Built for people who need it.*
