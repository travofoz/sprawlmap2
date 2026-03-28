export function openPanel(tab) {
  const panel = document.getElementById('panel');
  if (panel) panel.classList.add('open');
  
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  
  ['parcels', 'inspector', 'resources', 'ask'].forEach(id => {
    const el = document.getElementById(`tab-${id}`);
    if (el) el.style.display = id === tab ? 'block' : 'none';
  });
}

export function togglePanel() {
  const panel = document.getElementById('panel');
  if (panel) panel.classList.toggle('open');
}

export function closePanel() {
  const panel = document.getElementById('panel');
  if (panel) panel.classList.remove('open');
}

export function toggleLegend() {
  const content = document.getElementById('legend-content');
  const toggle = document.getElementById('legend-toggle');
  if (content && toggle) {
    content.classList.toggle('collapsed');
    toggle.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
  }
}
