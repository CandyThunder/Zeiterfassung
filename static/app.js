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
const toggleWorkers = document.getElementById('toggleWorkers');
const dateInput = document.getElementById('datum');

let workerMap = new Map();

function formatTwo(num) {
  return String(num).padStart(2, '0');
}

function getTodayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${formatTwo(now.getMonth() + 1)}-${formatTwo(now.getDate())}`;
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
    viewReference.value = `${now.getFullYear()}-${formatTwo(now.getMonth() + 1)}`;
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
  for (let m = 1; m <= 12; m += 1) {
    count += countWeekdaysInMonth(year, m);
  }
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

setDefaultReferenceByMode();
dateInput.max = getTodayIsoDate();

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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
  if (!isWeekday(datum)) return 0;
  return dailySoll;
}

function renderWorkerOptions(workers) {
  workerMap = new Map(workers.map((w) => [String(w.id), w]));
  const options = workers.map((w) => `<option value="${w.id}">${w.vorname} ${w.nachname}</option>`).join('');
  entryWorker.innerHTML = options;
  filterWorker.innerHTML = `<option value="">Alle Mitarbeiter</option>${options}`;
}

async function loadWorkers() {
  const workers = await api('/api/workers');
  renderWorkerOptions(workers);
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
  workerPanel.hidden = false;
  hoursPanel.hidden = true;
  toggleWorkers.textContent = '↩️ Zur Zeiterfassung';
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
  if (id) {
    await api(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/api/workers', { method: 'POST', body: JSON.stringify(payload) });
  }
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

toggleWorkers.addEventListener('click', () => {
  const nowOpen = workerPanel.hidden;
  workerPanel.hidden = !nowOpen;
  hoursPanel.hidden = nowOpen;
  toggleWorkers.textContent = nowOpen ? '↩️ Zur Zeiterfassung' : '⚙️ Mitarbeiter';
});

function getReferenceParams() {
  return { mode: viewMode.value, ref: viewReference.value };
}

function renderSummary(entries, istHours, abwesenheitHours, kontoHours) {
  const statusCount = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  summary.innerHTML = `
    <span class="badge">Einträge: ${entries.length}</span>
    <span class="badge">Ist-Arbeitszeit: ${istHours.toFixed(2)} h</span>
    <span class="badge">Abwesenheit angerechnet: ${abwesenheitHours.toFixed(2)} h</span>
    <span class="badge">Zeitkonto wirksam: ${kontoHours.toFixed(2)} h</span>
    <span class="badge">Anwesend: ${statusCount.anwesend || 0}</span>
    <span class="badge">Krank: ${statusCount.krank || 0}</span>
    <span class="badge">Urlaub: ${statusCount.urlaub || 0}</span>
    <span class="badge">Frei: ${statusCount.frei || 0}</span>
  `;
}

function renderSumRow(entries, istHours, mode, ref) {
  const selectedWorker = filterWorker.value;
  if (!selectedWorker) return '';

  const worker = workerMap.get(selectedWorker);
  if (!worker) return '';

  const weeklySoll = Number(worker.soll_stunden);
  const dailySoll = weeklySoll / 5;
  const abwesenheitHours = entries.reduce((sum, e) => sum + calculateAbwesenheitHours(e, dailySoll), 0);
  const kontoHours = istHours + abwesenheitHours;
  const sollHours = getSollHoursForPeriod(mode, ref, weeklySoll);
  const diff = kontoHours - sollHours;
  const rowClass = diff >= 0 ? 'sum-row sum-positive' : 'sum-row sum-negative';

  return {
    rowHtml: `
      <tr class="${rowClass}">
        <td colspan="5">Summe (${worker.vorname} ${worker.nachname})</td>
        <td>Ist: ${istHours.toFixed(2)} h</td>
        <td>Konto: ${kontoHours.toFixed(2)} h</td>
        <td>Soll: ${sollHours.toFixed(2)} h | ${diff >= 0 ? 'Plus' : 'Minus'}: ${diff.toFixed(2)} h</td>
        <td>Abwesenheit angerechnet: ${abwesenheitHours.toFixed(2)} h</td>
      </tr>
    `,
    abwesenheitHours,
    kontoHours,
  };
}

async function loadEntries() {
  const workerId = filterWorker.value;
  const { mode, ref } = getReferenceParams();
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', workerId);
  if (mode) params.set('zeitraum', mode);
  if (ref) params.set('referenz', ref);

  const entries = await api(`/api/entries?${params.toString()}`);
  const istHours = entries.reduce((sum, e) => sum + calculateHours(e), 0);

  const bodyRows = entries.map((entry) => {
    const hours = calculateHours(entry);
    return `
      <tr>
        <td>${entry.datum}</td>
        <td>${entry.vorname} ${entry.nachname}</td>
        <td><span class="status-pill status-${entry.status}">${entry.status}</span></td>
        <td>${entry.startzeit || '-'}</td>
        <td>${entry.endzeit || '-'}</td>
        <td>${entry.pause_minuten || 0} min</td>
        <td>${hours.toFixed(2)} h</td>
        <td>${entry.notiz || '-'}</td>
        <td class="small-actions">
          <button onclick='editEntry(${JSON.stringify(entry)})'>Bearbeiten</button>
          <button class='secondary' onclick='removeEntry(${entry.id})'>Löschen</button>
        </td>
      </tr>
    `;
  }).join('');

  const sumData = renderSumRow(entries, istHours, mode, ref);
  if (sumData) {
    entryTable.innerHTML = `${bodyRows}${sumData.rowHtml}`;
    renderSummary(entries, istHours, sumData.abwesenheitHours, sumData.kontoHours);
  } else {
    entryTable.innerHTML = bodyRows;
    renderSummary(entries, istHours, 0, istHours);
  }
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
  if (id) {
    await api(`/api/entries/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/api/entries', { method: 'POST', body: JSON.stringify(payload) });
  }
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

filterWorker.addEventListener('change', loadEntries);
viewMode.addEventListener('change', () => {
  setDefaultReferenceByMode();
  loadEntries();
});
viewReference.addEventListener('change', loadEntries);

async function init() {
  await loadWorkers();
  await loadEntries();
}

init();
