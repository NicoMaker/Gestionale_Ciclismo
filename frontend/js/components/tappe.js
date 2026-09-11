import { apiPost, apiPut, apiDelete } from '../api.js';
import { apriModal, chiudiModal, mostraToast, creaSottoSchede } from '../utils.js';
import { cache, caricaTappe } from '../state.js';
import { socket } from '../socket.js';
import { montaListaConForm } from './tabella-dati.js';

let sottoTabAttiva = 'elenco';

function renderElenco(corpo) {
  sottoTabAttiva = 'elenco';
  corpo.innerHTML = `
    <div class="subtab-head">
      <button class="btn-secondary btn-piccolo" id="btnNuovaTappa">+ nuova tappa</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Percorso</th><th>Km</th><th>Dislivello</th><th>Tipo</th><th>Data</th><th>Stato</th><th></th></tr></thead>
        <tbody id="tabellaTappe"></tbody>
      </table>
    </div>
  `;

  document.getElementById('btnNuovaTappa').addEventListener('click', () => apriFormTappa(null));
  ricaricaElenco();
}

async function ricaricaElenco() {
  await caricaTappe();
  const tbody = document.getElementById('tabellaTappe');
  if (!tbody) return; // l'utente è passato ad un'altra sotto-scheda
  tbody.innerHTML = cache.tappe.map(t => `
    <tr>
      <td>${t.numero_tappa}</td>
      <td><strong>${t.nome}</strong></td>
      <td>${t.partenza} → ${t.arrivo}</td>
      <td>${t.distanza_km ?? '—'}</td>
      <td>${t.dislivello_m ?? '—'} m</td>
      <td><span class="badge badge-${t.tipo}">${t.tipo}</span></td>
      <td>${t.data ?? '—'}</td>
      <td><span class="badge badge-${t.stato}">${t.stato.replace('_',' ')}</span></td>
      <td>
        <button class="btn-icon" data-diretta="${t.id}">📡 diretta</button>
        <button class="btn-icon" data-modifica="${t.id}">modifica</button>
        <button class="btn-icon danger" data-elimina="${t.id}">elimina</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="9" style="text-align:center;color:#999;padding:24px;">Nessuna tappa inserita</td></tr>';

  tbody.querySelectorAll('[data-diretta]').forEach(b => b.addEventListener('click', () => avviaDiretta(+b.dataset.diretta)));
  tbody.querySelectorAll('[data-modifica]').forEach(b => b.addEventListener('click', () => {
    const t = cache.tappe.find(t => t.id === +b.dataset.modifica);
    if (t) apriFormTappa(t);
  }));
  tbody.querySelectorAll('[data-elimina]').forEach(b => b.addEventListener('click', () => eliminaTappa(+b.dataset.elimina)));
}

function apriFormTappa(tappaEsistente) {
  const t = tappaEsistente || {};
  apriModal(`
    <h2>${tappaEsistente ? 'Modifica tappa' : 'Nuova tappa'}</h2>
    <div class="field-row">
      <div class="field"><label>Numero tappa</label><input type="number" id="f_numero" min="1" value="${t.numero_tappa ?? ''}"></div>
      <div class="field"><label>Tipo</label>
        <select id="f_tipo">
          ${['pianura','collina','montagna','cronometro'].map(v => `<option value="${v}" ${t.tipo === v ? 'selected' : ''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field"><label>Nome tappa</label><input id="f_nome" placeholder="es. Roma – Napoli" value="${t.nome ?? ''}"></div>
    <div class="field-row">
      <div class="field"><label>Partenza</label><input id="f_partenza" value="${t.partenza ?? ''}"></div>
      <div class="field"><label>Arrivo</label><input id="f_arrivo" value="${t.arrivo ?? ''}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Distanza (km)</label><input type="number" step="0.1" id="f_distanza" value="${t.distanza_km ?? ''}"></div>
      <div class="field"><label>Dislivello (m)</label><input type="number" id="f_dislivello" value="${t.dislivello_m ?? ''}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data</label><input type="date" id="f_data" value="${t.data ?? ''}"></div>
      <div class="field"><label>Stato</label>
        <select id="f_stato">
          ${['programmata','in_corso','conclusa'].map(v => `<option value="${v}" ${t.stato === v ? 'selected' : ''}>${v.replace('_',' ')}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="f_annulla">annulla</button>
      <button class="btn-primary" id="f_salva">${tappaEsistente ? 'salva modifiche' : 'salva tappa'}</button>
    </div>
  `);
  document.getElementById('f_annulla').addEventListener('click', chiudiModal);
  document.getElementById('f_salva').addEventListener('click', () => salvaTappa(tappaEsistente));
}

async function salvaTappa(tappaEsistente) {
  const body = {
    numero_tappa: +document.getElementById('f_numero').value,
    nome: document.getElementById('f_nome').value,
    partenza: document.getElementById('f_partenza').value,
    arrivo: document.getElementById('f_arrivo').value,
    distanza_km: +document.getElementById('f_distanza').value || null,
    dislivello_m: +document.getElementById('f_dislivello').value || null,
    tipo: document.getElementById('f_tipo').value,
    data: document.getElementById('f_data').value || null,
    stato: document.getElementById('f_stato') ? document.getElementById('f_stato').value : undefined
  };
  if (!body.numero_tappa || !body.nome || !body.partenza || !body.arrivo) {
    mostraToast('Compila numero, nome, partenza e arrivo'); return;
  }
  const res = tappaEsistente
    ? await apiPut('/api/tappe/' + tappaEsistente.id, body)
    : await apiPost('/api/tappe', body);
  if (res.ok) { chiudiModal(); mostraToast(tappaEsistente ? 'Tappa modificata' : 'Tappa creata'); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaTappa(id) {
  if (!confirm('Eliminare questa tappa?')) return;
  await apiDelete('/api/tappe/' + id);
  mostraToast('Tappa eliminata');
}

function avviaDiretta(tappaId) {
  const t = cache.tappe.find(t => t.id === tappaId);
  socket.emit('tappa:avvia-diretta', tappaId);
  mostraToast(`Diretta avviata: tappa ${t.numero_tappa}`);
}

function renderPercorso(corpo) {
  sottoTabAttiva = 'percorso';
  montaListaConForm(corpo, {
    titolo: 'Percorso di tappa',
    apiPath: '/api/tappe-percorso',
    colonne: [
      { key: 'tappa_id', label: 'Tappa', type: 'tappa' },
      { key: 'km', label: 'Km', type: 'number' },
      { key: 'tipo', label: 'Tipo', type: 'select', opzioni: ['sprint', 'gpm'] },
      { key: 'nome_luogo', label: 'Luogo', type: 'text' },
      { key: 'categoria', label: 'Categoria', type: 'text' }
    ]
  });
}

function renderMeteo(corpo) {
  sottoTabAttiva = 'meteo';
  montaListaConForm(corpo, {
    titolo: 'Meteo di tappa',
    apiPath: '/api/meteo-tappa',
    colonne: [
      { key: 'tappa_id', label: 'Tappa', type: 'tappa' },
      { key: 'temperatura', label: 'Temperatura (°C)', type: 'number' },
      { key: 'condizione', label: 'Condizione', type: 'select', opzioni: ['sereno','nuvoloso','pioggia','vento_forte','neve'] },
      { key: 'vento_kmh', label: 'Vento (km/h)', type: 'number' }
    ]
  });
}

export function init(container) {
  creaSottoSchede(container, [
    { key: 'elenco', label: 'Elenco tappe' },
    { key: 'percorso', label: 'Percorso (sprint / GPM)' },
    { key: 'meteo', label: 'Meteo' }
  ], (key, corpo) => {
    if (key === 'elenco') renderElenco(corpo);
    else if (key === 'percorso') renderPercorso(corpo);
    else renderMeteo(corpo);
  });

  socket.on('tappe:aggiornate', () => { if (sottoTabAttiva === 'elenco') ricaricaElenco(); });
}
