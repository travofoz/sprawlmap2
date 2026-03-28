import { state } from '../state.js';
import { CLASS_CODES, getClassInfo, riskText, API_URLS } from '../config.js';
import { getMap, getInspectorLayerGroup } from '../map.js';
import { log, fmtCurrency, fmtDate } from '../utils.js';
import { findParcelAtPoint, findAdjacentParcels } from '../api/parcels.js';
import { fetch311Data, fetchCodeEnforcement } from '../api/city.js';
import { openPanel } from './panels.js';

export function toggleInspectorMode() {
  state.inspectorMode = !state.inspectorMode;
  const btn = document.getElementById('inspectorBtn');

  if (state.inspectorMode) {
    btn.classList.add('active');
    log('Inspector: enabled', 'info');
  } else {
    btn.classList.remove('active');
    const inspectorLayerGroup = getInspectorLayerGroup();
    if (inspectorLayerGroup) inspectorLayerGroup.clearLayers();
    log('Inspector: disabled', 'info');
  }
}

export async function handleInspectorClick(e) {
  if (!state.inspectorMode) return;

  const lat = e.latlng.lat;
  const lon = e.latlng.lng;

  log(`Inspector: fetching parcel at ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'info');

  try {
    const parcel = await findParcelAtPoint(lat, lon);
    if (!parcel) {
      log('Inspector: no parcel found', 'warn');
      return;
    }

    state.currentInspectorParcel = parcel;

    const inspectorLayerGroup = getInspectorLayerGroup();
    if (inspectorLayerGroup) inspectorLayerGroup.clearLayers();

    if (parcel.geometry) {
      const coords = parcel.geometry.coordinates[0].map(c => [c[1], c[0]]);
      const selectedPolygon = L.polygon(coords, {
        color: '#58a6ff',
        fillColor: parcel.class_color,
        fillOpacity: 0.4,
        weight: 3
      }).addTo(inspectorLayerGroup);

      let pulseState = 0;
      const pulseAnimation = () => {
        if (!inspectorLayerGroup.hasLayer(selectedPolygon)) return;
        pulseState = (pulseState + 1) % 2;
        selectedPolygon.setStyle({
          weight: pulseState === 0 ? 3 : 5,
          fillOpacity: pulseState === 0 ? 0.4 : 0.25
        });
        setTimeout(pulseAnimation, 750);
      };
      pulseAnimation();
    }

    const [neighbors, reports311, codeEnf] = await Promise.all([
      findAdjacentParcels(parcel.geometry, parcel.parcel_id),
      fetch311Data(parcel.address, parcel.centroid?.lat || lat, parcel.centroid?.lon || lon),
      fetchCodeEnforcement(parcel.parcel_id)
    ]);

    state.currentInspectorNeighbors = neighbors;
    state.current311Reports = reports311;
    state.currentCodeEnforcement = codeEnf;

    for (const n of neighbors) {
      if (n.geometry) {
        const coords = n.geometry.coordinates[0].map(c => [c[1], c[0]]);
        const classInfo = getClassInfo(n.classcd);
        L.polygon(coords, {
          color: classInfo.color,
          fillColor: classInfo.color,
          fillOpacity: 0.2,
          weight: 1
        })
        .on('click', () => panToNeighbor(n))
        .addTo(inspectorLayerGroup);
      }
    }

    renderInspectorPanel();
    openPanel('inspector');
    log(`Inspector: loaded parcel ${parcel.parcel_id}`, 'success');

  } catch (err) {
    log(`Inspector error: ${err.message}`, 'error');
  }
}

export function panToNeighbor(neighbor) {
  const map = getMap();
  const inspectorLayerGroup = getInspectorLayerGroup();
  
  if (neighbor && neighbor.geometry && map && inspectorLayerGroup) {
    const coords = neighbor.geometry.coordinates[0].map(c => [c[1], c[0]]);
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { maxZoom: 17, padding: [20, 20] });

    const flashLayer = L.polygon(coords, {
      color: '#58a6ff',
      fillColor: '#58a6ff',
      fillOpacity: 0.5,
      weight: 3
    }).addTo(inspectorLayerGroup);

    let flashCount = 0;
    const maxFlashes = 3;
    const doFlash = () => {
      if (flashCount >= maxFlashes) {
        inspectorLayerGroup.removeLayer(flashLayer);
        return;
      }
      flashLayer.setStyle({ fillOpacity: flashCount % 2 === 0 ? 0.5 : 0.2 });
      flashCount++;
      setTimeout(doFlash, 200);
    };
    doFlash();
  }
}

export function renderInspectorPanel() {
  const p = state.currentInspectorParcel;
  if (!p) return;

  const el = document.getElementById('tab-inspector');
  if (!el) return;

  let html = '';

  html += `
    <div class="inspector-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="badge ${p.risk}">${riskText(p.risk)}</span>
        <span style="font-size:0.8rem;color:${p.class_color}">${p.class_label}</span>
      </div>
      <h2 style="font-size:1.1rem;color:var(--text);margin-bottom:4px">${p.address || '(No address)'}</h2>
      <p style="font-size:0.75rem;color:var(--text2)">${p.parcel_id} · ${p.acres ? p.acres.toFixed(2) + ' acres' : 'Size unknown'}</p>
      <a href="${p.property_card}" target="_blank" class="inspector-link">📄 Property Card →</a>
    </div>
  `;

  html += `
    <div class="inspector-section">
      <h3>👤 Ownership</h3>
      <div class="inspector-grid">
        <div class="inspector-field full">
          <label>Owner</label>
          <div class="value">${p.owner || 'Unknown'}${p.owner2 ? `<br>${p.owner2}` : ''}</div>
        </div>
        ${p.mail_address && p.mail_address !== p.address ? `
          <div class="inspector-field full">
            <label>Mailing Address</label>
            <div class="value">${p.mail_name || ''}${p.mail_address ? `<br>${p.mail_address}` : ''}</div>
          </div>
        ` : ''}
        ${p.owner_occupied !== undefined ? `
          <div class="inspector-field">
            <label>Occupancy</label>
            <div class="value">${p.owner_occupied ? 'Owner Occupied' : (p.is_rental ? 'Rental' : 'Non-owner occupied')}</div>
          </div>
        ` : ''}
        ${p.school_district ? `
          <div class="inspector-field">
            <label>School District</label>
            <div class="value">${p.school_district}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  html += `
    <div class="inspector-section">
      <h3>🏛️ Classification</h3>
      <div class="inspector-grid">
        <div class="inspector-field">
          <label>Class Code</label>
          <div class="value">${p.classcd} - ${p.class_label}</div>
        </div>
        <div class="inspector-field">
          <label>Description</label>
          <div class="value">${p.class_desc || p.risk_desc || 'N/A'}</div>
        </div>
        ${p.legal_desc ? `
          <div class="inspector-field full">
            <label>Legal Description</label>
            <div class="value" style="font-size:0.75rem">${p.legal_desc}</div>
          </div>
        ` : ''}
        ${p.subdivision ? `
          <div class="inspector-field">
            <label>Subdivision</label>
            <div class="value">${p.subdivision}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  html += `
    <div class="inspector-section">
      <h3>💰 Values</h3>
      <div class="inspector-grid">
        <div class="inspector-field">
          <label>Appraised Value</label>
          <div class="value" style="color:var(--accent);font-weight:600">${fmtCurrency(p.appraised) || 'N/A'}</div>
        </div>
        <div class="inspector-field">
          <label>Taxable Value</label>
          <div class="value">${fmtCurrency(p.taxable_value) || 'N/A'}</div>
        </div>
        ${p.land_value ? `
          <div class="inspector-field">
            <label>Land Value</label>
            <div class="value">${fmtCurrency(p.land_value)}</div>
          </div>
        ` : ''}
        ${p.building_value ? `
          <div class="inspector-field">
            <label>Building Value</label>
            <div class="value">${fmtCurrency(p.building_value)}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  html += `
    <div class="inspector-section">
      <h3>📝 Sale History</h3>
      <div class="inspector-grid">
        <div class="inspector-field">
          <label>Last Sale Date</label>
          <div class="value">${p.last_sale_year ? p.last_sale_year : 'Unknown'}</div>
        </div>
        <div class="inspector-field">
          <label>Sale Price</label>
          <div class="value">${fmtCurrency(p.sale_price) || 'Unknown'}</div>
        </div>
      </div>
    </div>
  `;

  if (p.year_built || p.floor_area || p.rooms) {
    html += `
      <div class="inspector-section">
        <h3>🏠 Building</h3>
        <div class="inspector-grid">
          ${p.year_built ? `<div class="inspector-field"><label>Year Built</label><div class="value">${p.year_built}</div></div>` : ''}
          ${p.floor_area ? `<div class="inspector-field"><label>Floor Area</label><div class="value">${p.floor_area.toLocaleString()} sq ft</div></div>` : ''}
          ${p.rooms ? `<div class="inspector-field"><label>Rooms</label><div class="value">${p.rooms}</div></div>` : ''}
          ${p.bedrooms ? `<div class="inspector-field"><label>Bedrooms</label><div class="value">${p.bedrooms}</div></div>` : ''}
          ${p.baths ? `<div class="inspector-field"><label>Bathrooms</label><div class="value">${p.baths}</div></div>` : ''}
          ${p.condition ? `<div class="inspector-field"><label>Condition</label><div class="value">${p.condition}</div></div>` : ''}
          ${p.building_type ? `<div class="inspector-field"><label>Building Type</label><div class="value">${p.building_type}</div></div>` : ''}
        </div>
      </div>
    `;
  }

  if (p.water_service || p.sewer_service) {
    html += `
      <div class="inspector-section">
        <h3>🔌 Services</h3>
        <div class="inspector-grid">
          ${p.water_service ? `<div class="inspector-field"><label>Water</label><div class="value">${p.water_service}</div></div>` : ''}
          ${p.sewer_service ? `<div class="inspector-field"><label>Sewer</label><div class="value">${p.sewer_service}</div></div>` : ''}
        </div>
      </div>
    `;
  }

  html += `<div class="inspector-section"><h3>📞 311 Service Reports</h3>`;
  if (state.current311Reports.available && state.current311Reports.entries.length > 0) {
    html += `<p style="color:var(--text2);font-size:0.7rem;margin-bottom:6px">${state.current311Reports.entries.length} service requests (30-day window) — tap to expand</p>`;
    state.current311Reports.entries.forEach((r, i) => {
      const statusClass = r.status?.toLowerCase().includes('closed') ? 'closed' : r.status?.toLowerCase().includes('cancel') ? 'canceled' : 'open';
      html += `
        <div class="report-card ${statusClass}" data-report-index="${i}">
          <span class="expand-icon">▶</span>
          <div class="report-type">${r.type || 'Unknown Request'}</div>
          <div class="report-meta">${r.category || ''} · ${fmtDate(r.reported_date) || 'Unknown'} <span class="report-status ${statusClass}">${r.status || 'Unknown'}</span></div>
          <div class="details">
            ${r.case_id ? `<div class="details-row"><span class="details-label">Case ID</span><span class="details-value">${r.case_id}</span></div>` : ''}
            ${r.subcategory ? `<div class="details-row"><span class="details-label">Subcategory</span><span class="details-value">${r.subcategory}</span></div>` : ''}
            ${r.department ? `<div class="details-row"><span class="details-label">Department</span><span class="details-value">${r.department}</span></div>` : ''}
          </div>
        </div>
      `;
    });
  } else {
    html += `<p style="color:var(--text2);font-size:0.8rem">No 311 data available</p>`;
  }
  html += `</div>`;

  html += `<div class="inspector-section"><h3>🔨 Code Enforcement (${state.currentCodeEnforcement.entries.length})</h3>`;
  if (state.currentCodeEnforcement.available && state.currentCodeEnforcement.entries.length > 0) {
    state.currentCodeEnforcement.entries.forEach(c => {
      const statusClass = c.status?.toLowerCase().includes('closed') ? 'closed' : c.status?.toLowerCase().includes('open') ? 'open' : 'med';
      html += `
        <div class="report-card ${statusClass}">
          <span class="expand-icon">▶</span>
          <div class="report-type">${c.type || 'Unknown'}${c.category && c.category !== 'NA' ? ` — ${c.category}` : ''}</div>
          <div class="report-meta">${c.subtype || ''} · ${fmtDate(c.filed_date) || 'Unknown'} <span class="report-status ${statusClass}">${c.status || 'Unknown'}</span></div>
          <div class="details">
            <div class="details-row"><span class="details-label">Case ID</span><span class="details-value">${c.case_id || 'N/A'}</span></div>
            ${c.url ? `<div style="margin-top:6px"><a href="${c.url}" target="_blank" class="inspector-link">View Full Case →</a></div>` : ''}
          </div>
        </div>
      `;
    });
  } else {
    html += `<p style="color:var(--text2);font-size:0.8rem">No code enforcement data</p>`;
  }
  html += `</div>`;

  html += `<div class="inspector-section"><h3>🗺️ Adjacent Parcels (${state.currentInspectorNeighbors.length})</h3>`;
  if (state.currentInspectorNeighbors.length > 0) {
    const sorted = [...state.currentInspectorNeighbors].sort((a, b) => {
      const aPublic = a.classcd >= 600 && a.classcd <= 680;
      const bPublic = b.classcd >= 600 && b.classcd <= 680;
      if (aPublic && !bPublic) return -1;
      if (!aPublic && bPublic) return 1;
      const riskOrder = { low: 0, med: 1, avoid: 2, high: 3 };
      return (riskOrder[a.risk] || 2) - (riskOrder[b.risk] || 2);
    });
    sorted.forEach((n, i) => {
      html += `
        <div class="neighbor-card ${n.risk || 'med'}" data-neighbor-index="${i}">
          <span class="expand-icon">▶</span>
          <div class="addr">${n.address || n.parcel_id}</div>
          <div class="meta">
            <span class="badge ${n.risk || 'med'}" style="font-size:0.6rem">${n.risk_text || riskText(n.risk)}</span>
            ${n.class_label}
            ${n.owner ? `<br>${n.owner.slice(0, 30)}${n.owner.length > 30 ? '...' : ''}` : ''}
          </div>
          <div class="details">
            <div class="details-row"><span class="details-label">Parcel ID</span><span class="details-value">${n.parcel_id}</span></div>
            <div class="details-row"><span class="details-label">Acres</span><span class="details-value">${n.acres ? n.acres.toFixed(2) : 'N/A'}</span></div>
            <div style="margin-top:6px"><a href="https://property.franklincountyauditor.com/_web/propertycard/propertycard.aspx?pin=${n.parcel_id}" target="_blank" class="inspector-link">📄 Property Card →</a></div>
          </div>
        </div>
      `;
    });
  } else {
    html += `<p style="color:var(--text2);font-size:0.8rem">No adjacent parcels found</p>`;
  }
  html += `</div>`;

  el.innerHTML = html;

  el.querySelectorAll('.report-card, .neighbor-card').forEach(card => {
    card.onclick = e => {
      if (e.target.tagName === 'A') return;
      card.classList.toggle('expanded');
    };
  });

  el.querySelectorAll('.neighbor-card').forEach(card => {
    const idx = parseInt(card.dataset.neighborIndex);
    if (!isNaN(idx)) {
      card.addEventListener('dblclick', () => panToNeighbor(state.currentInspectorNeighbors[idx]));
    }
  });
}
