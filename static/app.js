const workerForm = document.getElementById('workerForm');
const entryForm = document.getElementById('entryForm');
const workerTable = document.getElementById('workerTable');
const entryTable = document.getElementById('entryTable');
const entryWorker = document.getElementById('entryWorker');
const filterWorker = document.getElementById('filterWorker');
const viewMode = document.getElementById('viewMode');
const viewReference = document.getElementById('viewReference');
const summary = document.getElementById('summary');
const workerPanel = document.getElementById('workerPanel');
const hoursPanel = document.getElementById('hoursPanel');
const toggleMenu = document.getElementById('toggleMenu');
const gearMenu = document.getElementById('gearMenu');
const openWorkerConfig = document.getElementById('openWorkerConfig');
const openExportModalBtn = document.getElementById('openExportModal');
const exportModal = document.getElementById('exportModal');
const exportMonth = document.getElementById('exportMonth');
const exportWorker = document.getElementById('exportWorker');
const confirmExportExcel = document.getElementById('confirmExportExcel');
const confirmExportPdf = document.getElementById('confirmExportPdf');
const closeExportModal = document.getElementById('closeExportModal');
const backToHoursInline = document.getElementById('backToHoursInline');
const dateInput = document.getElementById('datum');

let workerMap = new Map();

function formatTwo(num) { return String(num).padStart(2, '0'); }
function getTodayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${formatTwo(now.getMonth() + 1)}-${formatTwo(now.getDate())}`;
}
function nowMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${formatTwo(now.getMonth() + 1)}`;
}
function formatDateDE(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}
function formatMonthLabelDE(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return yearMonth;
  const label = new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getIsoWeekString(date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return `${temp.getUTCFullYear()}-W${formatTwo(week)}`;
}

function setDefaultReferenceByMode() {
  const now = new Date();
  if (viewMode.value === 'woche') {
    viewReference.type = 'week';
    viewReference.value = getIsoWeekString(now);
  } else if (viewMode.value === 'jahr') {
    viewReference.type = 'number';
    viewReference.min = '2000';
    viewReference.max = '2100';
    viewReference.step = '1';
    viewReference.value = String(now.getFullYear());
  } else {
    viewReference.type = 'month';
    viewReference.value = nowMonth();
  }
}

function isWeekday(dateObj) {
  const day = dateObj.getDay();
  return day >= 1 && day <= 5;
}
function countWeekdaysInMonth(year, month) {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d += 1) {
    if (isWeekday(new Date(year, month - 1, d))) count += 1;
  }
  return count;
}
function countWeekdaysInYear(year) {
  let count = 0;
  for (let m = 1; m <= 12; m += 1) count += countWeekdaysInMonth(year, m);
  return count;
}
function getSollHoursForPeriod(mode, ref, weeklySoll) {
  const dailySoll = weeklySoll / 5;
  if (!ref) return 0;
  if (mode === 'woche') return weeklySoll;
  if (mode === 'jahr') return countWeekdaysInYear(Number(ref)) * dailySoll;
  const [year, month] = ref.split('-').map(Number);
  if (!year || !month) return 0;
  return countWeekdaysInMonth(year, month) * dailySoll;
}

function showWorkerPanel(show) {
  workerPanel.hidden = !show;
  hoursPanel.hidden = show;
  openWorkerConfig.hidden = show;
}

setDefaultReferenceByMode();
dateInput.max = getTodayIsoDate();

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    alert(error.error || 'Fehler bei der Anfrage');
    throw new Error(error.error || 'API-Fehler');
  }
  if (response.status === 204) return null;
  return response.json();
}

function calculateHours(entry) {
  if (entry.status !== 'anwesend' || !entry.startzeit || !entry.endzeit) return 0;
  const start = new Date(`1970-01-01T${entry.startzeit}:00`);
  const end = new Date(`1970-01-01T${entry.endzeit}:00`);
  const minutes = (end - start) / 60000 - (entry.pause_minuten || 0);
  return Math.max(0, minutes / 60);
}
function calculateAbwesenheitHours(entry, dailySoll) {
  if (!(entry.status === 'krank' || entry.status === 'urlaub')) return 0;
  const datum = new Date(`${entry.datum}T00:00:00`);
  return isWeekday(datum) ? dailySoll : 0;
}

function renderWorkerOptions(workers) {
  workerMap = new Map(workers.map((w) => [String(w.id), w]));
  const options = workers.map((w) => `<option value="${w.id}">${w.vorname} ${w.nachname}</option>`).join('');
  entryWorker.innerHTML = options;
  filterWorker.innerHTML = `<option value="">Alle Mitarbeiter</option>${options}`;
  exportWorker.innerHTML = `<option value="" disabled selected>Mitarbeiter auswählen</option>${options}`;
}

async function loadWorkers() {
  const workers = await api('/api/workers');
  renderWorkerOptions(workers);
  filterWorker.value = '';
  workerTable.innerHTML = workers.map((worker) => `
    <tr>
      <td>${worker.vorname} ${worker.nachname}</td>
      <td>${worker.position || '-'}</td>
      <td>${Number(worker.soll_stunden).toFixed(2)} h</td>
      <td class="small-actions">
        <button onclick='editWorker(${JSON.stringify(worker)})'>Bearbeiten</button>
        <button class='secondary' onclick='removeWorker(${worker.id})'>Löschen</button>
      </td>
    </tr>
  `).join('');
}

window.editWorker = (worker) => {
  document.getElementById('workerId').value = worker.id;
  document.getElementById('vorname').value = worker.vorname;
  document.getElementById('nachname').value = worker.nachname;
  document.getElementById('position').value = worker.position || '';
  document.getElementById('sollStunden').value = worker.soll_stunden;
  showWorkerPanel(true);
};

window.removeWorker = async (id) => {
  if (!confirm('Mitarbeiter wirklich löschen? Alle zugehörigen Zeiten werden entfernt.')) return;
  await api(`/api/workers/${id}`, { method: 'DELETE' });
  await loadWorkers();
  await loadEntries();
};

workerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('workerId').value;
  const payload = {
    vorname: document.getElementById('vorname').value,
    nachname: document.getElementById('nachname').value,
    position: document.getElementById('position').value,
    soll_stunden: Number(document.getElementById('sollStunden').value),
  };
  if (id) await api(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  else await api('/api/workers', { method: 'POST', body: JSON.stringify(payload) });

  workerForm.reset();
  document.getElementById('workerId').value = '';
  document.getElementById('sollStunden').value = '40';
  await loadWorkers();
  await loadEntries();
});

document.getElementById('workerReset').addEventListener('click', () => {
  workerForm.reset();
  document.getElementById('workerId').value = '';
  document.getElementById('sollStunden').value = '40';
});

function getReferenceParams() { return { mode: viewMode.value, ref: viewReference.value }; }

function buildTotals(entries, mode, ref, workerId) {
  const istHours = entries.reduce((sum, e) => sum + calculateHours(e), 0);
  if (!workerId) return { istHours, kontoHours: istHours, sollHours: null };

  const worker = workerMap.get(String(workerId));
  if (!worker) return { istHours, kontoHours: istHours, sollHours: null };

  const weeklySoll = Number(worker.soll_stunden);
  const dailySoll = weeklySoll / 5;
  const abwesenheitHours = entries.reduce((sum, e) => sum + calculateAbwesenheitHours(e, dailySoll), 0);
  return {
    istHours,
    kontoHours: istHours + abwesenheitHours,
    sollHours: getSollHoursForPeriod(mode, ref, weeklySoll),
  };
}

function renderSummary(entries, istHours, kontoHours) {
  const statusCount = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  summary.innerHTML = `
    <span class="badge">Einträge: ${entries.length}</span>
    <span class="badge">Ist-Arbeitszeit: ${istHours.toFixed(2)} h</span>
    <span class="badge">Zeitkonto: ${kontoHours.toFixed(2)} h</span>
    <span class="badge">Anwesend: ${statusCount.anwesend || 0}</span>
    <span class="badge">Krank: ${statusCount.krank || 0}</span>
    <span class="badge">Urlaub: ${statusCount.urlaub || 0}</span>
    <span class="badge">Frei: ${statusCount.frei || 0}</span>
  `;
}

function renderSumRow(entries, mode, ref) {
  if (entries.length === 0) return '';
  const selectedWorker = filterWorker.value;
  const totals = buildTotals(entries, mode, ref, selectedWorker || null);
  if (!selectedWorker) {
    return `
      <tr class="sum-row">
        <td colspan="6">Summe (alle Mitarbeiter)</td>
        <td>Ist: ${totals.istHours.toFixed(2)} h</td>
        <td>Konto: -</td>
        <td>Soll: Mitarbeiterfilter wählen</td>
      </tr>
    `;
  }
  return `
    <tr class="sum-row">
      <td colspan="6">Summe</td>
      <td>Ist: ${totals.istHours.toFixed(2)} h</td>
      <td>Konto: ${totals.kontoHours.toFixed(2)} h</td>
      <td>Soll: ${totals.sollHours.toFixed(2)} h</td>
    </tr>
  `;
}

function renderYearRows(entries) {
  const byMonth = new Map();
  entries.forEach((e) => {
    const monthKey = e.datum.slice(0, 7);
    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, {
        datum: monthKey,
        vorname: e.vorname,
        nachname: e.nachname,
        ist: 0,
        statusCount: { anwesend: 0, krank: 0, urlaub: 0, frei: 0 },
      });
    }
    const m = byMonth.get(monthKey);
    m.ist += calculateHours(e);
    m.statusCount[e.status] = (m.statusCount[e.status] || 0) + 1;
  });

  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, m]) => `
      <tr>
        <td>${formatMonthLabelDE(m.datum)}</td>
        <td>${filterWorker.value ? `${m.vorname} ${m.nachname}` : 'Gemischt'}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>${m.ist.toFixed(2)} h</td>
        <td>Anwesend: ${m.statusCount.anwesend} | Krank: ${m.statusCount.krank} | Urlaub: ${m.statusCount.urlaub}</td>
        <td>-</td>
      </tr>
    `).join('');
}

async function loadEntries() {
  const workerId = filterWorker.value;
  const { mode, ref } = getReferenceParams();
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', workerId);
  if (mode) params.set('zeitraum', mode);
  if (ref) params.set('referenz', ref);

  const entries = await api(`/api/entries?${params.toString()}`);
  const totals = buildTotals(entries, mode, ref, workerId || null);

  const bodyRows = mode === 'jahr'
    ? renderYearRows(entries)
    : entries.map((entry) => `
      <tr>
        <td>${formatDateDE(entry.datum)}</td>
        <td>${entry.vorname} ${entry.nachname}</td>
        <td><span class="status-pill status-${entry.status}">${entry.status}</span></td>
        <td>${entry.startzeit || '-'}</td>
        <td>${entry.endzeit || '-'}</td>
        <td>${entry.pause_minuten || 0} min</td>
        <td>${calculateHours(entry).toFixed(2)} h</td>
        <td>${entry.notiz || '-'}</td>
        <td class="small-actions">
          <button onclick='editEntry(${JSON.stringify(entry)})'>Bearbeiten</button>
          <button class='secondary' onclick='removeEntry(${entry.id})'>Löschen</button>
        </td>
      </tr>
    `).join('');

  entryTable.innerHTML = `${bodyRows}${renderSumRow(entries, mode, ref)}`;
  renderSummary(entries, totals.istHours, totals.kontoHours);
}

window.editEntry = (entry) => {
  document.getElementById('entryId').value = entry.id;
  document.getElementById('entryWorker').value = entry.worker_id;
  document.getElementById('datum').value = entry.datum;
  document.getElementById('status').value = entry.status;
  document.getElementById('startzeit').value = entry.startzeit || '';
  document.getElementById('endzeit').value = entry.endzeit || '';
  document.getElementById('pause').value = entry.pause_minuten || 0;
  document.getElementById('notiz').value = entry.notiz || '';
};

window.removeEntry = async (id) => {
  if (!confirm('Eintrag wirklich löschen?')) return;
  await api(`/api/entries/${id}`, { method: 'DELETE' });
  await loadEntries();
};

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedDate = document.getElementById('datum').value;
  if (selectedDate > getTodayIsoDate()) {
    alert('Es können keine Stunden für zukünftige Tage erfasst werden.');
    return;
  }

  const id = document.getElementById('entryId').value;
  const payload = {
    worker_id: Number(document.getElementById('entryWorker').value),
    datum: selectedDate,
    status: document.getElementById('status').value,
    startzeit: document.getElementById('startzeit').value || null,
    endzeit: document.getElementById('endzeit').value || null,
    pause_minuten: Number(document.getElementById('pause').value || 0),
    notiz: document.getElementById('notiz').value,
  };
  if (id) await api(`/api/entries/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  else await api('/api/entries', { method: 'POST', body: JSON.stringify(payload) });

  entryForm.reset();
  document.getElementById('entryId').value = '';
  dateInput.max = getTodayIsoDate();
  await loadEntries();
});

document.getElementById('entryReset').addEventListener('click', () => {
  entryForm.reset();
  document.getElementById('entryId').value = '';
  dateInput.max = getTodayIsoDate();
});

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchExportEntries(month, workerId) {
  const params = new URLSearchParams({ zeitraum: 'monat', referenz: month, worker_id: workerId });
  return api(`/api/entries?${params.toString()}`);
}

function exportAsCsv(entries, month, workerId) {
  const worker = workerMap.get(String(workerId));
  const workerName = `${worker.vorname} ${worker.nachname}`;
  const totals = buildTotals(entries, 'monat', month, workerId);

  const lines = [
    `Zeiterfassung;${workerName};${formatMonthLabelDE(month)}`,
    'Datum;Status;Start;Ende;Pause(min);Ist(h);Notiz',
  ];

  for (const e of entries) {
    lines.push([
      formatDateDE(e.datum),
      e.status,
      e.startzeit || '',
      e.endzeit || '',
      String(e.pause_minuten || 0),
      calculateHours(e).toFixed(2).replace('.', ','),
      (e.notiz || '').replace(/;/g, ',').replace(/\n/g, ' '),
    ].join(';'));
  }
  lines.push('');
  lines.push(`Summe;;;;;Ist: ${totals.istHours.toFixed(2).replace('.', ',')};Konto: ${totals.kontoHours.toFixed(2).replace('.', ',')} | Soll: ${totals.sollHours.toFixed(2).replace('.', ',')}`);
  downloadFile(`zeiterfassung_${workerName.replace(/\s+/g, '_')}_${month}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
}

function exportAsPdf(entries, month, workerId) {
  const worker = workerMap.get(String(workerId));
  const workerName = `${worker.vorname} ${worker.nachname}`;
  const totals = buildTotals(entries, 'monat', month, workerId);

  const rows = entries.map((e) => `
    <tr>
      <td>${formatDateDE(e.datum)}</td><td>${e.status}</td><td>${e.startzeit || '-'}</td>
      <td>${e.endzeit || '-'}</td><td>${e.pause_minuten || 0}</td>
      <td>${calculateHours(e).toFixed(2)}</td><td>${e.notiz || '-'}</td>
    </tr>
  `).join('');

  const win = window.open('', '_blank');
  if (!win) return alert('Popup wurde blockiert. Bitte Popup-Freigabe aktivieren.');
  win.document.write(`
    <html lang="de"><head><title>Zeiterfassung ${month}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; color: #1f2937; font-size: 11px; }
        h1 { color: #1d4f45; margin: 0 0 6px; font-size: 18px; }
        .meta { margin-bottom: 8px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cfd8d6; padding: 4px 6px; text-align: left; font-size: 10px; }
        th { background: #eef7f4; }
        .sum { margin-top: 10px; font-weight: 700; }
      </style>
    </head><body>
      <h1>Zeiterfassung – ${workerName}</h1>
      <div class="meta">Monat: ${formatMonthLabelDE(month)}</div>
      <table>
        <thead><tr><th>Datum</th><th>Status</th><th>Start</th><th>Ende</th><th>Pause</th><th>Ist</th><th>Notiz</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sum">Summe – Ist: ${totals.istHours.toFixed(2)} h | Konto: ${totals.kontoHours.toFixed(2)} h | Soll: ${totals.sollHours.toFixed(2)} h</div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function openExportModal() {
  exportMonth.value = viewMode.value === 'monat' && viewReference.value ? viewReference.value : nowMonth();
  exportWorker.value = '';
  exportModal.hidden = false;
}

toggleMenu.addEventListener('click', () => { gearMenu.hidden = !gearMenu.hidden; });
openWorkerConfig.addEventListener('click', () => { showWorkerPanel(true); gearMenu.hidden = true; });
openExportModalBtn.addEventListener('click', () => { openExportModal(); gearMenu.hidden = true; });
backToHoursInline.addEventListener('click', () => { showWorkerPanel(false); });
closeExportModal.addEventListener('click', () => { exportModal.hidden = true; });

confirmExportExcel.addEventListener('click', async () => {
  if (!exportMonth.value) return alert('Bitte Monat auswählen.');
  if (!exportWorker.value) return alert('Bitte Mitarbeiter auswählen.');
  const entries = await fetchExportEntries(exportMonth.value, exportWorker.value);
  exportAsCsv(entries, exportMonth.value, exportWorker.value);
  exportModal.hidden = true;
});

confirmExportPdf.addEventListener('click', async () => {
  if (!exportMonth.value) return alert('Bitte Monat auswählen.');
  if (!exportWorker.value) return alert('Bitte Mitarbeiter auswählen.');
  const entries = await fetchExportEntries(exportMonth.value, exportWorker.value);
  exportAsPdf(entries, exportMonth.value, exportWorker.value);
  exportModal.hidden = true;
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.gear-wrap')) gearMenu.hidden = true;
});

filterWorker.addEventListener('change', loadEntries);
viewMode.addEventListener('change', () => { setDefaultReferenceByMode(); loadEntries(); });
viewReference.addEventListener('change', loadEntries);

async function init() {
  await loadWorkers();
  await loadEntries();
}

init();
