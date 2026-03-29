# Search Manager - Unified Parametric Search System

**Status:** Planning  
**Priority:** High  
**Branch:** `feature/search-manager`  
**Created:** 2026-03-29

---

## Executive Summary

Replace current separate parcel/resource search UI with a unified **Search Manager** that allows users to create, save, and manage multiple named searches. Each search is a self-contained configuration with cached results, stored in localStorage. Users can browse their search history, favorite important searches, lock them from accidental changes, and quickly reactivate previous searches.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Core Concepts](#core-concepts)
3. [Data Model](#data-model)
4. [UI Components](#ui-components)
5. [User Flows](#user-flows)
6. [Interactions](#interactions)
7. [Technical Implementation](#technical-implementation)
8. [File Structure](#file-structure)
9. [Migration Notes](#migration-notes)
10. [Future Enhancements](#future-enhancements)

---

## Problem Statement

### Current Issues

1. **Lost context**: After a search, filter controls disappear and users can't refine their search
2. **No history**: Users can't save or revisit previous searches
3. **Separate UIs**: Parcels and resources are searched separately with different workflows
4. **No persistence**: Page refresh loses all search state
5. **Poor organization**: Can't compare or switch between different areas/searches

### Proposed Solution

A **Search Manager** that:
- Saves unlimited searches to localStorage
- Combines parcel + resource search into one unified interface
- Supports favorites, locks, and delete
- Uses accordion UI with multiple collapse levels
- Auto-saves on every change
- Auto-names searches based on location
- Allows one active search on map at a time

---

## Core Concepts

### Search Object

A Search is the fundamental unit. It contains:
- **Identity**: id, name, timestamps
- **Location**: lat/lon, source (gps or map-click), address label
- **State**: favorite, locked
- **Parcel config**: enabled class codes, cached results
- **Resource config**: per-type radii, cached results

### Location Sources

The search location can come from:
1. **GPS**: Default on page load, uses device geolocation
2. **Map click**: User right-clicks/long-presses map, selects "Set search center"

### Collapse States

Each search has 3 visual states:
1. **Collapsed (line)**: Just name and summary
2. **Card (metadata)**: Shows controls, metadata, load buttons
3. **Expanded (results)**: Shows all type results in accordion sections

### Auto-Save

Any modification to a search triggers immediate localStorage save:
- Loading parcel/resource data
- Changing radius sliders
- Toggling class codes
- Renaming
- Toggling favorite/lock

Locked searches are read-only and won't auto-save changes.

---

## Data Model

### Search Object Schema

```javascript
{
  // Identity
  id: "uuid-v4-string",
  name: "Downtown Columbus",  // auto-generated or user-edited
  
  // Location
  location: {
    lat: 39.9612,
    lon: -82.9988,
    label: "Downtown Columbus, OH",  // from reverse geocode
    source: "gps"  // "gps" | "map-click"
  },
  
  // Timestamps
  created: "2026-03-29T12:00:00.000Z",
  updated: "2026-03-29T14:30:00.000Z",
  
  // State flags
  favorite: false,
  locked: false,
  
  // Parcel configuration
  parcels: {
    enabled: true,
    classCodes: ["640", "605", "650"],
    radius: 0.5,  // search radius in miles
    results: [
      // Array of parcel objects from API, same format as current
      {
        parcel_id: "12345",
        address: "123 Main St",
        classcd: "640",
        // ... other parcel fields
      }
    ],
    loadedAt: "2026-03-29T14:30:00.000Z",
    count: 23
  },
  
  // Resource configuration
  resources: {
    enabled: true,
    types: {
      water: {
        enabled: true,
        radius: 0.5,
        results: [...],
        loadedAt: "...",
        count: 3
      },
      shelter: {
        enabled: true,
        radius: 1.0,
        results: [...],
        loadedAt: "...",
        count: 5
      }
      // ... other resource types
    }
  },
  
  // UI state (optional, for restoring accordion state)
  uiState: {
    expandedLevel: 1,  // 0=collapsed, 1=card, 2=full
    expandedSections: ["parcels", "water"]  // which accordions are open
  }
}
```

### Parcel Class Categories

Group class codes into user-friendly categories:

```javascript
const PARCEL_CATEGORIES = {
  city_land_bank: {
    label: "City / Land Bank",
    description: "Safest - low enforcement risk",
    classCodes: ["640", "605"],
    risk: "low"
  },
  county_state: {
    label: "County / State",
    description: "Public land, moderate risk",
    classCodes: ["610", "620", "630"],
    risk: "med"
  },
  schools: {
    label: "Schools",
    description: "AVOID - active enforcement",
    classCodes: ["650"],
    risk: "high"
  },
  other_public: {
    label: "Other Public",
    description: "Various public entities",
    classCodes: ["660", "670", "680"],
    risk: "med"
  }
};
```

### Resource Type Categories

Use existing `RESOURCE_CATEGORIES` from `config.js`:

```javascript
const RESOURCE_CATEGORIES = {
  basic: {
    label: "Basic Needs",
    types: ["water", "toilet", "shelter", "food_bank"]
  },
  health: {
    label: "Health & Safety",
    types: ["hospital", "pharmacy", "mental_health", "police"]
  },
  amenities: {
    label: "Amenities",
    types: ["library", "laundry", "wifi", "power", "recycling"]
  },
  retail: {
    label: "Retail & Services",
    types: ["mcdonalds", "speedway", "kroger", "walmart", "thrift", "pawn_shop"]
  }
};
```

### LocalStorage Schema

```javascript
// Key: "searchManager_searches"
// Value: JSON array of search objects
localStorage.setItem("searchManager_searches", JSON.stringify(searchesArray));

// Key: "searchManager_activeId"
// Value: UUID string of currently active search
localStorage.setItem("searchManager_activeId", activeSearchId);

// Key: "searchManager_settings"
// Value: Global settings (sort order, etc.)
localStorage.setItem("searchManager_settings", JSON.stringify({
  sortBy: "updated",  // "updated" | "created" | "name" | "favorite"
  sortOrder: "desc"
}));
```

### LocalStorage Compression

Use lz-string to compress search results for better storage efficiency:

```javascript
// In storage.js
import LZString from 'lz-string';

function compress(data) {
  return LZString.compressToUTF16(JSON.stringify(data));
}

function decompress(compressed) {
  if (!compressed) return null;
  try {
    return JSON.parse(LZString.decompressFromUTF16(compressed));
  } catch (e) {
    console.error('Decompression failed:', e);
    return null;
  }
}

// Modified save function
function saveSearches(searches) {
  const compressed = compress(searches);
  localStorage.setItem(KEYS.SEARCHES, compressed);
}

// Modified load function
function loadSearches() {
  const compressed = localStorage.getItem(KEYS.SEARCHES);
  return decompress(compressed) || [];
}
```

**Expected savings**: ~60-70% reduction in storage size.

---

## UI Components

### 1. Top Bar - Search Button

Replace current separate search buttons with single unified button:

```
┌─────────────────────────────────────────────────────────┐
│ Sprawlmap  📍  🔍  📋  🤖  ⚙️                           │
└─────────────────────────────────────────────────────────┘
```

- **🔍 (Search)**: Opens Search Manager panel
- Remove: old parcel search button, resource button

### 2. Search Manager Panel - List View

Main view showing all saved searches:

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Search Manager                            [✕ Close] │
├─────────────────────────────────────────────────────────┤
│ [+ New Search]                        [🗑 Clear All]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⭐ Downtown Columbus                        📍🔒🗑      │
│    Updated 2h ago · 23 parcels · 8 resources           │
│                                                         │
│ ⭐ Short North                              📍🔒🗑      │
│    Updated 1d ago · 45 parcels · 12 resources          │
│                                                         │
│   Franklinton                              📍🔒🗑       │
│    Updated 3h ago · 12 parcels · 5 resources           │
│                                                         │
│   Linden                                   📍🗑         │
│    Updated 5d ago · 8 parcels · 2 resources            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [+ New Search]                        [🗑 Clear All]    │
└─────────────────────────────────────────────────────────┘
```

**Elements:**
- **⭐ Favorite star**: Click to toggle favorite (favorites pinned to top)
- **📍 Activate**: Load this search's results onto the map
- **🔒 Lock**: Toggle read-only mode (when locked, shows filled lock icon)
- **🗑 Delete**: Remove search (disabled if locked)

### 3. Collapse Level 1 - Collapsed Line

When a search is collapsed (default in list):

```
┌─────────────────────────────────────────────────────────┐
│ ⭐ Downtown Columbus · 23p · 8r · 2h ago          [▼]  │
└─────────────────────────────────────────────────────────┘
```

- **Click row**: Activate search on map
- **▼**: Expand to card view

### 4. Collapse Level 2 - Card View

Shows metadata and main controls:

```
┌─────────────────────────────────────────────────────────┐
│ ⭐ Downtown Columbus              [🔒][🗑]     [▲]      │
├─────────────────────────────────────────────────────────┤
│ 📍 39.9612, -82.9988 (GPS)                              │
│ Created: Mar 29, 10:00 AM · Updated: 2 hours ago 🟢     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ PARCELS                                    [✓] [Load]   │
│ ─────────────────────────────────────────────────────── │
│ City/Land Bank     ████████░░  12    0.5mi [slider]    │
│ County/State       ████░░░░░░   5    0.5mi [slider]    │
│ Schools            ██░░░░░░░░   3    0.5mi [slider]    │
│ Other Public       ███░░░░░░░   3    0.5mi [slider]    │
│                                   [All Classes] [None]  │
│                                                         │
│ RESOURCES                                 [✓]           │
│ ─────────────────────────────────────────────────────── │
│ ▶ Basic Needs (3 types, 5 results)         [Load All]  │
│ ▶ Health & Safety (4 types, 2 results)     [Load All]  │
│ ▶ Amenities (5 types, 3 results)           [Load All]  │
│ ▶ Retail & Services (6 types, 0 results)   [Load All]  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [📍 Activate on Map]              [▼ Collapse] [▼▼ Full]│
└─────────────────────────────────────────────────────────┘
```

**Elements:**
- **Checkboxes**: Enable/disable categories
- **Load buttons**: Queue load request for that section
- **Sliders**: Per-type radius (0.25 - 5 miles)
- **Stale badge** (🟢/🟠/🔴): Color-coded age indicator
- **Activate on Map**: Make this the active search

### 5. Collapse Level 3 - Fully Expanded

Shows all results with individual type controls:

```
┌─────────────────────────────────────────────────────────┐
│ ⭐ Downtown Columbus              [🔒][🗑]     [▲][📍] │
├─────────────────────────────────────────────────────────┤
│ ...metadata same as Level 2...                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ▼ PARCELS (23)                            [Load]        │
│ ─────────────────────────────────────────────────────── │
│   [✓] City/Land Bank (12) · LOW risk                    │
│       ┌─────────────────────────────────────────────┐   │
│       │ 🟢 123 Main St · 0.3mi · 2.5 acres         │   │
│       │ 🟢 456 Oak Ave · 0.5mi · 1.2 acres         │   │
│       │ 🟢 789 Elm Blvd · 0.7mi · 0.8 acres        │   │
│       │ ...showing 12 of 12...                      │   │
│       └─────────────────────────────────────────────┘   │
│                                                         │
│   [✓] Schools (3) · HIGH risk - AVOID                   │
│       ┌─────────────────────────────────────────────┐   │
│       │ 🔴 Columbus Alternative · 0.4mi             │   │
│       │ 🔴 East High School · 0.8mi                 │   │
│       │ 🔴 Weinland Park Elementary · 1.1mi         │   │
│       └─────────────────────────────────────────────┘   │
│                                                         │
│   [ ] County/State (5) · MED risk                       │
│   [ ] Other Public (3) · MED risk                       │
│                                                         │
│ ▼ RESOURCES (8 total)                                   │
│ ─────────────────────────────────────────────────────── │
│   ▼ Basic Needs                                         │
│     [✓] Water (3) · 0.5mi        [⏺ Load]             │
│       ┌─────────────────────────────────────────────┐   │
│       │ 💧 Columbus Metropolitan Library · 0.3mi    │   │
│       │ 💧 Goodale Park Fountain · 0.6mi            │   │
│       │ 💧 Scioto Mile Fountain · 0.9mi             │   │
│       └─────────────────────────────────────────────┘   │
│                                                         │
│     [✓] Shelter (2) · 1.0mi      [⏺ Load]             │
│       ┌─────────────────────────────────────────────┐   │
│       │ 🏠 Community Shelter Board · 0.8mi          │   │
│       │ 🏠 Salvation Army · 1.2mi                   │   │
│       └─────────────────────────────────────────────┘   │
│                                                         │
│     [ ] Toilet · 0.5mi           [⏺ Load]             │
│     [ ] Food Bank · 1.0mi        [⏺ Load]             │
│                                                         │
│   ▶ Health & Safety (4 types, 2 loaded)                │
│   ▶ Amenities (5 types, 1 loaded)                      │
│   ▶ Retail & Services (6 types, 0 loaded)              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [📍 Activate on Map]              [▲ Card]  [▲▲ Collapse]│
└─────────────────────────────────────────────────────────┘
```

**Elements:**
- **Accordion headers (▶/▼)**: Expand/collapse categories
- **Individual type rows**: Each with checkbox, radius slider, load button
- **Result lists**: Scrollable lists of results per type
- **Click result**: Zooms to that item on map

### 6. New Search Modal

When user clicks "New Search":

```
┌─────────────────────────────────────────────────────────┐
│ Create New Search                              [✕]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Location:                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📍 39.9612, -82.9988                                │ │
│ │ 🏷 Downtown Columbus, OH (auto-detected)            │ │
│ │                                                     │ │
│ │ Source: ● Current GPS Location                      │ │
│ │         ○ Last map click (39.95, -83.01)           │ │
│ │         ○ Enter address [____________] [Geocode]   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Name: [Downtown Columbus___________] [Auto-generate]   │
│                                                         │
│ Initial Load:                                           │
│ [ ] Load parcels immediately                           │
│ [ ] Load all resource types                            │
│                                                         │
│                    [Cancel]  [Create Search]           │
└─────────────────────────────────────────────────────────┘
```

### 7. Confirm Delete Modal

```
┌─────────────────────────────────────────────────────────┐
│ Delete Search?                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Are you sure you want to delete "Downtown Columbus"?   │
│                                                         │
│ This cannot be undone.                                  │
│                                                         │
│                    [Cancel]  [Delete]                   │
└─────────────────────────────────────────────────────────┘
```

### 8. Clear All Confirmation

```
┌─────────────────────────────────────────────────────────┐
│ Clear All Searches?                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ This will delete 4 searches.                            │
│                                                         │
│ 1 locked search will be preserved:                      │
│   🔒 Short North                                        │
│                                                         │
│ This cannot be undone.                                  │
│                                                         │
│                    [Cancel]  [Clear 4 Searches]         │
└─────────────────────────────────────────────────────────┘
```

### 9. Locked Search Warning

When user tries to modify a locked search:

```
┌─────────────────────────────────────────────────────────┐
│ Search Locked                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ "Downtown Columbus" is locked and cannot be modified.  │
│                                                         │
│ Unlock it first to make changes.                        │
│                                                         │
│                    [OK]  [Unlock & Edit]               │
└─────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: First-Time User

1. User lands on page
2. App requests GPS location
3. GPS obtained → creates default "Current Location" search automatically
4. Search Manager panel opens showing the new search
5. User sees collapsed card, clicks to expand
6. User checks parcel categories, adjusts radii
7. User clicks "Load" for parcels
8. Parcels fetch, display on map, auto-save triggers
9. User expands "Basic Needs", checks "Water"
10. User clicks load for Water
11. Water resources fetch, display on map, auto-save triggers

### Flow 2: Returning User

1. User lands on page
2. App loads searches from localStorage
3. App requests GPS (for potential new search)
4. Last active search is auto-activated on map
5. User sees their saved searches in panel
6. User can modify, load more types, or create new search

### Flow 3: Create New Search from Map Click

1. User right-clicks/long-presses map at different location
2. Context menu appears
3. User selects "📍 Set as search center"
4. New search created at clicked location
5. Reverse geocode fetches location name
6. Search Manager panel opens with new search expanded
7. User can configure and load

### Flow 4: Switch Between Searches

1. User has multiple saved searches
2. User opens Search Manager
3. User clicks different search's 📍 button
4. Previous search results cleared from map
5. New search results loaded onto map
6. Active search ID updated in localStorage

### Flow 5: Favorite a Search

1. User clicks ⭐ on a search
2. Search moves to top of list (favorites section)
3. `favorite: true` saved to localStorage

### Flow 6: Lock a Search

1. User clicks 🔒 on a search
2. Lock icon fills (locked state)
3. Edit controls disabled
4. Delete button disabled
5. `locked: true` saved to localStorage
6. Future attempts to edit show locked warning

### Flow 7: Delete a Search

1. User clicks 🗑 on unlocked search
2. Confirmation modal appears
3. User confirms
4. Search removed from localStorage
5. If it was active search, map cleared
6. List updates

### Flow 8: Clear All Searches

1. User clicks "Clear All"
2. Confirmation modal shows count, lists locked searches that will be preserved
3. User confirms
4. All non-locked searches deleted
5. Locked searches remain
6. If active search was deleted, first locked search (or empty) becomes active

---

## Interactions

### Button/Action Reference Table

| Element | Action | Behavior |
|---------|--------|----------|
| **Search Button (🔍)** | Click | Toggle Search Manager panel |
| **New Search** | Click | Open new search modal |
| **Clear All** | Click | Show confirmation, delete non-locked searches |
| **Search row** | Click | Activate search on map |
| **⭐ Favorite** | Click | Toggle favorite, resort list |
| **🔒 Lock** | Click | Toggle lock, disable/enable editing |
| **🗑 Delete** | Click | Show confirmation, delete if unlocked |
| **▼ Expand** | Click | Expand search to next level |
| **▲ Collapse** | Click | Collapse search one level |
| **Category checkbox** | Change | Toggle category, auto-save |
| **Type checkbox** | Change | Toggle type, auto-save |
| **Radius slider** | Input | Update radius, auto-save |
| **Load button** | Click | Queue load request, fetch data, auto-save |
| **Result item** | Click | Zoom to item on map, show popup |
| **Search name** | Double-click | Enable inline editing |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close panel / modal |
| `Enter` | Confirm modal |
| `/` | Focus search (if search-within-searches added) |
| `N` | New search (when panel focused) |

### Auto-Save Triggers

| Trigger | What's Saved |
|---------|--------------|
| Load parcels | `parcels.results`, `parcels.loadedAt`, `parcels.count`, `updated` |
| Load resource type | `resources.types[type].results`, `.loadedAt`, `.count`, `updated` |
| Toggle category/type | `parcels.classCodes` or `resources.types[type].enabled`, `updated` |
| Change radius | `parcels.radius` or `resources.types[type].radius`, `updated` |
| Toggle favorite | `favorite`, `updated` |
| Toggle lock | `locked`, `updated` |
| Rename search | `name`, `updated` |
| Expand/collapse UI | `uiState` |

### Stale Data Indicators

Results older than 24 hours show a color-coded age badge:

| Age | Badge | Color | Class |
|-----|-------|-------|-------|
| < 1 day | 🟢 Fresh | Green | `.stale-badge.fresh` |
| 1-7 days | 🟠 Recent | Orange | `.stale-badge.recent` |
| > 7 days | 🔴 Old | Red | `.stale-badge.old` |

```javascript
function getStaleBadge(loadedAt) {
  const ageMs = Date.now() - new Date(loadedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  if (ageDays < 1) return { badge: '🟢', class: 'fresh', label: 'Fresh' };
  if (ageDays < 7) return { badge: '🟠', class: 'recent', label: 'Recent' };
  return { badge: '🔴', class: 'old', label: 'Old' };
}
```

---

## Technical Implementation

### Module Structure

```
js/search/
├── manager.js      # Core CRUD, localStorage, events
├── ui.js           # Rendering, DOM interactions
├── types.js        # Parcel/resource type definitions
├── geocode.js      # Reverse geocoding for auto-naming
└── storage.js      # localStorage wrapper with error handling
```

### manager.js - Core Functions

```javascript
// State
let searches = [];
let activeSearchId = null;

// CRUD
function createSearch(location, options = {})
function getSearch(id)
function updateSearch(id, updates)
function deleteSearch(id)
function getAllSearches()
function getActiveSearch()
function setActiveSearch(id)

// Bulk operations
function clearAllNonLocked()
function getFavorites()
function sortBy(spec)

// Auto-save
function saveToLocalStorage()
function loadFromLocalStorage()

// Event system
function emit(event, data)
function on(event, callback)

// Request queue (handles concurrent load button clicks)
const loadQueue = [];
let isProcessingQueue = false;

async function queueLoad(searchId, type, loadFn) {
  loadQueue.push({ searchId, type, loadFn, queuedAt: Date.now() });
  if (!isProcessingQueue) processQueue();
}

async function processQueue() {
  if (loadQueue.length === 0) {
    isProcessingQueue = false;
    emit('queue:empty', {});
    return;
  }
  isProcessingQueue = true;
  const { searchId, type, loadFn } = loadQueue.shift();
  emit('queue:processing', { searchId, type, queueLength: loadQueue.length });
  try {
    await loadFn();
  } catch (e) {
    emit('search:error', { searchId, type, error: e });
  }
  processQueue();
}

function getQueueLength() {
  return loadQueue.length;
}
```

### ui.js - Rendering Functions

```javascript
// Main panel
function renderSearchManager()
function renderSearchList()
function renderSearchCard(search, level)
function renderSearchCollapsed(search)
function renderSearchCardView(search)
function renderSearchFull(search)

// Modals
function showNewSearchModal()
function showDeleteConfirm(search)
function showClearAllConfirm()
function showLockedWarning(search)

// Inline interactions
function renderParcelSection(search)
function renderResourceSection(search)
function renderTypeRow(type, config, results)
function renderResultList(results, type)

// Updates
function updateSearchInList(searchId)
function updateResultCount(searchId, type, count)
function setLoadingState(searchId, type, loading)
```

### types.js - Type Definitions

```javascript
const PARCEL_CATEGORIES = { /* as defined above */ };

const RESOURCE_CATEGORIES = { /* from config.js */ };

const RESOURCE_TYPES = { /* from config.js */ };

function getParcelCategoryForClass(classCode)
function getAllParcelClassCodes()
function getResourceTypesForCategory(categoryKey)
```

### geocode.js - Location Naming

```javascript
// Rate limit: 1 request per second for Nominatim (required by their policy)
let lastGeocodeTime = 0;
const GEOCODE_MIN_INTERVAL = 1000;

// In-memory cache for geocode results (keyed by rounded lat/lon)
const geocodeCache = new Map();

function getCacheKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

async function reverseGeocode(lat, lon) {
  // Check cache first
  const cacheKey = getCacheKey(lat, lon);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }
  
  // Rate limit
  const now = Date.now();
  const elapsed = now - lastGeocodeTime;
  if (elapsed < GEOCODE_MIN_INTERVAL) {
    await new Promise(r => setTimeout(r, GEOCODE_MIN_INTERVAL - elapsed));
  }
  lastGeocodeTime = Date.now();
  
  // Fetch from Nominatim
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
  );
  const data = await response.json();
  
  // Extract components
  const address = data.address || {};
  const label = address.neighbourhood || address.suburb || address.city || 'Unknown Location';
  const result = { label: `${label}, ${address.state || ''}`, components: address };
  
  // Cache result
  geocodeCache.set(cacheKey, result);
  return result;
}

function generateSearchName(lat, lon, existing = []) {
  // Call reverseGeocode
  // Handle duplicates: "Downtown Columbus", "Downtown Columbus (2)", etc.
  // Fallback: "Search 1", "Search 2"
}
```

### storage.js - LocalStorage Wrapper

```javascript
const KEYS = {
  SEARCHES: 'searchManager_searches',
  ACTIVE_ID: 'searchManager_activeId',
  SETTINGS: 'searchManager_settings'
};

function save(key, data)
function load(key, defaultValue = null)
function remove(key)
function clear()
function getStorageSize()  // For quota warnings
function exportData()      // For backup/download
function importData(json)  // For restore
```

### Integration Points

#### main.js Changes

```javascript
// Remove old imports
// import { displayParcels } from './ui/cards.js';  // DELETE
// import { displayResources } from './ui/cards.js'; // DELETE

// Add new imports
import { 
  initSearchManager, 
  createSearch, 
  getActiveSearch,
  setActiveSearch 
} from './search/manager.js';
import { renderSearchManager, openSearchPanel } from './search/ui.js';

// In init()
async function init() {
  initMap();
  initSettings();
  initSearchManager();  // NEW
  
  // GPS on load
  requestGPSLocation().then(pos => {
    // Create default search if none exist
    if (getAllSearches().length === 0) {
      createSearch({ lat: pos.lat, lon: pos.lon, source: 'gps' });
    }
  });
  
  // Wire new search button
  document.getElementById('searchBtn').onclick = openSearchPanel;
}
```

#### context-menu.js Changes

```javascript
// Update "Set search center" handler
document.getElementById('ctx-set-center').onclick = () => {
  const { lat, lon } = currentContextMenuLocation;
  
  // Create new search at clicked location
  const search = createSearch({ 
    lat, 
    lon, 
    source: 'map-click' 
  });
  
  // Activate it
  setActiveSearch(search.id);
  
  // Open panel
  openSearchPanel();
  
  closeContextMenu();
};
```

#### map.js Changes

```javascript
// Function to display active search on map
function displayActiveSearch(search) {
  clearAllLayers();
  
  // Add parcels
  if (search.parcels.results) {
    search.parcels.results.forEach(parcel => {
      addParcelToMap(parcel);
    });
  }
  
  // Add resources
  for (const [type, config] of Object.entries(search.resources.types)) {
    if (config.results) {
      config.results.forEach(resource => {
        addResourceToMap(resource, type);
      });
    }
  }
}

function clearAllLayers() {
  getParcelLayerGroup().clearLayers();
  getResourceLayer().clearLayers();
}
```

### Error Handling

```javascript
// Storage quota exceeded
try {
  saveToLocalStorage();
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    showWarning('Storage full. Delete some searches to save new ones.');
  }
}

// API failures
async function loadParcels(searchId) {
  try {
    const results = await findPublicParcels({...});
    updateSearch(searchId, { parcels: { results, loadedAt: new Date().toISOString() } });
  } catch (e) {
    showError(`Failed to load parcels: ${e.message}`);
    // Don't update search, keep previous results if any
  }
}

// Geocoding failure
async function generateSearchName(lat, lon) {
  try {
    const geo = await reverseGeocode(lat, lon);
    return geo.label;
  } catch (e) {
    // Fallback to coordinates
    return `Search at ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
```

### Performance Considerations

1. **Request queue**: Queue concurrent load requests, process sequentially
2. **Debounce auto-save**: Don't save on every slider drag, save on release
3. **Lazy rendering**: Only render visible search cards in list
4. **Virtual scrolling**: If > 50 searches, use virtual scroll
5. **Cache geocode results**: In-memory cache keyed by lat/lon (4 decimals)
6. **Compress results**: Use lz-string for localStorage (see LocalStorage Compression)
7. **Nominatim rate limit**: Enforce 1 req/sec for reverse geocoding

---

## File Structure

### New Files

```
sprawlmap2/
├── js/
│   └── search/
│       ├── manager.js      # Core CRUD, state management
│       ├── ui.js           # DOM rendering, interactions
│       ├── types.js        # Type/category definitions
│       ├── geocode.js      # Reverse geocoding
│       └── storage.js      # LocalStorage wrapper
├── css/
│   └── search.css          # Search Manager styles
└── docs/
    └── future/
        └── SEARCH_MANAGER.md  # This document
```

### Modified Files

```
sprawlmap2/
├── index.html              # Update search button, add panel HTML
├── js/
│   ├── main.js             # Wire new search manager
│   ├── map.js              # Add displayActiveSearch()
│   ├── state.js            # Remove old parcel/resource state
│   └── ui/
│       ├── context-menu.js # Update "set search center"
│       ├── cards.js        # DEPRECATE or repurpose
│       ├── filters.js      # DEPRECATE
│       └── panels.js       # Update for new panel
```

### Deprecated Files (Remove After Migration)

```
js/ui/cards.js       # Move useful functions to search/ui.js
js/ui/filters.js     # Replace with search/manager.js
```

---

## Migration Notes

### Phase 1: Foundation (No UI Changes)

1. Create `js/search/` modules
2. Add localStorage functions
3. Create type definitions
4. Add geocode function
5. Test in isolation

### Phase 2: Parallel Implementation

1. Add new Search Manager button (keep old buttons)
2. Build new panel HTML
3. Wire to manager.js
4. Test creating/editing/deleting searches
5. Verify localStorage persistence

### Phase 3: Map Integration

1. Add `displayActiveSearch()` to map.js
2. Wire activate button to show on map
3. Test switching between searches
4. Verify one-at-a-time behavior

### Phase 4: Replace Old UI

1. Remove old parcel/resource buttons
2. Remove old filters panel
3. Update context menu
4. Remove deprecated files
5. Clean up CSS

### Phase 5: Polish

1. Add animations for accordion
2. Add loading states
3. Add error handling UI
4. Test on mobile
5. Test with many searches (50+)

### Data Migration

If users have old saved data:

```javascript
function migrateOldSettings() {
  // Check for old resourceSettings
  const oldResourceSettings = localStorage.getItem('resourceSettings');
  if (oldResourceSettings && !localStorage.getItem('searchManager_searches')) {
    // User has old settings but no new searches
    // Could offer to import, or just start fresh
  }
}
```

---

## Future Enhancements

### Potential V2 Features

1. **Search sharing**: Export search as URL, import from URL
2. **Cloud sync**: Optional account to sync across devices
3. **Search templates**: Pre-configured searches for common use cases
4. **Batch operations**: Load all types at once with single button
5. **Offline mode**: Cache results for offline access
6. **Search notes**: Add user notes to each search
7. **Tags/labels**: Custom tags beyond just favorite
8. **Map layers**: Toggle visibility of different result types
9. **Clustering**: Cluster markers when zoomed out
10. **Heatmap view**: Show density instead of individual markers

### API Improvements

1. **Bulk endpoints**: Fetch multiple resource types in one request
2. **Delta updates**: Only fetch changes since last load
3. **Background refresh**: Auto-refresh stale data

---

## Appendix: CSS Classes

```css
/* Panel */
.search-manager-panel { }
.search-manager-header { }
.search-manager-list { }
.search-manager-footer { }

/* Search items */
.search-item { }
.search-item.collapsed { }
.search-item.card { }
.search-item.expanded { }
.search-item.favorite { }
.search-item.active { }
.search-item.locked { }

/* Actions */
.search-action { }
.search-action.favorite { }
.search-action.lock { }
.search-action.delete { }
.search-action.activate { }

/* Sections */
.search-section { }
.search-section.parcels { }
.search-section.resources { }
.search-section-header { }
.search-section-content { }

/* Type rows */
.type-row { }
.type-row.enabled { }
.type-row.loading { }
.type-checkbox { }
.type-radius { }
.type-load-btn { }
.type-count { }

/* Results */
.result-list { }
.result-item { }
.result-item.parcel { }
.result-item.resource { }
.result-item.low { }
.result-item.med { }
.result-item.high { }

/* Stale indicators */
.stale-badge { font-size: 0.75em; margin-left: 0.5em; }
.stale-badge.fresh { color: #22c55e; }
.stale-badge.recent { color: #f97316; }
.stale-badge.old { color: #ef4444; }

/* Request queue */
.queue-indicator { font-size: 0.75em; color: #6b7280; }
.queue-indicator.active { color: #3b82f6; }

/* Modals */
.search-modal { }
.search-modal.confirm { }
.search-modal.new-search { }
```

---

## Appendix: Event Reference

| Event | Payload | When Fired |
|-------|---------|------------|
| `search:created` | `{ search }` | New search created |
| `search:updated` | `{ search, changes }` | Search modified |
| `search:deleted` | `{ searchId }` | Search removed |
| `search:activated` | `{ search }` | Search set as active |
| `search:loaded` | `{ searchId, type, count }` | Data loaded for type |
| `search:favorite` | `{ searchId, favorite }` | Favorite toggled |
| `search:lock` | `{ searchId, locked }` | Lock toggled |
| `search:error` | `{ searchId, type, error }` | Load failed |
| `storage:quota` | `{ percentUsed }` | Storage approaching limit |
| `queue:processing` | `{ searchId, type, queueLength }` | Queue item started |
| `queue:empty` | `{ }` | All queued loads complete |

---

## Appendix: Testing Checklist

### Core Functionality

- [ ] Create new search from GPS
- [ ] Create new search from map click
- [ ] Create new search from address
- [ ] Auto-naming works correctly
- [ ] Duplicate names handled (Search 1, Search 2)
- [ ] Load parcels
- [ ] Load individual resource type
- [ ] Load resource category (all types)
- [ ] Results display correctly
- [ ] Results persist after refresh
- [ ] Auto-save on every change

### State Management

- [ ] Favorite toggle works
- [ ] Favorites sort to top
- [ ] Lock toggle works
- [ ] Locked search can't be edited
- [ ] Locked search can't be deleted
- [ ] Unlock allows editing
- [ ] Delete shows confirmation
- [ ] Delete removes from storage
- [ ] Clear all respects locks
- [ ] Active search persists

### Map Integration

- [ ] Activate loads results on map
- [ ] Only one search active at a time
- [ ] Switching searches clears previous
- [ ] Click result zooms to item
- [ ] Markers/polygons display correctly

### UI/UX

- [ ] Collapse level 1 → 2 → 3 works
- [ ] Expand level 3 → 2 → 1 works
- [ ] Accordion sections toggle
- [ ] Sliders update value display
- [ ] Loading states show spinner
- [ ] Error states show message
- [ ] Modals open/close correctly
- [ ] Keyboard shortcuts work
- [ ] Mobile touch works

### Edge Cases

- [ ] No GPS available
- [ ] Geocoding fails
- [ ] API returns no results
- [ ] API returns error
- [ ] LocalStorage quota exceeded
- [ ] LocalStorage disabled
- [ ] Corrupted localStorage data
- [ ] Very long search names
- [ ] 50+ searches in list
- [ ] 1000+ results per search

### Concurrency

- [ ] Multiple rapid Load clicks queue correctly
- [ ] Queue processes in order
- [ ] Loading indicator shows queue position
- [ ] Queue clears on error
- [ ] Queue persists across panel close/open

### Stale Indicators

- [ ] Fresh badge shows green (< 24h)
- [ ] Recent badge shows orange (1-7d)
- [ ] Old badge shows red (> 7d)
- [ ] Badge updates on re-load
- [ ] Badge appears in collapsed and card views

### Compression

- [ ] Large results compress successfully
- [ ] Decompress restores data correctly
- [ ] Handles compression failure gracefully
- [ ] Storage size reduced ~60-70%

### Geocoding

- [ ] Rate limiting enforced (1 req/sec)
- [ ] Cache prevents duplicate requests
- [ ] Cache key rounds to 4 decimals
- [ ] Fallback name on geocode failure

---

*End of Document*
