const workerForm = document.getElementById('workerForm');
const entryForm = document.getElementById('entryForm');
const workerTable = document.getElementById('workerTable');
const entryTable = document.getElementById('entryTable');
const entryWorker = document.getElementById('entryWorker');
const filterWorker = document.getElementById('filterWorker');
const viewMode = document.getElementById('viewMode');
const viewReference = document.getElementById('viewReference');
const summary = document.getElementById('summary');

const now = new Date();
viewReference.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

function renderWorkerOptions(workers) {
  const options = workers.map(w => `<option value="${w.id}">${w.vorname} ${w.nachname}</option>`).join('');
  entryWorker.innerHTML = options;
  filterWorker.innerHTML = `<option value="">Alle Mitarbeiter</option>${options}`;
}

async function loadWorkers() {
  const workers = await api('/api/workers');
  renderWorkerOptions(workers);
  workerTable.innerHTML = workers.map(worker => `
    <tr>
      <td>${worker.vorname} ${worker.nachname}</td>
      <td>${worker.position || '-'}</td>
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
  };
  if (id) {
    await api(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/api/workers', { method: 'POST', body: JSON.stringify(payload) });
  }
  workerForm.reset();
  document.getElementById('workerId').value = '';
  await loadWorkers();
  await loadEntries();
});

document.getElementById('workerReset').addEventListener('click', () => {
  workerForm.reset();
  document.getElementById('workerId').value = '';
});

function getReferenceParams() {
  const mode = viewMode.value;
  const ref = viewReference.value;
  if (!ref) return { mode, ref: '' };
  if (mode === 'woche') {
    const date = new Date(`${ref}-01`);
    const firstJan = new Date(date.getFullYear(), 0, 1);
    const day = Math.floor((date - firstJan) / 86400000);
    const week = String(Math.ceil((day + firstJan.getDay() + 1) / 7)).padStart(2, '0');
    return { mode, ref: `${date.getFullYear()}-W${week}` };
  }
  if (mode === 'jahr') {
    return { mode, ref: ref.split('-')[0] };
  }
  return { mode, ref };
}

async function loadEntries() {
  const workerId = filterWorker.value;
  const { mode, ref } = getReferenceParams();
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', workerId);
  if (mode) params.set('zeitraum', mode);
  if (ref) params.set('referenz', ref);

  const entries = await api(`/api/entries?${params}`);
  const total = entries.reduce((sum, e) => sum + calculateHours(e), 0);
  const statusCount = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  summary.innerHTML = `
    <span class="badge">Einträge: ${entries.length}</span>
    <span class="badge">Arbeitsstunden: ${total.toFixed(2)} h</span>
    <span class="badge">Anwesend: ${statusCount.anwesend || 0}</span>
    <span class="badge">Krank: ${statusCount.krank || 0}</span>
    <span class="badge">Urlaub: ${statusCount.urlaub || 0}</span>
    <span class="badge">Frei: ${statusCount.frei || 0}</span>
  `;

  entryTable.innerHTML = entries.map(entry => {
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
  const id = document.getElementById('entryId').value;
  const payload = {
    worker_id: Number(document.getElementById('entryWorker').value),
    datum: document.getElementById('datum').value,
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
  await loadEntries();
});

document.getElementById('entryReset').addEventListener('click', () => {
  entryForm.reset();
  document.getElementById('entryId').value = '';
});

filterWorker.addEventListener('change', loadEntries);
viewMode.addEventListener('change', () => {
  viewReference.type = viewMode.value === 'jahr' ? 'number' : 'month';
  if (viewMode.value === 'jahr') viewReference.value = String(new Date().getFullYear());
  else viewReference.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  loadEntries();
});
viewReference.addEventListener('change', loadEntries);

async function init() {
  await loadWorkers();
  await loadEntries();
}

init();
