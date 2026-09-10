const socket = io();

// ---------- Bandiera da codice ISO2 (nessuna immagine esterna) ----------
function bandiera(iso2){
  if (!iso2) return '';
  return iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// ---------- Navigazione ----------
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'classifica') caricaClassifica();
    if (btn.dataset.view === 'risultati') caricaRisultatiTappaSelezionata();
    if (btn.dataset.view === 'extra') inizializzaExtra();
  });
});

// ---------- Toast ----------
function mostraToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Modal generico ----------
const overlay = document.getElementById('modalOverlay');
const modalBox = document.getElementById('modalBox');
function apriModal(html){
  modalBox.innerHTML = html;
  overlay.classList.add('active');
}
function chiudiModal(){ overlay.classList.remove('active'); }
overlay.addEventListener('click', e => { if (e.target === overlay) chiudiModal(); });

// ---------- Stato locale ----------
let squadreCache = [];
let corridoriCache = [];
let tappeCache = [];
let nazioniCache = [];
let sponsorCache = [];

async function caricaNazioniComplete(){
  const res = await fetch('/api/nazioni');
  nazioniCache = await res.json();
}

// ===================================================================
// AUTOCOMPLETE NAZIONI (ricerca con bandiera)
// ===================================================================
// Trasforma un <input data-nazione-input> + <input type="hidden" data-nazione-id> in un
// campo di ricerca con dropdown di risultati (bandiera + nome), pescando tra le nazioni esistenti.
function attivaAutocompleteNazione(wrapEl, valoreIniziale){
  const input = wrapEl.querySelector('.autocomplete-input');
  const hidden = wrapEl.querySelector('.autocomplete-hidden');
  const lista = wrapEl.querySelector('.autocomplete-list');

  if (valoreIniziale){
    const n = nazioniCache.find(n => n.id === valoreIniziale);
    if (n){ input.value = `${bandiera(n.codice_iso2)} ${n.nome}`; hidden.value = n.id; }
  }

  function renderRisultati(query){
    const q = query.trim().toLowerCase();
    const risultati = q
      ? nazioniCache.filter(n => n.nome.toLowerCase().includes(q)).slice(0, 12)
      : nazioniCache.slice(0, 12);
    lista.innerHTML = risultati.length
      ? risultati.map(n => `
          <div class="autocomplete-item" data-id="${n.id}" data-testo="${bandiera(n.codice_iso2)} ${n.nome}">
            <span class="bandiera">${bandiera(n.codice_iso2)}</span> ${n.nome}
          </div>
        `).join('')
      : '<div class="autocomplete-empty">Nessuna nazione trovata</div>';
    lista.classList.add('open');
  }

  input.addEventListener('focus', () => renderRisultati(input.value.replace(/^\S+\s/, '')));
  input.addEventListener('input', () => {
    hidden.value = '';
    renderRisultati(input.value);
  });
  input.addEventListener('blur', () => setTimeout(() => lista.classList.remove('open'), 150));
  lista.addEventListener('mousedown', e => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    input.value = item.dataset.testo;
    hidden.value = item.dataset.id;
    lista.classList.remove('open');
  });
}

function htmlAutocompleteNazione(idPrefix, label){
  return `
    <div class="field autocomplete-wrap" id="${idPrefix}_wrap">
      <label>${label}</label>
      <input type="text" class="autocomplete-input" id="${idPrefix}_input" placeholder="cerca una nazione..." autocomplete="off">
      <input type="hidden" class="autocomplete-hidden" id="${idPrefix}_hidden">
      <div class="autocomplete-list" id="${idPrefix}_list"></div>
    </div>
  `;
}

// ===================================================================
// TAPPE
// ===================================================================
async function caricaTappe(){
  const res = await fetch('/api/tappe');
  tappeCache = await res.json();
  const tbody = document.getElementById('tabellaTappe');
  tbody.innerHTML = tappeCache.map(t => `
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
        <button class="btn-icon" onclick="diretta(${t.id})">📡 diretta</button>
        <button class="btn-icon danger" onclick="eliminaTappa(${t.id})">elimina</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="9" style="text-align:center;color:#999;padding:24px;">Nessuna tappa inserita</td></tr>';
  aggiornaSelectTappe();
}

document.getElementById('btnNuovaTappa').addEventListener('click', () => {
  apriModal(`
    <h2>Nuova tappa</h2>
    <div class="field-row">
      <div class="field"><label>Numero tappa</label><input type="number" id="f_numero" min="1"></div>
      <div class="field"><label>Tipo</label>
        <select id="f_tipo">
          <option value="pianura">Pianura</option>
          <option value="collina">Collina</option>
          <option value="montagna">Montagna</option>
          <option value="cronometro">Cronometro</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Nome tappa</label><input id="f_nome" placeholder="es. Roma – Napoli"></div>
    <div class="field-row">
      <div class="field"><label>Partenza</label><input id="f_partenza"></div>
      <div class="field"><label>Arrivo</label><input id="f_arrivo"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Distanza (km)</label><input type="number" step="0.1" id="f_distanza"></div>
      <div class="field"><label>Dislivello (m)</label><input type="number" id="f_dislivello"></div>
    </div>
    <div class="field"><label>Data</label><input type="date" id="f_data"></div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="chiudiModal()">annulla</button>
      <button class="btn-primary" onclick="salvaTappa()">salva tappa</button>
    </div>
  `);
});

async function salvaTappa(){
  const body = {
    numero_tappa: +document.getElementById('f_numero').value,
    nome: document.getElementById('f_nome').value,
    partenza: document.getElementById('f_partenza').value,
    arrivo: document.getElementById('f_arrivo').value,
    distanza_km: +document.getElementById('f_distanza').value || null,
    dislivello_m: +document.getElementById('f_dislivello').value || null,
    tipo: document.getElementById('f_tipo').value,
    data: document.getElementById('f_data').value || null
  };
  if (!body.numero_tappa || !body.nome || !body.partenza || !body.arrivo){
    mostraToast('Compila numero, nome, partenza e arrivo'); return;
  }
  const res = await fetch('/api/tappe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.ok){ chiudiModal(); mostraToast('Tappa creata'); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaTappa(id){
  if (!confirm('Eliminare questa tappa?')) return;
  await fetch('/api/tappe/' + id, { method:'DELETE' });
  mostraToast('Tappa eliminata');
}

function diretta(tappaId){
  const inCorso = tappeCache.find(t => t.id === tappaId);
  socket.emit('tappa:avvia-diretta', tappaId);
  mostraToast(`Diretta avviata: tappa ${inCorso.numero_tappa}`);
}

// ===================================================================
// CORRIDORI
// ===================================================================
async function caricaCorridori(){
  const res = await fetch('/api/corridori');
  corridoriCache = await res.json();
  const tbody = document.getElementById('tabellaCorridori');
  tbody.innerHTML = corridoriCache.map(c => `
    <tr>
      <td>${c.numero_pettorale ?? '—'}</td>
      <td><strong>${c.nome} ${c.cognome}</strong></td>
      <td>${c.nazione_codice ? `<span class="bandiera">${bandiera(c.nazione_codice)}</span>${c.nazione_nome}` : '—'}</td>
      <td>${c.squadra_nome ?? '—'}</td>
      <td><button class="btn-icon danger" onclick="eliminaCorridore(${c.id})">elimina</button></td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">Nessun corridore inserito</td></tr>';
}

document.getElementById('btnNuovoCorridore').addEventListener('click', async () => {
  if (squadreCache.length === 0) await caricaSquadre();
  if (nazioniCache.length === 0) await caricaNazioniComplete();
  apriModal(`
    <h2>Nuovo corridore</h2>
    <div class="field-row">
      <div class="field"><label>Nome</label><input id="c_nome"></div>
      <div class="field"><label>Cognome</label><input id="c_cognome"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Pettorale</label><input type="number" id="c_pettorale"></div>
      ${htmlAutocompleteNazione('c_naz', 'Nazionalità')}
    </div>
    <div class="field"><label>Squadra</label>
      <select id="c_squadra">
        <option value="">— nessuna —</option>
        ${squadreCache.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="chiudiModal()">annulla</button>
      <button class="btn-primary" onclick="salvaCorridore()">salva corridore</button>
    </div>
  `);
  attivaAutocompleteNazione(document.getElementById('c_naz_wrap'));
});

async function salvaCorridore(){
  const body = {
    nome: document.getElementById('c_nome').value,
    cognome: document.getElementById('c_cognome').value,
    numero_pettorale: +document.getElementById('c_pettorale').value || null,
    nazione_id: +document.getElementById('c_naz_hidden').value || null,
    squadra_id: document.getElementById('c_squadra').value || null
  };
  if (!body.nome || !body.cognome){ mostraToast('Nome e cognome obbligatori'); return; }
  const res = await fetch('/api/corridori', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.ok){ chiudiModal(); mostraToast('Corridore aggiunto'); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaCorridore(id){
  if (!confirm('Eliminare questo corridore?')) return;
  await fetch('/api/corridori/' + id, { method:'DELETE' });
  mostraToast('Corridore eliminato');
}

// ===================================================================
// SQUADRE
// ===================================================================
async function caricaSquadre(){
  const res = await fetch('/api/squadre');
  squadreCache = await res.json();
  const wrap = document.getElementById('cardsSquadre');
  wrap.innerHTML = squadreCache.map(s => `
    <div class="squadra-card" style="border-top-color:${s.colore || '#e6197f'}">
      <h3>${s.nome}</h3>
      <p>${s.nazione_codice ? `<span class="bandiera">${bandiera(s.nazione_codice)}</span>${s.nazione_nome}` : 'nazione non specificata'}</p>
      <div class="row"><button class="btn-icon danger" onclick="eliminaSquadra(${s.id})">elimina</button></div>
    </div>
  `).join('') || '<p style="color:#999;">Nessuna squadra inserita</p>';
}

document.getElementById('btnNuovaSquadra').addEventListener('click', async () => {
  if (nazioniCache.length === 0) await caricaNazioniComplete();
  apriModal(`
    <h2>Nuova squadra</h2>
    <div class="field"><label>Nome squadra</label><input id="s_nome"></div>
    <div class="field-row">
      ${htmlAutocompleteNazione('s_naz', 'Nazione')}
      <div class="field"><label>Colore</label><input type="color" id="s_colore" value="#e6197f"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="chiudiModal()">annulla</button>
      <button class="btn-primary" onclick="salvaSquadra()">salva squadra</button>
    </div>
  `);
  attivaAutocompleteNazione(document.getElementById('s_naz_wrap'));
});

async function salvaSquadra(){
  const body = {
    nome: document.getElementById('s_nome').value,
    nazione_id: +document.getElementById('s_naz_hidden').value || null,
    colore: document.getElementById('s_colore').value
  };
  if (!body.nome){ mostraToast('Il nome è obbligatorio'); return; }
  const res = await fetch('/api/squadre', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.ok){ chiudiModal(); mostraToast('Squadra creata'); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaSquadra(id){
  if (!confirm('Eliminare questa squadra?')) return;
  await fetch('/api/squadre/' + id, { method:'DELETE' });
  mostraToast('Squadra eliminata');
}

// ===================================================================
// RISULTATI
// ===================================================================
function aggiornaSelectTappe(){
  const sel = document.getElementById('selectTappaRisultati');
  const attuale = sel.value;
  sel.innerHTML = tappeCache.map(t => `<option value="${t.id}">Tappa ${t.numero_tappa} — ${t.nome}</option>`).join('');
  if (attuale) sel.value = attuale;
}

document.getElementById('selectTappaRisultati').addEventListener('change', caricaRisultatiTappaSelezionata);

async function caricaRisultatiTappaSelezionata(){
  const sel = document.getElementById('selectTappaRisultati');
  if (!sel.value) return;
  const res = await fetch('/api/risultati/tappa/' + sel.value);
  const risultati = await res.json();
  const tbody = document.getElementById('tabellaRisultati');
  tbody.innerHTML = risultati.map(r => `
    <tr>
      <td>${r.posizione ?? '—'}</td>
      <td>${r.numero_pettorale ?? '—'}</td>
      <td><strong>${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? '—'}</td>
      <td>${r.tempo ?? '—'}</td>
      <td>${r.distacco}</td>
      <td>${r.punti}</td>
      <td><button class="btn-icon danger" onclick="eliminaRisultato(${r.id})">elimina</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="text-align:center;color:#999;padding:24px;">Nessun risultato per questa tappa</td></tr>';
}

document.getElementById('btnAggiungiRisultato').addEventListener('click', async () => {
  if (corridoriCache.length === 0) await caricaCorridori();
  const tappaId = document.getElementById('selectTappaRisultati').value;
  if (!tappaId){ mostraToast('Crea prima una tappa'); return; }
  apriModal(`
    <h2>Aggiungi risultato</h2>
    <div class="field"><label>Corridore</label>
      <select id="r_corridore">
        ${corridoriCache.map(c => `<option value="${c.id}">${c.nome} ${c.cognome}</option>`).join('')}
      </select>
    </div>
    <div class="field-row">
      <div class="field"><label>Posizione</label><input type="number" id="r_posizione" min="1"></div>
      <div class="field"><label>Punti</label><input type="number" id="r_punti" value="0"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Tempo (hh:mm:ss)</label><input id="r_tempo" placeholder="04:32:10"></div>
      <div class="field"><label>Distacco</label><input id="r_distacco" placeholder="00:00:00" value="00:00:00"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="chiudiModal()">annulla</button>
      <button class="btn-primary" onclick="salvaRisultato(${tappaId})">salva risultato</button>
    </div>
  `);
});

async function salvaRisultato(tappaId){
  const body = {
    tappa_id: +tappaId,
    corridore_id: +document.getElementById('r_corridore').value,
    posizione: +document.getElementById('r_posizione').value || null,
    punti: +document.getElementById('r_punti').value || 0,
    tempo: document.getElementById('r_tempo').value,
    distacco: document.getElementById('r_distacco').value
  };
  const res = await fetch('/api/risultati', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.ok){ chiudiModal(); mostraToast('Risultato salvato'); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaRisultato(id){
  if (!confirm('Eliminare questo risultato?')) return;
  await fetch('/api/risultati/' + id, { method:'DELETE' });
  mostraToast('Risultato eliminato');
}

// ===================================================================
// CLASSIFICA GENERALE
// ===================================================================
async function caricaClassifica(){
  const res = await fetch('/api/risultati/classifica-generale');
  const dati = await res.json();
  const tbody = document.getElementById('tabellaClassifica');
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

// ===================================================================
// TABELLE EXTRA — pannello generico per le 15 tabelle secondarie
// ===================================================================
const extraConfig = {
  'staff-tecnico': { titolo:'Staff tecnico', colonne:[
      {key:'nome', label:'Nome', type:'text'},
      {key:'cognome', label:'Cognome', type:'text'},
      {key:'ruolo', label:'Ruolo', type:'select', opzioni:['direttore_sportivo','meccanico','medico','massaggiatore','preparatore_atletico']},
      {key:'squadra_id', label:'Squadra', type:'squadra'}
  ]},
  'tappe-percorso': { titolo:'Punti intermedi (sprint / GPM)', colonne:[
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'km', label:'Km', type:'number'},
      {key:'tipo', label:'Tipo', type:'select', opzioni:['sprint','gpm']},
      {key:'nome_luogo', label:'Luogo', type:'text'},
      {key:'categoria', label:'Categoria', type:'text'}
  ]},
  'classifiche-tipo': { titolo:'Tipi di classifica', colonne:[
      {key:'nome', label:'Nome', type:'text'},
      {key:'descrizione', label:'Descrizione', type:'text'}
  ]},
  'traguardi-volanti': { titolo:'Traguardi volanti', colonne:[
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'corridore_id', label:'Corridore', type:'corridore'},
      {key:'posizione', label:'Posizione', type:'number'},
      {key:'punti', label:'Punti', type:'number'}
  ]},
  'gpm-risultati': { titolo:'Risultati GPM', colonne:[
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'corridore_id', label:'Corridore', type:'corridore'},
      {key:'posizione', label:'Posizione', type:'number'},
      {key:'punti', label:'Punti', type:'number'}
  ]},
  'penalita': { titolo:'Penalità', colonne:[
      {key:'corridore_id', label:'Corridore', type:'corridore'},
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'motivo', label:'Motivo', type:'text'},
      {key:'secondi', label:'Secondi', type:'number'},
      {key:'punti', label:'Punti', type:'number'}
  ]},
  'controlli-antidoping': { titolo:'Controlli antidoping', colonne:[
      {key:'corridore_id', label:'Corridore', type:'corridore'},
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'data', label:'Data', type:'date'},
      {key:'esito', label:'Esito', type:'select', opzioni:['negativo','positivo','in_attesa']}
  ]},
  'biciclette': { titolo:'Biciclette', colonne:[
      {key:'corridore_id', label:'Corridore', type:'corridore'},
      {key:'marca', label:'Marca', type:'text'},
      {key:'modello', label:'Modello', type:'text'},
      {key:'telaio', label:'N. telaio', type:'text'}
  ]},
  'sponsor': { titolo:'Sponsor', colonne:[
      {key:'nome', label:'Nome', type:'text'},
      {key:'settore', label:'Settore', type:'text'},
      {key:'sito_web', label:'Sito web', type:'text'}
  ]},
  'squadra-sponsor': { titolo:'Sponsor per squadra', colonne:[
      {key:'squadra_id', label:'Squadra', type:'squadra'},
      {key:'sponsor_id', label:'Sponsor', type:'sponsor'},
      {key:'tipo', label:'Tipo', type:'select', opzioni:['main_sponsor','co_sponsor','fornitore_tecnico']}
  ]},
  'veicoli-squadra': { titolo:'Veicoli squadra', colonne:[
      {key:'squadra_id', label:'Squadra', type:'squadra'},
      {key:'tipo', label:'Tipo', type:'select', opzioni:['ammiraglia','furgone','bus','camper']},
      {key:'targa', label:'Targa', type:'text'},
      {key:'modello', label:'Modello', type:'text'}
  ]},
  'hotel': { titolo:'Hotel', colonne:[
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'squadra_id', label:'Squadra', type:'squadra'},
      {key:'nome', label:'Nome hotel', type:'text'},
      {key:'citta', label:'Città', type:'text'},
      {key:'indirizzo', label:'Indirizzo', type:'text'}
  ]},
  'meteo-tappa': { titolo:'Meteo di tappa', colonne:[
      {key:'tappa_id', label:'Tappa', type:'tappa'},
      {key:'temperatura', label:'Temperatura (°C)', type:'number'},
      {key:'condizione', label:'Condizione', type:'select', opzioni:['sereno','nuvoloso','pioggia','vento_forte','neve']},
      {key:'vento_kmh', label:'Vento (km/h)', type:'number'}
  ]},
  'media-accreditati': { titolo:'Media accreditati', colonne:[
      {key:'nome', label:'Nome', type:'text'},
      {key:'testata', label:'Testata', type:'text'},
      {key:'tipo', label:'Tipo', type:'select', opzioni:['stampa','tv','radio','foto','online']},
      {key:'tappa_id', label:'Tappa', type:'tappa'}
  ]},
  'comunicati-stampa': { titolo:'Comunicati stampa', colonne:[
      {key:'titolo', label:'Titolo', type:'text'},
      {key:'contenuto', label:'Contenuto', type:'text'},
      {key:'data', label:'Data', type:'date'},
      {key:'tappa_id', label:'Tappa', type:'tappa'}
  ]}
};

let extraTabellaCorrente = 'staff-tecnico';
let extraInizializzata = false;

function opzioniPer(tipo){
  if (tipo === 'squadra') return squadreCache.map(s => ({ value:s.id, label:s.nome }));
  if (tipo === 'corridore') return corridoriCache.map(c => ({ value:c.id, label:`${c.nome} ${c.cognome}` }));
  if (tipo === 'tappa') return tappeCache.map(t => ({ value:t.id, label:`Tappa ${t.numero_tappa} — ${t.nome}` }));
  if (tipo === 'sponsor') return sponsorCache.map(s => ({ value:s.id, label:s.nome }));
  return [];
}

function risolviValore(col, valore){
  if (valore === null || valore === undefined || valore === '') return '—';
  if (col.type === 'squadra') return squadreCache.find(s => s.id === valore)?.nome ?? valore;
  if (col.type === 'corridore'){ const c = corridoriCache.find(c => c.id === valore); return c ? `${c.nome} ${c.cognome}` : valore; }
  if (col.type === 'tappa'){ const t = tappeCache.find(t => t.id === valore); return t ? `Tappa ${t.numero_tappa}` : valore; }
  if (col.type === 'sponsor') return sponsorCache.find(s => s.id === valore)?.nome ?? valore;
  return valore;
}

async function inizializzaExtra(){
  if (squadreCache.length === 0) await caricaSquadre();
  if (corridoriCache.length === 0) await caricaCorridori();
  if (tappeCache.length === 0) await caricaTappe();
  if (sponsorCache.length === 0){ sponsorCache = await (await fetch('/api/sponsor')).json(); }

  if (!extraInizializzata){
    const chooser = document.getElementById('extraChooser');
    chooser.innerHTML = Object.entries(extraConfig).map(([key, cfg]) => `
      <button class="extra-chip ${key === extraTabellaCorrente ? 'active' : ''}" data-key="${key}">${cfg.titolo}</button>
    `).join('');
    chooser.addEventListener('click', e => {
      const chip = e.target.closest('.extra-chip');
      if (!chip) return;
      extraTabellaCorrente = chip.dataset.key;
      document.querySelectorAll('.extra-chip').forEach(c => c.classList.toggle('active', c === chip));
      caricaTabellaExtra();
    });
    extraInizializzata = true;
  }
  caricaTabellaExtra();
}

async function caricaTabellaExtra(){
  const cfg = extraConfig[extraTabellaCorrente];
  const res = await fetch('/api/' + extraTabellaCorrente);
  const righe = await res.json();

  document.getElementById('extraHead').innerHTML =
    cfg.colonne.map(c => `<th>${c.label}</th>`).join('') + '<th></th>';

  document.getElementById('tabellaExtra').innerHTML = righe.map(r => `
    <tr>
      ${cfg.colonne.map(c => `<td>${risolviValore(c, r[c.key])}</td>`).join('')}
      <td><button class="btn-icon danger" onclick="eliminaRigaExtra(${r.id})">elimina</button></td>
    </tr>
  `).join('') || `<tr><td colspan="${cfg.colonne.length + 1}" style="text-align:center;color:#999;padding:24px;">Nessun dato in questa tabella</td></tr>`;
}

document.getElementById('btnNuovaRigaExtra').addEventListener('click', () => {
  const cfg = extraConfig[extraTabellaCorrente];
  const campiHtml = cfg.colonne.map(c => {
    const id = 'extra_' + c.key;
    if (c.type === 'select'){
      return `<div class="field"><label>${c.label}</label>
        <select id="${id}">${c.opzioni.map(o => `<option value="${o}">${o.replace(/_/g,' ')}</option>`).join('')}</select>
      </div>`;
    }
    if (['squadra','corridore','tappa','sponsor'].includes(c.type)){
      const opz = opzioniPer(c.type);
      return `<div class="field"><label>${c.label}</label>
        <select id="${id}"><option value="">— seleziona —</option>${opz.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
      </div>`;
    }
    const tipoInput = c.type === 'number' ? 'number' : (c.type === 'date' ? 'date' : 'text');
    return `<div class="field"><label>${c.label}</label><input type="${tipoInput}" id="${id}"></div>`;
  }).join('');

  apriModal(`
    <h2>Nuova riga — ${cfg.titolo}</h2>
    ${campiHtml}
    <div class="modal-actions">
      <button class="btn-secondary" onclick="chiudiModal()">annulla</button>
      <button class="btn-primary" onclick="salvaRigaExtra()">salva</button>
    </div>
  `);
});

async function salvaRigaExtra(){
  const cfg = extraConfig[extraTabellaCorrente];
  const body = {};
  cfg.colonne.forEach(c => {
    const el = document.getElementById('extra_' + c.key);
    const v = el.value;
    body[c.key] = (c.type === 'number') ? (v === '' ? null : +v) : (v || null);
  });
  const res = await fetch('/api/' + extraTabellaCorrente, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.ok){ chiudiModal(); mostraToast('Riga salvata'); caricaTabellaExtra(); }
  else mostraToast('Errore nel salvataggio');
}

async function eliminaRigaExtra(id){
  if (!confirm('Eliminare questa riga?')) return;
  await fetch('/api/' + extraTabellaCorrente + '/' + id, { method:'DELETE' });
  mostraToast('Riga eliminata');
  caricaTabellaExtra();
}

// ===================================================================
// SOCKET.IO — realtime
// ===================================================================
socket.on('tappe:aggiornate', caricaTappe);
socket.on('corridori:aggiornati', caricaCorridori);
socket.on('squadre:aggiornate', caricaSquadre);
socket.on('risultati:aggiornati', () => {
  caricaRisultatiTappaSelezionata();
  caricaClassifica();
});

// Ogni tabella extra emette <slug>:aggiornati — se è quella attualmente aperta, ricarico
Object.keys(extraConfig).forEach(key => {
  socket.on(`${key}:aggiornati`, () => {
    if (extraTabellaCorrente === key && document.getElementById('view-extra').classList.contains('active')){
      caricaTabellaExtra();
    }
  });
});

socket.on('stato-live:aggiornato', (stato) => {
  const dot = document.getElementById('liveDot');
  const label = document.getElementById('liveLabel');
  const spettatori = document.getElementById('liveSpettatori');
  if (stato.tappaInCorsoId){
    dot.classList.add('on');
    const t = tappeCache.find(t => t.id === stato.tappaInCorsoId);
    label.textContent = t ? `LIVE — Tappa ${t.numero_tappa}` : 'LIVE';
  } else {
    dot.classList.remove('on');
    label.textContent = 'nessuna diretta';
  }
  spettatori.textContent = `${stato.spettatoriConnessi} connessi`;
});

// ---------- Avvio ----------
caricaNazioniComplete();
caricaTappe();
caricaCorridori();
caricaSquadre();
