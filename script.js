/**
 * script.js
 * ------------------------------------------------------------------
 * Application logic for the Asset Condition Appraisal / Technical
 * Report generator. Handles: dashboard (CRUD + search over
 * localStorage), the multi-tab report editor, live auto-calculations,
 * and the PDF preview (rendered with pdf.js from bytes produced by
 * pdfgen.js).
 * ------------------------------------------------------------------
 */

const STORAGE_KEY = 'aca_reports_v1';
const THEME_KEY = 'aca_theme';

/* ------------------------------------------------------------------ */
/* Observation checklist source data (29 lines from the printed form)  */
/* ------------------------------------------------------------------ */
const OBSERVATION_ITEMS = [
  { n: 1, text: 'Equipment is …………… years old, purchase value is RM……………', special: 'row1' },
  { n: 2, text: 'Equipment condition:', special: 'row2' },
  { n: 3, text: 'Equipment physical condition is poor / It is rusted' },
  { n: 4, text: 'Equipment parts are missing' },
  { n: 5, text: 'Its failure rate is high (support with failure rate data last 12 months)' },
  { n: 6, text: 'Equipment safety test failed (safety test report to attached)' },
  { n: 7, text: 'Conformance to IEC 60601-1 could not be established from the available label / documents' },
  { n: 8, text: 'Equipment is locally manufactured and does not meet the IEC 60601-1 safety standards' },
  { n: 9, text: 'Rated Voltage is ……V, does not conform to local standard 240V (not for BER record)', special: 'row9' },
  { n: 10, text: 'Equipment chasis is not grounded and does not meet the required electrical safety standard' },
  { n: 11, text: 'Reliability and availability of spare parts source could not be established (only with document evidence)' },
  { n: 12, text: 'Equipment is obsolete model. Ref. Supportive documents No…', special: 'ref12' },
  { n: 13, text: 'Product discontinued, spare parts are no longer available. Ref. Supportive documents no…', special: 'ref13' },
  { n: 14, text: 'Repair cost exceeds depreciated value. (For equipment NTW/more than ASHE life span)' },
  { n: 15, text: 'Genuine spare parts are no longer available from supplier. Ref. Supportive documents no…', special: 'ref15' },
  { n: 16, text: 'A newer model has better features, efficiency and capacity' },
  { n: 17, text: 'Equipment does not have the required statutory certificate (X-Ray, CT, Angio, Radiotherapy, etc)' },
  { n: 18, text: 'Equipment is under warranty / Warranty expires by ……', special: 'row18' },
  { n: 19, text: 'Users are not satisfied with the performance of the equipment. Ref. Supportive documents no…' },
  { n: 20, text: 'Equipment is out of specifications even after repair' },
  { n: 21, text: 'Third party maintenance no longer available. Ref. Supportive documents no…', special: 'ref21' },
  { n: 22, text: 'Technical support from vendor is poor / Job cannot be completed within required time' },
  { n: 23, text: 'Equipment is not in use due to high running cost. Ref. Supportive documents no…', special: 'ref23' },
  { n: 24, text: 'Unreliable technical support due to change of manufacturer / suppliers. Ref. Support documents no…' },
  { n: 25, text: 'Poor user maintenance' },
  { n: 26, text: 'Failure of device shall cause disruption of service and/or patient treatment due to inadequate number of device(s) in the hospital' },
  { n: 27, text: 'Damage, required extensive repair. It is uneconomical to regain the proper level of reliability (attach repair cost details)' },
  { n: 28, text: 'High risk device as per FDA classification' },
  { n: 29, text: 'Maintenance to be continued on a best effort basis until genuine spare parts can be sourced' },
];

const ROW2_OPTIONS = [
  { key: 'working', label: 'Working' },
  { key: 'partiallyFunctioning', label: 'Partially functioning' },
  { key: 'notWorking', label: 'Not working' },
  { key: 'inactiveInStorage', label: 'Inactive in storage' },
  { key: 'damage', label: 'Damage' },
];

/* ------------------------------------------------------------------ */
/* App state                                                           */
/* ------------------------------------------------------------------ */
let currentReportId = null; // null => unsaved new report
let previewZoom = 1.0;
let lastGeneratedBytes = null;

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */
function loadAllReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read reports from storage', e);
    return [];
  }
}

function saveAllReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function upsertReport(report) {
  const all = loadAllReports();
  const idx = all.findIndex((r) => r.id === report.id);
  if (idx >= 0) all[idx] = report; else all.push(report);
  saveAllReports(all);
}

function deleteReport(id) {
  const all = loadAllReports().filter((r) => r.id !== id);
  saveAllReports(all);
}

function getReport(id) {
  return loadAllReports().find((r) => r.id === id);
}

function newReportSkeleton() {
  return {
    id: 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    observations: {},
    recommendations: [''],
    refDocs: {},
  };
}

/* ------------------------------------------------------------------ */
/* Toast helper                                                        */
/* ------------------------------------------------------------------ */
function showToast(message) {
  document.getElementById('appToastBody').textContent = message;
  const toastEl = document.getElementById('appToast');
  bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2200 }).show();
}

/* ------------------------------------------------------------------ */
/* Theme toggle                                                        */
/* ------------------------------------------------------------------ */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-bs-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-bs-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const icon = document.querySelector('#themeToggle i');
  icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
}

/* ------------------------------------------------------------------ */
/* View switching                                                      */
/* ------------------------------------------------------------------ */
function showView(name) {
  ['dashboard', 'editor', 'preview'].forEach((v) => {
    document.getElementById('view-' + v).classList.toggle('d-none', v !== name);
  });
  if (name === 'dashboard') renderDashboard();
}

/* ------------------------------------------------------------------ */
/* DASHBOARD                                                           */
/* ------------------------------------------------------------------ */
function renderDashboard() {
  const all = loadAllReports();

  document.getElementById('statTotal').textContent = all.length;
  document.getElementById('statDrafts').textContent = all.filter((r) => r.status === 'draft').length;
  document.getElementById('statBer').textContent = all.filter((r) => r.ber1 || r.ber2).length;
  document.getElementById('statWarranty').textContent = all.filter((r) => isUnderWarranty(r.warrantyExpiry)).length;

  populateFilterOptions(all);

  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const hospitalFilter = document.getElementById('filterHospital').value;
  const deptFilter = document.getElementById('filterDepartment').value;
  const statusFilter = document.getElementById('filterStatus').value;

  const filtered = all.filter((r) => {
    if (hospitalFilter && r.hospitalName !== hospitalFilter) return false;
    if (deptFilter && r.department !== deptFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const hay = [r.assetNumber, r.serialNo, r.hospitalName, r.department, r.manufacturer]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const tbody = document.getElementById('reportsTableBody');
  tbody.innerHTML = '';
  document.getElementById('emptyState').classList.toggle('d-none', all.length > 0);

  filtered.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(r.assetNumber || '—')}</strong></td>
      <td>${escapeHtml(r.hospitalName || '—')}</td>
      <td>${escapeHtml(r.department || '—')}</td>
      <td>${escapeHtml(r.manufacturer || '—')}</td>
      <td><span class="badge ${r.status === 'final' ? 'badge-final' : 'badge-draft'}">${r.status}</span></td>
      <td class="small text-muted">${new Date(r.updatedAt).toLocaleString()}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" data-action="open" data-id="${r.id}" title="Open"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-secondary" data-action="duplicate" data-id="${r.id}" title="Duplicate"><i class="bi bi-files"></i></button>
          <button class="btn btn-outline-secondary" data-action="export" data-id="${r.id}" title="Export JSON"><i class="bi bi-download"></i></button>
          <button class="btn btn-outline-danger" data-action="delete" data-id="${r.id}" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function populateFilterOptions(all) {
  const hospitalSel = document.getElementById('filterHospital');
  const deptSel = document.getElementById('filterDepartment');
  const currentHospital = hospitalSel.value;
  const currentDept = deptSel.value;

  const hospitals = [...new Set(all.map((r) => r.hospitalName).filter(Boolean))].sort();
  const depts = [...new Set(all.map((r) => r.department).filter(Boolean))].sort();

  hospitalSel.innerHTML = '<option value="">All</option>' + hospitals.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
  deptSel.innerHTML = '<option value="">All</option>' + depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

  hospitalSel.value = currentHospital;
  deptSel.value = currentDept;
}

function isUnderWarranty(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ------------------------------------------------------------------ */
/* EDITOR                                                               */
/* ------------------------------------------------------------------ */
function buildObservationList() {
  const container = document.getElementById('observationList');
  container.innerHTML = '';
  OBSERVATION_ITEMS.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'obs-item' + (item.special === 'row2' ? ' row2-options' : '');

    let extraInput = '';
    if (item.special === 'row1') {
      extraInput = `<div class="small text-muted mt-1">Age &amp; purchase value are filled automatically from Asset Info + auto-calculation.</div>`;
    } else if (item.special === 'row9') {
      extraInput = `<div class="mt-1"><input class="form-control form-control-sm w-auto d-inline-block" style="width:140px" data-field="ratedVoltage" placeholder="e.g. 110"> V</div>`;
    } else if (item.special === 'row18') {
      extraInput = `<div class="small text-muted mt-1">Uses the Warranty Expiry Date from Asset Info.</div>`;
    } else if (item.special && item.special.startsWith('ref')) {
      const refKey = item.special.replace('ref', '');
      extraInput = `<div class="mt-1"><input class="form-control form-control-sm" data-ref="${refKey}" placeholder="Reference document no."></div>`;
    }

    let checkboxHtml = '';
    if (item.special !== 'row2') {
      checkboxHtml = `<input class="form-check-input obs-checkbox mt-1" type="checkbox" data-row="${item.n}">`;
    } else {
      checkboxHtml = `<span class="mt-1"><i class="bi bi-list-check text-muted"></i></span>`;
    }

    wrapper.innerHTML = `
      <div class="obs-index">${item.n}</div>
      ${checkboxHtml}
      <div class="flex-grow-1">
        <label class="mb-0">${escapeHtml(item.text)}</label>
        ${extraInput}
        ${item.special === 'row2' ? `<div class="sub-options">${ROW2_OPTIONS.map((o) => `
          <div class="form-check">
            <input class="form-check-input row2-radio" type="radio" name="row2Condition" value="${o.key}" id="row2_${o.key}">
            <label class="form-check-label" for="row2_${o.key}">${o.label}</label>
          </div>`).join('')}</div>` : ''}
      </div>`;
    container.appendChild(wrapper);
  });
}

function buildRecommendationRow(index, value) {
  const row = document.createElement('div');
  row.className = 'rec-row';
  row.innerHTML = `
    <span class="rec-num">${index + 1}</span>
    <input class="form-control form-control-sm rec-input" value="${escapeHtml(value || '')}" placeholder="Recommendation text…">
    <button type="button" class="btn btn-sm btn-outline-danger rec-remove" title="Remove"><i class="bi bi-x-lg"></i></button>`;
  return row;
}

function renderRecommendations(list) {
  const container = document.getElementById('recommendationList');
  container.innerHTML = '';
  (list.length ? list : ['']).forEach((val, idx) => {
    container.appendChild(buildRecommendationRow(idx, val));
  });
  renumberRecommendations();
  updateAddRecommendationState();
}

function renumberRecommendations() {
  document.querySelectorAll('#recommendationList .rec-row').forEach((row, i) => {
    row.querySelector('.rec-num').textContent = i + 1;
  });
}

function updateAddRecommendationState() {
  const count = document.querySelectorAll('#recommendationList .rec-row').length;
  document.getElementById('addRecommendationBtn').disabled = count >= 6;
}

/** Read the entire editor form + widgets into a plain data object. */
function collectFormData() {
  const form = document.getElementById('reportForm');
  const fd = new FormData(form);
  const data = {};
  for (const [key, val] of fd.entries()) {
    if (key === 'equipmentCondition') continue; // handled via radios below
    data[key] = val;
  }
  // radios (FormData already grabs the checked one under its `name`, but
  // ensure explicit handling since unchecked radios are simply absent)
  const condRadio = form.querySelector('input[name="equipmentCondition"]:checked');
  data.equipmentCondition = condRadio ? condRadio.value : null;

  const row2Radio = document.querySelector('input[name="row2Condition"]:checked');
  data.row2Condition = row2Radio ? row2Radio.value : null;

  data.ratedVoltage = (document.querySelector('[data-field="ratedVoltage"]') || {}).value || '';

  data.exemptionChecked = document.getElementById('exemptionBox').checked;

  data.observations = {};
  document.querySelectorAll('.obs-checkbox').forEach((cb) => {
    data.observations[cb.dataset.row] = cb.checked;
  });

  data.refDocs = {};
  document.querySelectorAll('[data-ref]').forEach((inp) => {
    data.refDocs[inp.dataset.ref] = inp.value;
  });

  data.recommendations = Array.from(document.querySelectorAll('#recommendationList .rec-input')).map((i) => i.value);

  return data;
}

function populateFormFromData(data) {
  const form = document.getElementById('reportForm');
  form.reset();
  Object.keys(data).forEach((key) => {
    const el = form.elements.namedItem(key);
    if (!el) return;
    if (el instanceof RadioNodeList) return; // handled separately
    el.value = data[key] ?? '';
  });

  if (data.equipmentCondition) {
    const el = form.querySelector(`input[name="equipmentCondition"][value="${data.equipmentCondition}"]`);
    if (el) el.checked = true;
  }
  document.getElementById('exemptionBox').checked = !!data.exemptionChecked;

  buildObservationList();
  document.querySelectorAll('.obs-checkbox').forEach((cb) => {
    cb.checked = !!(data.observations && data.observations[cb.dataset.row]);
  });
  if (data.row2Condition) {
    const r = document.querySelector(`input[name="row2Condition"][value="${data.row2Condition}"]`);
    if (r) r.checked = true;
  }
  const rv = document.querySelector('[data-field="ratedVoltage"]');
  if (rv) rv.value = data.ratedVoltage || '';
  document.querySelectorAll('[data-ref]').forEach((inp) => {
    inp.value = (data.refDocs && data.refDocs[inp.dataset.ref]) || '';
  });

  renderRecommendations(data.recommendations || ['']);
  runCalculations();
}

function openEditor(reportId) {
  currentReportId = reportId;
  const data = reportId ? getReport(reportId) : newReportSkeleton();
  if (!data) { showToast('Report not found.'); showView('dashboard'); return; }

  document.getElementById('editorTitle').textContent = reportId ? `Editing: ${data.assetNumber || 'Untitled'}` : 'New Report';
  const badge = document.getElementById('editorStatusBadge');
  badge.textContent = data.status === 'final' ? 'Final' : 'Draft';
  badge.className = 'badge ' + (data.status === 'final' ? 'badge-final' : 'badge-draft');

  populateFormFromData(data);
  switchTab('asset');
  showView('editor');
}

function switchTab(name) {
  document.querySelectorAll('#editorTabs .nav-link').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.toggle('d-none', pane.dataset.pane !== name);
  });
}

/* ------------------------------------------------------------------ */
/* AUTO CALCULATIONS                                                    */
/* ------------------------------------------------------------------ */
function runCalculations() {
  const form = document.getElementById('reportForm');
  const purchaseDate = form.elements.purchaseDate.value;
  const warrantyExpiry = form.elements.warrantyExpiry.value;
  const purchaseValue = parseFloat(form.elements.purchaseValue.value) || 0;
  const lifeSpanYears = parseFloat(form.elements.lifeSpanYears.value) || 0;
  const depreciationRate = parseFloat(form.elements.depreciationRate.value) || 0;

  let ageYears = null;
  if (purchaseDate) {
    const now = new Date();
    const pd = new Date(purchaseDate);
    if (!isNaN(pd.getTime())) {
      ageYears = ((now - pd) / (1000 * 60 * 60 * 24 * 365.25));
    }
  }

  const depreciatedValue = (ageYears !== null && purchaseValue)
    ? Math.max(0, purchaseValue * (1 - (depreciationRate / 100) * ageYears))
    : null;

  let warrantyRemainingDays = null;
  if (warrantyExpiry) {
    const we = new Date(warrantyExpiry);
    if (!isNaN(we.getTime())) warrantyRemainingDays = Math.round((we - new Date()) / (1000 * 60 * 60 * 24));
  }

  const currentValue = depreciatedValue; // same model used for "current value" figure

  document.getElementById('calcAge').textContent = ageYears !== null ? `${ageYears.toFixed(1)} yrs` : '–';
  document.getElementById('calcDepreciated').textContent = depreciatedValue !== null ? `RM ${depreciatedValue.toFixed(2)}` : '–';
  document.getElementById('calcWarranty').textContent = warrantyRemainingDays !== null
    ? (warrantyRemainingDays >= 0 ? `${warrantyRemainingDays} days left` : `Expired ${Math.abs(warrantyRemainingDays)}d ago`)
    : '–';
  document.getElementById('calcCurrent').textContent = currentValue !== null ? `RM ${currentValue.toFixed(2)}` : '–';

  return {
    ageYears: ageYears !== null ? ageYears.toFixed(1) : null,
    depreciatedValue: depreciatedValue !== null ? depreciatedValue.toFixed(2) : null,
    warrantyRemainingDays,
    currentValue: currentValue !== null ? currentValue.toFixed(2) : null,
    lifeSpanYears,
  };
}

/* ------------------------------------------------------------------ */
/* SAVE / DUPLICATE / DELETE                                            */
/* ------------------------------------------------------------------ */
function saveDraft(showMessage = true) {
  const data = collectFormData();
  data.calc = runCalculations();
  const existing = currentReportId ? getReport(currentReportId) : null;
  const report = Object.assign(existing || newReportSkeletonWithId(currentReportId), data);
  report.updatedAt = new Date().toISOString();
  if (!report.status) report.status = 'draft';
  currentReportId = report.id;
  upsertReport(report);
  if (showMessage) showToast('Draft saved.');
  document.getElementById('editorTitle').textContent = `Editing: ${report.assetNumber || 'Untitled'}`;
  return report;
}

function newReportSkeletonWithId(id) {
  const skel = newReportSkeleton();
  if (id) skel.id = id;
  return skel;
}

function duplicateCurrentReport() {
  const saved = saveDraft(false);
  const copy = JSON.parse(JSON.stringify(saved));
  copy.id = 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  copy.status = 'draft';
  copy.assetNumber = (copy.assetNumber || '') + ' (Copy)';
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = copy.createdAt;
  upsertReport(copy);
  showToast('Report duplicated.');
  openEditor(copy.id);
}

function deleteCurrentReport() {
  if (!currentReportId) { showView('dashboard'); return; }
  if (!confirm('Delete this report permanently? This cannot be undone.')) return;
  deleteReport(currentReportId);
  currentReportId = null;
  showToast('Report deleted.');
  showView('dashboard');
}

/* ------------------------------------------------------------------ */
/* PDF GENERATION + PREVIEW                                             */
/* ------------------------------------------------------------------ */
async function generateAndPreview() {
  const report = saveDraft(false);
  report.status = 'final';
  upsertReport(report);

  const btn = document.getElementById('generatePdfBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating…';

  try {
    const bytes = await generateReportPdf(report);
    lastGeneratedBytes = bytes;
    await renderPreview(bytes);
    showView('preview');
  } catch (err) {
    console.error(err);
    showToast('Failed to generate PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function renderPreview(bytes) {
  const container = document.getElementById('previewPages');
  container.innerHTML = '';
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
  const pdf = await loadingTask.promise;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: previewZoom * 1.4 });
    const canvas = document.createElement('canvas');
    canvas.className = 'preview-page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    container.appendChild(canvas);
  }
}

function setZoom(newZoom) {
  previewZoom = Math.max(0.3, Math.min(3, newZoom));
  if (lastGeneratedBytes) renderPreview(lastGeneratedBytes);
}

function downloadPdf() {
  if (!lastGeneratedBytes) return;
  const report = currentReportId ? getReport(currentReportId) : null;
  const filename = `ACA_${(report && report.assetNumber) || 'report'}.pdf`.replace(/\s+/g, '_');
  const blob = new Blob([lastGeneratedBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printPdf() {
  if (!lastGeneratedBytes) return;
  const blob = new Blob([lastGeneratedBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.addEventListener('load', () => w.print());
  }
}

/* ------------------------------------------------------------------ */
/* EXPORT / IMPORT JSON                                                 */
/* ------------------------------------------------------------------ */
function exportReportJson(id) {
  const r = getReport(id);
  if (!r) return;
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(r.assetNumber || 'report')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importReportJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.id) data.id = 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      data.updatedAt = new Date().toISOString();
      upsertReport(data);
      showToast('Report loaded.');
      openEditor(data.id);
    } catch (err) {
      showToast('Invalid report file.');
    }
  };
  reader.readAsText(file);
}

/* ------------------------------------------------------------------ */
/* EVENT WIRING                                                         */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  buildObservationList();
  renderRecommendations(['']);
  showView('dashboard');

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('navDashboardBtn').addEventListener('click', () => showView('dashboard'));
  document.getElementById('navNewReportBtn').addEventListener('click', () => openEditor(null));
  document.getElementById('dashNewReportBtn').addEventListener('click', () => openEditor(null));
  document.getElementById('backToDashboardBtn').addEventListener('click', () => showView('dashboard'));
  document.getElementById('backToEditorBtn').addEventListener('click', () => showView('editor'));

  document.getElementById('loadReportInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importReportJson(file);
    e.target.value = '';
  });

  // dashboard search/filter
  ['searchInput', 'filterHospital', 'filterDepartment', 'filterStatus'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderDashboard);
    document.getElementById(id).addEventListener('change', renderDashboard);
  });
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterHospital').value = '';
    document.getElementById('filterDepartment').value = '';
    document.getElementById('filterStatus').value = '';
    renderDashboard();
  });

  // reports table actions (event delegation)
  document.getElementById('reportsTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'open') openEditor(id);
    else if (action === 'duplicate') { currentReportId = id; duplicateCurrentReport(); }
    else if (action === 'export') exportReportJson(id);
    else if (action === 'delete') {
      if (confirm('Delete this report permanently?')) {
        deleteReport(id);
        showToast('Report deleted.');
        renderDashboard();
      }
    }
  });

  // editor tabs
  document.querySelectorAll('#editorTabs .nav-link').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // recommendation rows
  document.getElementById('addRecommendationBtn').addEventListener('click', () => {
    const container = document.getElementById('recommendationList');
    if (container.children.length >= 6) return;
    container.appendChild(buildRecommendationRow(container.children.length, ''));
    renumberRecommendations();
    updateAddRecommendationState();
  });
  document.getElementById('recommendationList').addEventListener('click', (e) => {
    const btn = e.target.closest('.rec-remove');
    if (!btn) return;
    const container = document.getElementById('recommendationList');
    if (container.children.length <= 1) { btn.closest('.rec-row').querySelector('.rec-input').value = ''; return; }
    btn.closest('.rec-row').remove();
    renumberRecommendations();
    updateAddRecommendationState();
  });

  // live calculations
  document.getElementById('reportForm').addEventListener('input', (e) => {
    if (['purchaseDate', 'warrantyExpiry', 'purchaseValue', 'lifeSpanYears', 'depreciationRate'].includes(e.target.name)) {
      runCalculations();
    }
  });

  // editor actions
  document.getElementById('saveDraftBtn').addEventListener('click', () => saveDraft(true));
  document.getElementById('duplicateBtn').addEventListener('click', duplicateCurrentReport);
  document.getElementById('deleteReportBtn').addEventListener('click', deleteCurrentReport);
  document.getElementById('generatePdfBtn').addEventListener('click', generateAndPreview);

  // preview controls
  document.getElementById('zoomInBtn').addEventListener('click', () => setZoom(previewZoom + 0.2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => setZoom(previewZoom - 0.2));
  document.getElementById('fitWidthBtn').addEventListener('click', () => setZoom(1.0));
  document.getElementById('fitPageBtn').addEventListener('click', () => setZoom(0.75));
  document.getElementById('downloadPdfBtn').addEventListener('click', downloadPdf);
  document.getElementById('printPdfBtn').addEventListener('click', printPdf);
});
