import { apiGet } from "../../core/api.js";
import {
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
} from "../../core/utils.js";
import { socket } from "../../core/socket.js";
import { montaListaConForm } from "../tabella-dati/tabella-dati.js";
import { medaglia } from "../../core/icone.js";

// stato di ciascuna scheda: query di ricerca corrente + ultimo elenco caricato
const stato = {
  tempo: { query: "", dati: [] },
  punti: { query: "", dati: [] },
  giovani: { query: "", dati: [] },
  montagna: { query: "", dati: [] },
  squadre: { query: "", dati: [] },
};

// bandiera inline davanti al nome, se il corridore/la squadra ha una nazione nota
function bandieraInline(codiceIso2) {
  return codiceIso2 ? `${bandiera(codiceIso2, 16)} ` : "";
}

function bannerMaglia(leader, coloreVar, etichetta, bordoExtra) {
  if (!leader) return "";
  const nomeSquadra = leader.squadra_nome ?? "—";
  const nomeCompleto = leader.nome
    ? `${leader.nome} ${leader.cognome}`
    : leader.squadra_nome;
  const sottotitolo = leader.nome
    ? nomeSquadra
    : `${leader.corridori_contati ?? 0} corridori in classifica`;
  return `
    <div class="banner-maglia" style="--colore-maglia:${coloreVar};">
      <span class="maglia-dot"${bordoExtra ? ' style="border:2px solid var(--bordo);"' : ""}></span>
      <div>
        <strong>${bandieraInline(leader.nazione_codice)}${nomeCompleto}</strong>
        <span class="maglia-label">indossa la ${etichetta} — ${sottotitolo}</span>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------------
 * Classifica generale a tempo (maglia rosa)
 * ------------------------------------------------------------------- */
async function renderTempo(corpo) {
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca corridore o squadra...")}</div>
    <div id="bannerTempo"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>Tappe</th><th>Abbuono</th><th>Tempo totale</th><th>Distacco</th></tr></thead>
        <tbody id="tabellaClassificaTempo"></tbody>
      </table>
    </div>
  `;
  attivaCampoRicerca(corpo, (q) => {
    stato.tempo.query = q;
    disegnaTempo();
  });
  await ricaricaTempo();
}

function disegnaTempo() {
  const tbody = document.getElementById("tabellaClassificaTempo");
  const banner = document.getElementById("bannerTempo");
  if (!tbody) return;
  const { dati, query } = stato.tempo;
  if (banner)
    banner.innerHTML = bannerMaglia(
      dati[0],
      "var(--rosa-maglia)",
      "maglia rosa",
    );
  const filtrati = dati.filter((r) => {
    if (!query) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""}`
      .toLowerCase()
      .includes(query);
  });
  tbody.innerHTML =
    filtrati
      .map((r) => {
        const pos = dati.indexOf(r) + 1;
        const m = medaglia(pos);
        return `
    <tr class="${pos <= 3 ? "riga-podio" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : pos}</td>
      <td><strong>${bandieraInline(r.nazione_codice)}${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? "—"}</td>
      <td>${r.tappe_disputate}</td>
      <td>${r.abbuono_secondi ? `<span class="badge badge-abbuono" title="Secondi guadagnati per posizioni di tappa">-${r.abbuono_secondi}s</span>` : "—"}</td>
      <td><span class="badge badge-codice">${r.tempo_totale}</span></td>
      <td>${r.distacco}</td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="7" class="stato-vuoto">${query ? "Nessun corridore trovato" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaTempo() {
  stato.tempo.dati = await apiGet("/api/risultati/classifica-tempo");
  disegnaTempo();
}

/* ---------------------------------------------------------------------
 * Classifica a punti (maglia ciclamino)
 * ------------------------------------------------------------------- */
async function renderPunti(corpo) {
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca corridore o squadra...")}</div>
    <div id="bannerPunti"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>Tappe</th><th>Punti totali</th></tr></thead>
        <tbody id="tabellaClassificaPunti"></tbody>
      </table>
    </div>
  `;
  attivaCampoRicerca(corpo, (q) => {
    stato.punti.query = q;
    disegnaPunti();
  });
  await ricaricaPunti();
}

function disegnaPunti() {
  const tbody = document.getElementById("tabellaClassificaPunti");
  const banner = document.getElementById("bannerPunti");
  if (!tbody) return;
  const { dati, query } = stato.punti;
  if (banner)
    banner.innerHTML = bannerMaglia(
      dati[0],
      "var(--viola)",
      "maglia ciclamino",
    );
  const filtrati = dati.filter((r) => {
    if (!query) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""}`
      .toLowerCase()
      .includes(query);
  });
  tbody.innerHTML =
    filtrati
      .map((r) => {
        const pos = dati.indexOf(r) + 1;
        const m = medaglia(pos);
        return `
    <tr class="${pos <= 3 ? "riga-podio" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : pos}</td>
      <td><strong>${bandieraInline(r.nazione_codice)}${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? "—"}</td>
      <td>${r.tappe_disputate}</td>
      <td><span class="badge badge-punti">${r.punti_totali ?? 0}</span></td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" class="stato-vuoto">${query ? "Nessun corridore trovato" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaPunti() {
  stato.punti.dati = await apiGet("/api/risultati/classifica-generale");
  disegnaPunti();
}

/* ---------------------------------------------------------------------
 * Classifica giovani (maglia bianca) — under 25 in base all'anno di corsa
 * ------------------------------------------------------------------- */
async function renderGiovani(corpo) {
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca corridore o squadra...")}</div>
    <div id="bannerGiovani"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>Età</th><th>Tempo totale</th><th>Distacco</th></tr></thead>
        <tbody id="tabellaClassificaGiovani"></tbody>
      </table>
    </div>
  `;
  attivaCampoRicerca(corpo, (q) => {
    stato.giovani.query = q;
    disegnaGiovani();
  });
  await ricaricaGiovani();
}

function disegnaGiovani() {
  const tbody = document.getElementById("tabellaClassificaGiovani");
  const banner = document.getElementById("bannerGiovani");
  if (!tbody) return;
  const { dati, query } = stato.giovani;
  if (banner)
    banner.innerHTML = bannerMaglia(
      dati[0],
      "var(--bianca-maglia)",
      "maglia bianca",
      true,
    );
  const filtrati = dati.filter((r) => {
    if (!query) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""}`
      .toLowerCase()
      .includes(query);
  });
  tbody.innerHTML =
    filtrati
      .map((r) => {
        const pos = dati.indexOf(r) + 1;
        const m = medaglia(pos);
        return `
    <tr class="${pos <= 3 ? "riga-podio" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : pos}</td>
      <td><strong>${bandieraInline(r.nazione_codice)}${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? "—"}</td>
      <td>${r.eta}</td>
      <td><span class="badge badge-codice">${r.tempo_totale}</span></td>
      <td>${r.distacco}</td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="6" class="stato-vuoto">${query ? "Nessun corridore trovato" : "Nessun corridore under 25 in classifica"}</td></tr>`;
}

async function ricaricaGiovani() {
  stato.giovani.dati = await apiGet("/api/risultati/classifica-giovani");
  disegnaGiovani();
}

/* ---------------------------------------------------------------------
 * Classifica scalatori / GPM (maglia verde)
 * ------------------------------------------------------------------- */
async function renderMontagna(corpo) {
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca corridore o squadra...")}</div>
    <div id="bannerMontagna"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>GPM disputati</th><th>Punti scalatore</th></tr></thead>
        <tbody id="tabellaClassificaMontagna"></tbody>
      </table>
    </div>
  `;
  attivaCampoRicerca(corpo, (q) => {
    stato.montagna.query = q;
    disegnaMontagna();
  });
  await ricaricaMontagna();
}

function disegnaMontagna() {
  const tbody = document.getElementById("tabellaClassificaMontagna");
  const banner = document.getElementById("bannerMontagna");
  if (!tbody) return;
  const { dati, query } = stato.montagna;
  if (banner)
    banner.innerHTML = bannerMaglia(
      dati[0],
      "var(--verde-montagna)",
      "maglia della classifica scalatori (GPM)",
    );
  const filtrati = dati.filter((r) => {
    if (!query) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""}`
      .toLowerCase()
      .includes(query);
  });
  tbody.innerHTML =
    filtrati
      .map((r) => {
        const pos = dati.indexOf(r) + 1;
        const m = medaglia(pos);
        return `
    <tr class="${pos <= 3 ? "riga-podio" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : pos}</td>
      <td><strong>${bandieraInline(r.nazione_codice)}${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? "—"}</td>
      <td>${r.gpm_disputati}</td>
      <td><span class="badge badge-gpm">${r.punti_totali ?? 0}</span></td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" class="stato-vuoto">${query ? "Nessun corridore trovato" : "Nessun GPM ancora disputato"}</td></tr>`;
}

async function ricaricaMontagna() {
  stato.montagna.dati = await apiGet("/api/risultati/classifica-montagna");
  disegnaMontagna();
}

/* ---------------------------------------------------------------------
 * Classifica a squadre — somma dei tempi di tutti i corridori della squadra
 * ------------------------------------------------------------------- */
async function renderSquadre(corpo) {
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca squadra...")}</div>
    <div id="bannerSquadre"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Squadra</th><th>Corridori conteggiati</th><th>Tempo totale</th><th>Distacco</th></tr></thead>
        <tbody id="tabellaClassificaSquadre"></tbody>
      </table>
    </div>
  `;
  attivaCampoRicerca(corpo, (q) => {
    stato.squadre.query = q;
    disegnaSquadre();
  });
  await ricaricaSquadre();
}

function disegnaSquadre() {
  const tbody = document.getElementById("tabellaClassificaSquadre");
  const banner = document.getElementById("bannerSquadre");
  if (!tbody) return;
  const { dati, query } = stato.squadre;
  if (banner)
    banner.innerHTML = bannerMaglia(
      dati[0],
      dati[0]?.squadra_colore ?? "var(--rosa-maglia)",
      "classifica a squadre",
    );
  const filtrati = dati.filter((r) => {
    if (!query) return true;
    return `${r.squadra_nome} ${r.nazione_nome ?? ""}`
      .toLowerCase()
      .includes(query);
  });
  tbody.innerHTML =
    filtrati
      .map((r) => {
        const pos = dati.indexOf(r) + 1;
        const m = medaglia(pos);
        return `
    <tr class="${pos <= 3 ? "riga-podio" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : pos}</td>
      <td>
        <span class="dot-colore" style="background:${r.squadra_colore}"></span>
        <strong>${bandieraInline(r.nazione_codice)}${r.squadra_nome}</strong>
      </td>
      <td>${r.corridori_contati}</td>
      <td><span class="badge badge-codice">${r.tempo_totale}</span></td>
      <td>${r.distacco}</td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" class="stato-vuoto">${query ? "Nessuna squadra trovata" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaSquadre() {
  stato.squadre.dati = await apiGet("/api/risultati/classifica-squadre");
  disegnaSquadre();
}

function renderTipiClassifica(corpo) {
  montaListaConForm(corpo, {
    titolo: "Tipo di classifica",
    apiPath: "/api/classifiche-tipo",
    colonne: [
      { key: "nome", label: "Nome", type: "text" },
      { key: "descrizione", label: "Descrizione", type: "text" },
    ],
  });
}

// Ognuna delle vecchie sotto-schede di "Classifiche" è ora una voce di
// navbar indipendente con il proprio init. La sotto-scheda "Ritiri" (che
// era identica a quella duplicata dentro Risultati) è confluita nella
// pagina unica components/ritiri/ritiri.js.
export function initTempo(container) {
  renderTempo(container);
  socket.on("risultati:aggiornati", ricaricaTempo);
  socket.on("penalita:aggiornati", ricaricaTempo);
}

export function initPunti(container) {
  renderPunti(container);
  socket.on("risultati:aggiornati", ricaricaPunti);
  socket.on("penalita:aggiornati", ricaricaPunti);
}

export function initGiovani(container) {
  renderGiovani(container);
  socket.on("risultati:aggiornati", ricaricaGiovani);
}

export function initMontagna(container) {
  renderMontagna(container);
  socket.on("gpm-risultati:aggiornati", ricaricaMontagna);
}

export function initSquadre(container) {
  renderSquadre(container);
  socket.on("risultati:aggiornati", ricaricaSquadre);
}

export function initTipi(container) {
  renderTipiClassifica(container);
}
