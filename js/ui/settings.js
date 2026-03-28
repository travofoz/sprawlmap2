import { PROVIDERS, saveKey, loadKey, bestAvailable } from '../providers.js';
import { MAP_STYLES } from '../config.js';
import { switchTileLayer } from '../map.js';
import { log, setStatus } from '../utils.js';

export function initSettings() {
  const provSel = document.getElementById('providerSel');
  const modSel = document.getElementById('modelSel');
  const keyInp = document.getElementById('apiKeyInp');

  if (!provSel || !modSel || !keyInp) return;

  for (const [k, v] of Object.entries(PROVIDERS)) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = v.label;
    provSel.appendChild(o);
  }

  function syncModels() {
    const p = PROVIDERS[provSel.value];
    modSel.innerHTML = '';
    for (const m of p.models) {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      modSel.appendChild(o);
    }
    keyInp.value = loadKey(provSel.value) || '';
    keyInp.placeholder = p.keyHint || 'optional';
  }

  provSel.addEventListener('change', syncModels);
  syncModels();

  const sp = localStorage.getItem('scout_provider');
  if (sp && PROVIDERS[sp]) { provSel.value = sp; syncModels(); }
  const sm = localStorage.getItem('scout_model');
  if (sm) modSel.value = sm;
}

export function applyDisplaySettings() {
  const fontSizeSel = document.getElementById('fontSizeSel');
  const themeSel = document.getElementById('themeSel');
  const mapStyleSel = document.getElementById('mapStyleSel');

  const fontSize = localStorage.getItem('scout_fontSize') || '16';
  const theme = localStorage.getItem('scout_theme') || 'dark';
  const mapStyle = localStorage.getItem('scout_mapStyle') || 'osm';

  document.documentElement.style.fontSize = fontSize + 'px';
  if (fontSizeSel) fontSizeSel.value = fontSize;

  document.body.className = theme;
  if (themeSel) themeSel.value = theme;

  if (mapStyleSel) mapStyleSel.value = mapStyle;
  switchTileLayer(mapStyle);
}

export function saveSettings() {
  const provSel = document.getElementById('providerSel');
  const modSel = document.getElementById('modelSel');
  const keyInp = document.getElementById('apiKeyInp');
  const fontSizeSel = document.getElementById('fontSizeSel');
  const themeSel = document.getElementById('themeSel');
  const mapStyleSel = document.getElementById('mapStyleSel');

  if (provSel && keyInp) {
    saveKey(provSel.value, keyInp.value.trim());
    localStorage.setItem('scout_provider', provSel.value);
  }
  if (modSel) {
    localStorage.setItem('scout_model', modSel.value);
  }
  if (fontSizeSel) {
    localStorage.setItem('scout_fontSize', fontSizeSel.value);
  }
  if (themeSel) {
    localStorage.setItem('scout_theme', themeSel.value);
  }
  if (mapStyleSel) {
    localStorage.setItem('scout_mapStyle', mapStyleSel.value);
  }

  applyDisplaySettings();
  
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) settingsPanel.classList.remove('open');
  
  setStatus('✅ Saved');
  log(`Settings: saved`, 'success');
}

export function openSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) panel.classList.add('open');
}

export function closeSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) panel.classList.remove('open');
}
