import { CLASS_CODES, RESOURCE_TYPES, RESOURCE_CATEGORIES, DEFAULT_RESOURCE_RADII } from '../config.js';

export const PARCEL_CATEGORIES = {
  safest: {
    key: 'safest',
    label: 'Safest Options',
    description: 'Lowest enforcement risk',
    classCodes: ['640', '605'],
    risk: 'low'
  },
  county_state: {
    key: 'county_state',
    label: 'County / State',
    description: 'Public land, moderate risk',
    classCodes: ['610', '620', '630'],
    risk: 'med'
  },
  schools: {
    key: 'schools',
    label: 'Schools',
    description: 'AVOID - active enforcement',
    classCodes: ['650'],
    risk: 'avoid'
  },
  other_public: {
    key: 'other_public',
    label: 'Other Public',
    description: 'Various public entities',
    classCodes: ['600', '660', '670', '680'],
    risk: 'med'
  }
};

export { RESOURCE_TYPES, RESOURCE_CATEGORIES, DEFAULT_RESOURCE_RADII };

export function getParcelCategoryForClass(classCode) {
  const code = String(classCode);
  for (const cat of Object.values(PARCEL_CATEGORIES)) {
    if (cat.classCodes.includes(code)) {
      return cat;
    }
  }
  return null;
}

export function getAllParcelClassCodes() {
  return Object.keys(CLASS_CODES);
}

export function getResourceTypesForCategory(categoryKey) {
  const cat = RESOURCE_CATEGORIES[categoryKey];
  return cat ? cat.types : [];
}

export function getDefaultParcelClassCodes() {
  return ['640', '605'];
}

export function createDefaultParcelConfig() {
  return {
    enabled: true,
    classCodes: getDefaultParcelClassCodes(),
    radius: 0.5,
    results: null,
    loadedAt: null,
    count: 0
  };
}

export function createDefaultResourceTypeConfig(type) {
  return {
    enabled: false,
    radius: DEFAULT_RESOURCE_RADII[type] || 0.5,
    results: null,
    loadedAt: null,
    count: 0
  };
}

export function createDefaultResourceConfig() {
  const types = {};
  for (const type of Object.keys(RESOURCE_TYPES)) {
    types[type] = createDefaultResourceTypeConfig(type);
  }
  return {
    enabled: true,
    types
  };
}
