import { apiGet } from "../../core/api.js";
import {
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
  apriModal,
  chiudiModal,
  mostraToast,
} from "../../core/utils.js";
import { socket } from "../../core/socket.js";
import { montaListaConForm } from "../tabella-dati/tabella-dati.js";
import { medaglia, icona } from "../../core/icone.js";
import {
  cache,
  caricaCorridori,
  garantisciCorridori,
  garantisciTappe,
} from "../../core/state.js";
import {
  htmlCampoEntita,
  attivaCampoEntita,
} from "../entita-autocomplete/entita-autocomplete.js";
import {
  apriFormRitiro,
  riammettiCorridore,
  badgeStato,
} from "../corridori/corridori.js";

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
  sottoTabAttiva = "tempo";
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

/* ---------------------------------------------------------------------
 * Ritiri — elenco dei corridori ritirati, con possibilità di registrarne
 * di nuovi direttamente da qui (stesso modale di conferma usato nella
 * pagina Corridori/Risultati) e di riammetterli in gara.
 * ------------------------------------------------------------------- */
let queryRitiri = "";

async function renderRitiri(corpo) {
  sottoTabAttiva = "ritiri";
  await garantisciCorridori();
  await garantisciTappe();
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca corridore, squadra o motivo...")}
      <button class="btn-secondary btn-piccolo" id="btnNuovoRitiro">${icona("aggiungi")}nuovo ritiro</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Ritirato dalla tappa</th><th>Motivo</th><th>Note</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaClassificaRitiri"></tbody>
      </table>
    </div>
  `;
  document
    .getElementById("btnNuovoRitiro")
    .addEventListener("click", apriNuovoRitiro);
  attivaCampoRicerca(corpo, (q) => {
    queryRitiri = q;
    disegnaRitiri();
  });
  disegnaRitiri();
}

function disegnaRitiri() {
  const tbody = document.getElementById("tabellaClassificaRitiri");
  if (!tbody) return;
  const ritirati = cache.corridori
    .filter((c) => c.ritirato)
    .filter((c) => {
      if (!queryRitiri) return true;
      return `${c.nome} ${c.cognome} ${c.squadra_nome ?? ""} ${c.note_ritiro ?? ""}`
        .toLowerCase()
        .includes(queryRitiri);
    })
    .sort(
      (a, b) =>
        (a.ritirato_tappa_numero ?? 0) - (b.ritirato_tappa_numero ?? 0) ||
        a.cognome.localeCompare(b.cognome),
    );

  tbody.innerHTML =
    ritirati
      .map(
        (c) => `
    <tr class="riga-ritirato">
      <td><span class="badge badge-pettorale">${c.numero_pettorale ?? "—"}</span></td>
      <td><strong>${c.nazione_codice ? bandiera(c.nazione_codice, 16) + " " : ""}${c.nome} ${c.cognome}</strong></td>
      <td>${c.squadra_nome ? `${c.squadra_nazione_codice ? bandiera(c.squadra_nazione_codice, 16) + " " : ""}${c.squadra_nome}` : "—"}</td>
      <td>${c.ritirato_tappa_numero ? `Tappa ${c.ritirato_tappa_numero}` : "—"}</td>
      <td>${badgeStato(c)}</td>
      <td>${c.note_ritiro ?? "—"}</td>
      <td class="td-azioni">
        <button class="btn-icon" title="modifica dati del ritiro" data-modifica-ritiro="${c.id}">${icona("modifica")}</button>
        <button class="btn-icon" title="riammetti in gara" data-riammetti="${c.id}">${icona("ripristina")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="7" class="stato-vuoto">${queryRitiri ? "Nessun ritiro trovato" : "Nessun corridore ritirato"}</td></tr>`;

  tbody.querySelectorAll("[data-modifica-ritiro]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = cache.corridori.find((c) => c.id === +b.dataset.modificaRitiro);
      if (c) apriFormRitiro(c, { alSalvataggio: aggiornaDopoRitiro });
    }),
  );
  tbody
    .querySelectorAll("[data-riammetti]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        riammettiCorridore(+b.dataset.riammetti, {
          alSalvataggio: aggiornaDopoRitiro,
        }),
      ),
    );
}

async function aggiornaDopoRitiro() {
  await caricaCorridori();
  disegnaRitiri();
}

// piccolo modale "ponte": si sceglie il corridore ancora in gara, poi si
// passa al modale di ritiro vero e proprio (già usato in Corridori e
// Risultati) con motivo/tappa/note
function apriNuovoRitiro() {
  apriModal(`
    <h2>Nuovo ritiro</h2>
    <p style="color:var(--testo-soft);font-size:13.5px;margin:-6px 0 16px;">
      Scegli il corridore da segnare come ritirato. Al passo successivo
      potrai indicare tappa, motivo e note.
    </p>
    ${htmlCampoEntita("nr_corridore", "Corridore", "corridore")}
    <div class="modal-actions">
      <button class="btn-secondary" id="nr_annulla">annulla</button>
      <button class="btn-primary" id="nr_avanti">avanti</button>
    </div>
  `);
  // i corridori già ritirati non hanno senso qui: per loro c'è "riammetti"
  const idGiaRitirati = cache.corridori
    .filter((c) => c.ritirato)
    .map((c) => c.id);
  const leggiCorridoreId = attivaCampoEntita(
    "nr_corridore",
    "corridore",
    null,
    { escludiIds: idGiaRitirati },
  );
  document.getElementById("nr_annulla").addEventListener("click", chiudiModal);
  document.getElementById("nr_avanti").addEventListener("click", () => {
    const corridoreId = leggiCorridoreId();
    if (!corridoreId) {
      mostraToast("Seleziona un corridore");
      return;
    }
    const c = cache.corridori.find((c) => c.id === corridoreId);
    if (!c) return;
    apriFormRitiro(c, { alSalvataggio: aggiornaDopoRitiro });
  });
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
      { key: "ritiri", label: "Ritiri" },
      { key: "tipi", label: "Tipi di classifica" },
    ],
    (key, corpo) => {
      if (key === "tempo") renderTempo(corpo);
      else if (key === "punti") renderPunti(corpo);
      else if (key === "giovani") renderGiovani(corpo);
      else if (key === "montagna") renderMontagna(corpo);
      else if (key === "squadre") renderSquadre(corpo);
      else if (key === "ritiri") renderRitiri(corpo);
      else renderTipiClassifica(corpo);
    },
  );

  // i risultati di tappa influenzano tempo/punti/giovani/squadre;
  // i GPM influenzano la classifica scalatori; le penalità influenzano
  // sia i tempi che i punti totali
  socket.on("risultati:aggiornati", ricaricaAttiva);
  socket.on("gpm-risultati:aggiornati", ricaricaAttiva);
  socket.on("penalita:aggiornati", ricaricaAttiva);
  // un ritiro/riammissione può arrivare anche da un'altra pagina o da un
  // altro utente collegato: se siamo sulla scheda Ritiri, riallineiamo
  socket.on("corridori:aggiornati", async () => {
    if (sottoTabAttiva !== "ritiri") return;
    await caricaCorridori();
    disegnaRitiri();
  });
}
