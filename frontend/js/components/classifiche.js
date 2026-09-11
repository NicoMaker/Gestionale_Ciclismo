import { apiGet } from '../api.js';
import { creaSottoSchede } from '../utils.js';
import { socket } from '../socket.js';
import { montaListaConForm } from './tabella-dati.js';

let sottoTabAttiva = 'generale';

async function renderGenerale(corpo) {
  sottoTabAttiva = 'generale';
  corpo.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>Tappe</th><th>Punti totali</th></tr></thead>
        <tbody id="tabellaClassificaGenerale"></tbody>
      </table>
    </div>
  `;
  await ricaricaGenerale();
}

async function ricaricaGenerale() {
  const tbody = document.getElementById('tabellaClassificaGenerale');
  if (!tbody) return;
  const dati = await apiGet('/api/risultati/classifica-generale');
  tbody.innerHTML = dati.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? '—'}</td>
      <td>${r.tappe_disputate}</td>
      <td>${r.punti_totali ?? 0}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">Nessun dato disponibile</td></tr>';
}

function renderTipiClassifica(corpo) {
  sottoTabAttiva = 'tipi';
  montaListaConForm(corpo, {
    titolo: 'Tipo di classifica',
    apiPath: '/api/classifiche-tipo',
    colonne: [
      { key: 'nome', label: 'Nome', type: 'text' },
      { key: 'descrizione', label: 'Descrizione', type: 'text' }
    ]
  });
}

export function init(container) {
  creaSottoSchede(container, [
    { key: 'generale', label: 'Classifica generale' },
    { key: 'tipi', label: 'Tipi di classifica' }
  ], (key, corpo) => {
    if (key === 'generale') renderGenerale(corpo);
    else renderTipiClassifica(corpo);
  });

  socket.on('risultati:aggiornati', () => { if (sottoTabAttiva === 'generale') ricaricaGenerale(); });
}
