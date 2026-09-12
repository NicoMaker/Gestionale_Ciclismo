import { apiGet } from "../api.js";
import {
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
  htmlNomeSquadra,
} from "../utils.js";
import { socket } from "../socket.js";
import { montaListaConForm } from "./tabella-dati.js";
import { medaglia } from "../icone.js";

let sottoTabAttiva = "tempo";

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
  const nomeSquadra = htmlNomeSquadra(
    leader.squadra_nome,
    leader.squadra_nazione_codice,
  );
  const nomeCompleto = leader.nome
    ? `${bandieraInline(leader.nazione_codice)}${leader.nome} ${leader.cognome}`
    : htmlNomeSquadra(leader.squadra_nome, leader.nazione_codice);
  const sottotitolo = leader.nome
    ? nomeSquadra
    : `${leader.corridori_contati ?? 0} corridori in classifica`;
  return `
    <div class="banner-maglia" style="--colore-maglia:${coloreVar};">
      <span class="maglia-dot"${bordoExtra ? ' style="border:2px solid var(--bordo);"' : ""}></span>
      <div>
        <strong>${nomeCompleto}</strong>
        <span class="maglia-label">indossa la ${etichetta} — ${sottotitolo}</span>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------------
 * Classifica generale a tempo (maglia rosa)
 * ------------------------------------------------------------------- */
async function renderTempo(corpo) {
  sottoTabAttiva = "tempo";
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca corridore o squadra...")}</div>
    <div id="bannerTempo"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>Tappe</th><th>Tempo totale</th><th>Distacco</th></tr></thead>
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
      <td>${htmlNomeSquadra(r.squadra_nome, r.squadra_nazione_codice)}</td>
      <td>${r.tappe_disputate}</td>
      <td><span class="badge badge-codice">${r.tempo_totale}</span></td>
      <td>${r.distacco}</td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">${query ? "Nessun corridore trovato" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaTempo() {
  stato.tempo.dati = await apiGet("/api/risultati/classifica-tempo");
  disegnaTempo();
}

/* ---------------------------------------------------------------------
 * Classifica a punti (maglia ciclamino)
 * ------------------------------------------------------------------- */
async function renderPunti(corpo) {
  sottoTabAttiva = "punti";
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
      <td>${htmlNomeSquadra(r.squadra_nome, r.squadra_nazione_codice)}</td>
      <td>${r.tappe_disputate}</td>
      <td><span class="badge badge-punti">${r.punti_totali ?? 0}</span></td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">${query ? "Nessun corridore trovato" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaPunti() {
  stato.punti.dati = await apiGet("/api/risultati/classifica-generale");
  disegnaPunti();
}

/* ---------------------------------------------------------------------
 * Classifica giovani (maglia bianca) — under 25 in base all'anno di corsa
 * ------------------------------------------------------------------- */
async function renderGiovani(corpo) {
  sottoTabAttiva = "giovani";
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
      <td>${htmlNomeSquadra(r.squadra_nome, r.squadra_nazione_codice)}</td>
      <td>${r.eta}</td>
      <td><span class="badge badge-codice">${r.tempo_totale}</span></td>
      <td>${r.distacco}</td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">${query ? "Nessun corridore trovato" : "Nessun corridore under 25 in classifica"}</td></tr>`;
}

async function ricaricaGiovani() {
  stato.giovani.dati = await apiGet("/api/risultati/classifica-giovani");
  disegnaGiovani();
}

/* ---------------------------------------------------------------------
 * Classifica scalatori / GPM (maglia verde)
 * ------------------------------------------------------------------- */
async function renderMontagna(corpo) {
  sottoTabAttiva = "montagna";
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
      <td>${htmlNomeSquadra(r.squadra_nome, r.squadra_nazione_codice)}</td>
      <td>${r.gpm_disputati}</td>
      <td><span class="badge badge-gpm">${r.punti_totali ?? 0}</span></td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">${query ? "Nessun corridore trovato" : "Nessun GPM ancora disputato"}</td></tr>`;
}

async function ricaricaMontagna() {
  stato.montagna.dati = await apiGet("/api/risultati/classifica-montagna");
  disegnaMontagna();
}

/* ---------------------------------------------------------------------
 * Classifica a squadre — somma dei tempi di tutti i corridori della squadra
 * ------------------------------------------------------------------- */
async function renderSquadre(corpo) {
  sottoTabAttiva = "squadre";
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
        <strong>${htmlNomeSquadra(r.squadra_nome, r.nazione_codice, r.squadra_colore)}</strong>
      </td>
      <td>${r.corridori_contati}</td>
      <td><span class="badge badge-codice">${r.tempo_totale}</span></td>
      <td>${r.distacco}</td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">${query ? "Nessuna squadra trovata" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaSquadre() {
  stato.squadre.dati = await apiGet("/api/risultati/classifica-squadre");
  disegnaSquadre();
}

function renderTipiClassifica(corpo) {
  sottoTabAttiva = "tipi";
  montaListaConForm(corpo, {
    titolo: "Tipo di classifica",
    apiPath: "/api/classifiche-tipo",
    colonne: [
      { key: "nome", label: "Nome", type: "text" },
      { key: "descrizione", label: "Descrizione", type: "text" },
    ],
  });
}

function ricaricaAttiva() {
  if (sottoTabAttiva === "tempo") ricaricaTempo();
  else if (sottoTabAttiva === "punti") ricaricaPunti();
  else if (sottoTabAttiva === "giovani") ricaricaGiovani();
  else if (sottoTabAttiva === "montagna") ricaricaMontagna();
  else if (sottoTabAttiva === "squadre") ricaricaSquadre();
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "tempo", label: "Generale (maglia rosa)" },
      { key: "punti", label: "Punti (maglia ciclamino)" },
      { key: "giovani", label: "Giovani (maglia bianca)" },
      { key: "montagna", label: "Scalatori GPM (maglia verde)" },
      { key: "squadre", label: "Classifica squadre" },
      { key: "tipi", label: "Tipi di classifica" },
    ],
    (key, corpo) => {
      if (key === "tempo") renderTempo(corpo);
      else if (key === "punti") renderPunti(corpo);
      else if (key === "giovani") renderGiovani(corpo);
      else if (key === "montagna") renderMontagna(corpo);
      else if (key === "squadre") renderSquadre(corpo);
      else renderTipiClassifica(corpo);
    },
  );

  // i risultati di tappa influenzano tempo/punti/giovani/squadre;
  // i GPM influenzano la classifica scalatori; le penalità influenzano
  // sia i tempi che i punti totali
  socket.on("risultati:aggiornati", ricaricaAttiva);
  socket.on("gpm-risultati:aggiornati", ricaricaAttiva);
  socket.on("penalita:aggiornati", ricaricaAttiva);
  socket.on("ritiri:aggiornati", ricaricaAttiva);
}
