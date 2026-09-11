import { apiPost, apiPut, apiDelete } from '../api.js';
import { apriModal, chiudiModal, mostraToast, bandiera, creaSottoSchede, htmlCampoRicerca, attivaCampoRicerca } from '../utils.js';
import { cache, caricaSquadre, garantisciNazioni, garantisciSponsor } from '../state.js';
import { socket } from '../socket.js';
import { montaListaConForm } from './tabella-dati.js';
import { htmlCampoNazione, attivaCampoNazione } from './nazione-autocomplete.js';
import { icona } from '../icone.js';

let sottoTabAttiva = 'elenco';
let queryCorrente = '';

function renderElenco(corpo) {
  sottoTabAttiva = 'elenco';
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca('cerca squadra o nazione...')}
      <button class="btn-secondary btn-piccolo" id="btnNuovaSquadra">${icona('aggiungi')}nuova squadra</button>
    </div>
    <div class="cards-wrap" id="cardsSquadre"></div>
  `;
  document.getElementById('btnNuovaSquadra').addEventListener('click', async () => {
    await garantisciNazioni();
    apriFormSquadra(null);
  });
  attivaCampoRicerca(corpo, q => { queryCorrente = q; disegnaElenco(); });
  ricaricaElenco();
}

function disegnaElenco() {
  const wrap = document.getElementById('cardsSquadre');
  if (!wrap) return;
  const filtrate = cache.squadre.filter(s => {
    if (!queryCorrente) return true;
    return `${s.nome} ${s.nazione_nome ?? ''}`.toLowerCase().includes(queryCorrente);
  });
  wrap.innerHTML = filtrate.map(s => `
    <div class="squadra-card" style="border-top-color:${s.colore || '#e6197f'}">
      <h3><span class="dot-colore" style="background:${s.colore || '#e6197f'}"></span>${s.nome}</h3>
      <p>${s.nazione_codice ? `<span class="bandiera">${bandiera(s.nazione_codice)}</span>${s.nazione_nome}` : 'nazione non specificata'}</p>
      <div class="row">
        <button class="btn-icon" title="modifica" data-modifica="${s.id}">${icona('modifica')}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${s.id}">${icona('elimina')}</button>
      </div>
    </div>
  `).join('') || `<p style="color:#999;">${queryCorrente ? 'Nessuna squadra trovata' : 'Nessuna squadra inserita'}</p>`;

  wrap.querySelectorAll('[data-modifica]').forEach(b => b.addEventListener('click', async () => {
    await garantisciNazioni();
    const s = cache.squadre.find(s => s.id === +b.dataset.modifica);
    if (s) apriFormSquadra(s);
  }));
  wrap.querySelectorAll('[data-elimina]').forEach(b => b.addEventListener('click', () => eliminaSquadra(+b.dataset.elimina)));
}

async function ricaricaElenco() {
  await caricaSquadre();
  disegnaElenco();
}

function apriFormSquadra(squadraEsistente) {
  const s = squadraEsistente || {};
  apriModal(`
    <h2>${squadraEsistente ? 'Modifica squadra' : 'Nuova squadra'}</h2>
    <div class="field"><label>Nome squadra</label><input id="s_nome" value="${s.nome ?? ''}"></div>
    <div class="field-row">
      ${htmlCampoNazione('s_naz', 'Nazione')}
      <div class="field"><label>Colore</label><input type="color" id="s_colore" value="${s.colore ?? '#e6197f'}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="s_annulla">annulla</button>
      <button class="btn-primary" id="s_salva">${squadraEsistente ? 'salva modifiche' : 'salva squadra'}</button>
    </div>
  `);
  const leggiNazioneId = attivaCampoNazione('s_naz', s.nazione_id ?? null);
  document.getElementById('s_annulla').addEventListener('click', chiudiModal);
  document.getElementById('s_salva').addEventListener('click', () => salvaSquadra(squadraEsistente, leggiNazioneId));
}

async function salvaSquadra(squadraEsistente, leggiNazioneId) {
  const body = {
    nome: document.getElementById('s_nome').value,
    nazione_id: leggiNazioneId(),
    colore: document.getElementById('s_colore').value
  };
  if (!body.nome) { mostraToast('Il nome è obbligatorio'); return; }
  const res = squadraEsistente
    ? await apiPut('/api/squadre/' + squadraEsistente.id, body)
    : await apiPost('/api/squadre', body);
  if (res.ok) { chiudiModal(); mostraToast(squadraEsistente ? 'Squadra modificata' : 'Squadra creata'); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaSquadra(id) {
  if (!confirm('Eliminare questa squadra?')) return;
  await apiDelete('/api/squadre/' + id);
  mostraToast('Squadra eliminata');
}

function renderStaff(corpo) {
  sottoTabAttiva = 'staff';
  montaListaConForm(corpo, {
    titolo: 'Staff tecnico',
    apiPath: '/api/staff-tecnico',
    colonne: [
      { key: 'nome', label: 'Nome', type: 'text' },
      { key: 'cognome', label: 'Cognome', type: 'text' },
      { key: 'ruolo', label: 'Ruolo', type: 'select', opzioni: ['direttore_sportivo','meccanico','medico','massaggiatore','preparatore_atletico'] },
      { key: 'squadra_id', label: 'Squadra', type: 'squadra' }
    ]
  });
}

function renderVeicoli(corpo) {
  sottoTabAttiva = 'veicoli';
  montaListaConForm(corpo, {
    titolo: 'Veicoli squadra',
    apiPath: '/api/veicoli-squadra',
    colonne: [
      { key: 'squadra_id', label: 'Squadra', type: 'squadra' },
      { key: 'tipo', label: 'Tipo', type: 'select', opzioni: ['ammiraglia','furgone','bus','camper'] },
      { key: 'targa', label: 'Targa', type: 'text' },
      { key: 'modello', label: 'Modello', type: 'text' }
    ]
  });
}

function renderSponsor(corpo) {
  sottoTabAttiva = 'sponsor';
  corpo.innerHTML = `<div class="subtab-sezione"><h4>Anagrafica sponsor</h4><div id="listaSponsorAnagrafica"></div></div>
                      <div class="subtab-sezione"><h4>Sponsor per squadra</h4><div id="listaSponsorSquadra"></div></div>`;
  montaListaConForm(document.getElementById('listaSponsorAnagrafica'), {
    titolo: 'Sponsor',
    apiPath: '/api/sponsor',
    colonne: [
      { key: 'nome', label: 'Nome', type: 'text' },
      { key: 'settore', label: 'Settore', type: 'text' },
      { key: 'sito_web', label: 'Sito web', type: 'text' }
    ]
  });
  garantisciSponsor().then(() => {
    montaListaConForm(document.getElementById('listaSponsorSquadra'), {
      titolo: 'Sponsor per squadra',
      apiPath: '/api/squadra-sponsor',
      colonne: [
        { key: 'squadra_id', label: 'Squadra', type: 'squadra' },
        { key: 'sponsor_id', label: 'Sponsor', type: 'sponsor' },
        { key: 'tipo', label: 'Tipo', type: 'select', opzioni: ['main_sponsor','co_sponsor','fornitore_tecnico'] }
      ]
    });
  });
}

function renderAlloggi(corpo) {
  sottoTabAttiva = 'alloggi';
  montaListaConForm(corpo, {
    titolo: 'Alloggi',
    apiPath: '/api/hotel',
    colonne: [
      { key: 'tappa_id', label: 'Tappa', type: 'tappa' },
      { key: 'squadra_id', label: 'Squadra', type: 'squadra' },
      { key: 'nome', label: 'Nome hotel', type: 'text' },
      { key: 'citta', label: 'Città', type: 'text' },
      { key: 'indirizzo', label: 'Indirizzo', type: 'text' }
    ]
  });
}

export function init(container) {
  creaSottoSchede(container, [
    { key: 'elenco', label: 'Elenco squadre' },
    { key: 'staff', label: 'Staff tecnico' },
    { key: 'veicoli', label: 'Veicoli' },
    { key: 'sponsor', label: 'Sponsor' },
    { key: 'alloggi', label: 'Alloggi' }
  ], (key, corpo) => {
    if (key === 'elenco') renderElenco(corpo);
    else if (key === 'staff') renderStaff(corpo);
    else if (key === 'veicoli') renderVeicoli(corpo);
    else if (key === 'sponsor') renderSponsor(corpo);
    else renderAlloggi(corpo);
  });

  socket.on('squadre:aggiornate', () => { if (sottoTabAttiva === 'elenco') ricaricaElenco(); });
}
