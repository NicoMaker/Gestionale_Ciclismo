import { apiGet, apiPost, apiPut, apiDelete } from "../../core/api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
  erroreDaResponse,
} from "../../core/utils.js";
import {
  cache,
  caricaTappe,
  caricaCorridori,
  garantisciTappe,
  garantisciCorridori,
} from "../../core/state.js";
import { socket } from "../../core/socket.js";
import { montaListaConForm } from "../tabella-dati/tabella-dati.js";
import { htmlCampoEntita, attivaCampoEntita } from "../entita-autocomplete/entita-autocomplete.js";
import { icona, medaglia } from "../../core/icone.js";
import { apriFormRitiro, riammettiCorridore, badgeStato } from "../corridori/corridori.js";

let sottoTabAttiva = "arrivo";
let tappaSelezionataId = null;

async function renderArrivo(corpo) {
  sottoTabAttiva = "arrivo";
  await garantisciTappe();
  await garantisciCorridori();
  if (!tappaSelezionataId && cache.tappe.length)
    tappaSelezionataId = cache.tappe[0].id;

  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoEntita("selRisultatiTappa", "Tappa", "tappa")}
      ${htmlCampoRicerca("cerca corridore o squadra...")}
      <button class="btn-secondary btn-piccolo" id="btnAggiungiRisultato">${icona("aggiungi")}aggiungi risultato</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Tempo</th><th>Distacco</th><th>Punti</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaRisultati"></tbody>
      </table>
    </div>
  `;

  // campo di ricerca al posto della semplice <select>: comodo quando il
  // giro ha molte tappe (stesso concetto usato per squadre/nazioni)
  attivaCampoEntita("selRisultatiTappa", "tappa", tappaSelezionataId);
  document
    .getElementById("selRisultatiTappa_hidden")
    .addEventListener("change", (e) => {
      const nuovoId = +e.target.value || null;
      if (!nuovoId) return;
      tappaSelezionataId = nuovoId;
      ricaricaArrivo();
    });

  document
    .getElementById("btnAggiungiRisultato")
    .addEventListener("click", async () => {
      await garantisciCorridori();
      apriFormRisultato(null);
    });
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    ricaricaArrivo();
  });

  ricaricaArrivo();
}

let queryCorrente = "";
let risultatiCorrenti = [];

async function ricaricaArrivo() {
  const tbody = document.getElementById("tabellaRisultati");
  if (!tbody || !tappaSelezionataId) return;
  risultatiCorrenti = await apiGet(
    "/api/risultati/tappa/" + tappaSelezionataId,
  );
  const filtrati = risultatiCorrenti.filter((r) => {
    if (!queryCorrente) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""}`
      .toLowerCase()
      .includes(queryCorrente);
  });
  tbody.innerHTML =
    filtrati
      .map((r) => {
        const m = medaglia(r.posizione);
        // lo stato di ritiro non è nella tabella risultati ma nell'anagrafica
        // corridori, già in cache (caricata da garantisciCorridori in
        // renderArrivo): la usiamo per mostrare il badge e il pulsante giusto
        const corridoreInfo = cache.corridori.find((c) => c.id === r.corridore_id);
        const ritirato = !!corridoreInfo?.ritirato;
        return `
    <tr class="${ritirato ? "riga-ritirato" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : (r.posizione ?? "—")}</td>
      <td>${r.numero_pettorale ?? "—"}</td>
      <td>
        <strong>${r.nazione_codice ? bandiera(r.nazione_codice, 16) + " " : ""}${r.nome} ${r.cognome}</strong>
        ${ritirato ? `<div>${badgeStato(corridoreInfo)}</div>` : ""}
      </td>
      <td>${r.squadra_nome ? `${r.squadra_nazione_codice ? bandiera(r.squadra_nazione_codice, 16) + " " : ""}${r.squadra_nome}` : "—"}</td>
      <td>${r.tempo ?? "—"}</td>
      <td>${r.distacco}</td>
      <td><span class="badge badge-punti">${r.punti}</span></td>
      <td class="td-azioni">
        <button class="btn-icon" title="modifica" data-modifica='${JSON.stringify({ id: r.id, corridore_id: r.corridore_id, posizione: r.posizione, tempo: r.tempo, distacco: r.distacco, punti: r.punti })}'>${icona("modifica")}</button>
        ${
          ritirato
            ? `<button class="btn-icon" title="riammetti in gara" data-riammetti="${r.corridore_id}">${icona("ripristina")}</button>`
            : `<button class="btn-icon" title="segna ritiro da questa tappa" data-ritira="${r.corridore_id}">${icona("infortunio")}</button>`
        }
        <button class="btn-icon danger" title="elimina" data-elimina="${r.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="8" class="stato-vuoto">${queryCorrente ? "Nessun risultato trovato" : "Nessun risultato per questa tappa"}</td></tr>`;

  tbody.querySelectorAll("[data-modifica]").forEach((b) =>
    b.addEventListener("click", async () => {
      await garantisciCorridori();
      apriFormRisultato(JSON.parse(b.dataset.modifica));
    }),
  );
  tbody
    .querySelectorAll("[data-elimina]")
    .forEach((b) =>
      b.addEventListener("click", () => eliminaRisultato(+b.dataset.elimina)),
    );
  tbody.querySelectorAll("[data-ritira]").forEach((b) =>
    b.addEventListener("click", () => apriRitiroDaRisultati(+b.dataset.ritira)),
  );
  tbody.querySelectorAll("[data-riammetti]").forEach((b) =>
    b.addEventListener("click", () =>
      riammettiCorridore(+b.dataset.riammetti, { alSalvataggio: aggiornaDopoRitiro }),
    ),
  );
}

// dopo un ritiro/riammissione avviato dalla pagina Risultati, va ricaricata
// l'anagrafica corridori (per il badge e per escludere il corridore dalle
// prossime tappe) e ridisegnata la tabella corrente
async function aggiornaDopoRitiro() {
  await caricaCorridori();
  ricaricaArrivo();
}

// apre il modale di ritiro preselezionando come tappa di riferimento
// proprio la tappa attualmente visualizzata in questa pagina, così da poter
// registrare in un colpo solo "il corridore è arrivato/si è ritirato qui,
// e da qui in poi non gareggia più"
function apriRitiroDaRisultati(corridoreId) {
  const r = risultatiCorrenti.find((x) => x.corridore_id === corridoreId);
  if (!r) return;
  const numeroTappaCorrente =
    cache.tappe.find((t) => t.id === tappaSelezionataId)?.numero_tappa ?? null;
  apriFormRitiro(
    { id: r.corridore_id, nome: r.nome, cognome: r.cognome },
    {
      tappaNumeroPreselezionata: numeroTappaCorrente,
      alSalvataggio: aggiornaDopoRitiro,
    },
  );
}

function apriFormRisultato(risultatoEsistente) {
  const r = risultatoEsistente || {};
  apriModal(`
    <h2>${risultatoEsistente ? "Modifica risultato" : "Aggiungi risultato"}</h2>
    ${htmlCampoEntita("r_corridore", "Corridore", "corridore")}
    <div class="field-row">
      <div class="field"><label>Posizione</label><input type="number" id="r_posizione" min="1" value="${r.posizione ?? ""}"></div>
      <div class="field"><label>Punti</label><input type="number" id="r_punti" value="${r.punti ?? 0}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Tempo (hh:mm:ss)</label><input id="r_tempo" placeholder="04:32:10" value="${r.tempo ?? ""}"></div>
      <div class="field"><label>Distacco</label><input id="r_distacco" placeholder="00:00:00" value="${r.distacco ?? "00:00:00"}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="r_annulla">annulla</button>
      <button class="btn-primary" id="r_salva">${risultatoEsistente ? "salva modifiche" : "salva risultato"}</button>
    </div>
  `);

  // il corridore è sempre modificabile, anche in un risultato già
  // esistente — ma non si può scegliere un corridore già presente in
  // questa tappa (doppione), né uno ritirato/squalificato da questa
  // tappa in poi; la tappa in corso resta invece consentita ai corridori
  // ritirati proprio in questa tappa o in una successiva
  const numeroTappaCorrente =
    cache.tappe.find((t) => t.id === tappaSelezionataId)?.numero_tappa ?? null;
  const escludiIds = risultatiCorrenti
    .filter((x) => !risultatoEsistente || x.id !== risultatoEsistente.id)
    .map((x) => x.corridore_id);
  const leggiCorridoreId = attivaCampoEntita(
    "r_corridore",
    "corridore",
    risultatoEsistente ? r.corridore_id : null,
    { tappaNumero: numeroTappaCorrente, escludiIds },
  );

  document.getElementById("r_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("r_salva")
    .addEventListener("click", () =>
      salvaRisultato(risultatoEsistente, leggiCorridoreId),
    );
}

async function salvaRisultato(risultatoEsistente, leggiCorridoreId) {
  const corridoreId = leggiCorridoreId();
  if (!corridoreId) {
    mostraToast("Seleziona un corridore");
    return;
  }
  const body = {
    tappa_id: tappaSelezionataId,
    corridore_id: corridoreId,
    posizione: +document.getElementById("r_posizione").value || null,
    punti: +document.getElementById("r_punti").value || 0,
    tempo: document.getElementById("r_tempo").value,
    distacco: document.getElementById("r_distacco").value,
  };
  // Modifica: aggiorna per id (permette anche di cambiare corridore senza
  // lasciare righe fantasma). Creazione: upsert su (tappa_id, corridore_id).
  const res = risultatoEsistente
    ? await apiPut("/api/risultati/" + risultatoEsistente.id, body)
    : await apiPost("/api/risultati", body);
  if (res.ok) {
    chiudiModal();
    mostraToast(
      risultatoEsistente ? "Risultato modificato" : "Risultato salvato",
    );
    ricaricaArrivo();
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

async function eliminaRisultato(id) {
  if (!confirm("Eliminare questo risultato?")) return;
  const res = await apiDelete("/api/risultati/" + id);
  if (res.ok) mostraToast("Risultato eliminato");
  else mostraToast(await erroreDaResponse(res, "Impossibile eliminare"));
}

function renderTraguardiVolanti(corpo) {
  sottoTabAttiva = "traguardi";
  montaListaConForm(corpo, {
    titolo: "Traguardi volanti",
    apiPath: "/api/traguardi-volanti",
    evitaDuplicatiTappaCorridore: true,
    colonne: [
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "posizione", label: "Posizione", type: "number" },
      { key: "punti", label: "Punti", type: "number" },
    ],
  });
}

function renderGpm(corpo) {
  sottoTabAttiva = "gpm";
  montaListaConForm(corpo, {
    titolo: "Risultati GPM",
    apiPath: "/api/gpm-risultati",
    evitaDuplicatiTappaCorridore: true,
    colonne: [
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "posizione", label: "Posizione", type: "number" },
      { key: "punti", label: "Punti", type: "number" },
    ],
  });
}

let queryRitiri = "";

async function renderRitiri(corpo) {
  sottoTabAttiva = "ritiri";
  await garantisciCorridori();
  await garantisciTappe();
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca corridore, squadra o motivo...")}
      <button class="btn-secondary btn-piccolo" id="btnNuovoRitiroRisultati">${icona("aggiungi")}nuovo ritiro</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Ritirato dalla tappa</th><th>Motivo</th><th>Note</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaRitiri"></tbody>
      </table>
    </div>
  `;
  document
    .getElementById("btnNuovoRitiroRisultati")
    .addEventListener("click", apriNuovoRitiroRisultati);
  attivaCampoRicerca(corpo, (q) => {
    queryRitiri = q;
    disegnaRitiri();
  });
  disegnaRitiri();
}

// piccolo modale "ponte": si sceglie il corridore ancora in gara, poi si
// passa al modale di ritiro vero e proprio (già usato in Corridori e
// Classifiche) con motivo/tappa/note; preseleziona come tappa di
// riferimento quella eventualmente aperta in questa pagina Risultati
function apriNuovoRitiroRisultati() {
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
    const tappaCorrente = cache.tappe.find((t) => t.id === tappaSelezionataId);
    apriFormRitiro(c, {
      tappaNumeroPreselezionata: tappaCorrente?.numero_tappa ?? null,
      alSalvataggio: aggiornaDopoRitiroRitiri,
    });
  });
}

function disegnaRitiri() {
  const tbody = document.getElementById("tabellaRitiri");
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
      if (c) apriFormRitiro(c, { alSalvataggio: aggiornaDopoRitiroRitiri });
    }),
  );
  tbody.querySelectorAll("[data-riammetti]").forEach((b) =>
    b.addEventListener("click", () =>
      riammettiCorridore(+b.dataset.riammetti, { alSalvataggio: aggiornaDopoRitiroRitiri }),
    ),
  );
}

async function aggiornaDopoRitiroRitiri() {
  await caricaCorridori();
  disegnaRitiri();
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "arrivo", label: "Arrivo di tappa" },
      { key: "traguardi", label: "Traguardi volanti" },
      { key: "gpm", label: "Gran Premi Montagna" },
      { key: "ritiri", label: "Ritiri" },
    ],
    (key, corpo) => {
      if (key === "arrivo") renderArrivo(corpo);
      else if (key === "traguardi") renderTraguardiVolanti(corpo);
      else if (key === "gpm") renderGpm(corpo);
      else renderRitiri(corpo);
    },
  );

  socket.on("risultati:aggiornati", () => {
    if (sottoTabAttiva === "arrivo") ricaricaArrivo();
  });
  // un ritiro/riammissione può arrivare anche dalla pagina Corridori (o da
  // un altro utente collegato): riallineiamo l'anagrafica e ridisegniamo
  socket.on("corridori:aggiornati", async () => {
    if (sottoTabAttiva === "arrivo") {
      await caricaCorridori();
      ricaricaArrivo();
    } else if (sottoTabAttiva === "ritiri") {
      await caricaCorridori();
      disegnaRitiri();
    }
  });
}
