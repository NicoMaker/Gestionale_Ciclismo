import { apiGet, apiPost, apiPut, apiDelete } from "../../core/api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
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
import {
  htmlCampoEntita,
  attivaCampoEntita,
} from "../entita-autocomplete/entita-autocomplete.js";
import { icona, medaglia } from "../../core/icone.js";
import {
  apriFormRitiro,
  riammettiCorridore,
  badgeStato,
} from "../corridori/corridori.js";

let tappaSelezionataId = null;

async function renderArrivo(corpo) {
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
        const corridoreInfo = cache.corridori.find(
          (c) => c.id === r.corridore_id,
        );
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
  tbody
    .querySelectorAll("[data-ritira]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        apriRitiroDaRisultati(+b.dataset.ritira),
      ),
    );
  tbody.querySelectorAll("[data-riammetti]").forEach((b) =>
    b.addEventListener("click", () =>
      riammettiCorridore(+b.dataset.riammetti, {
        alSalvataggio: aggiornaDopoRitiro,
      }),
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

// La vecchia sotto-scheda "Ritiri" (identica a quella duplicata dentro
// Classifiche) è confluita nella pagina unica components/ritiri/ritiri.js,
// raggiungibile come voce di navbar a sé stante. "Arrivo di tappa",
// "Traguardi volanti" e "Gran Premi Montagna" sono ora tre voci separate.
export function initArrivo(container) {
  renderArrivo(container);
  socket.on("risultati:aggiornati", ricaricaArrivo);
  // un ritiro/riammissione può arrivare anche dalla pagina Corridori (o da
  // un altro utente collegato): riallineiamo l'anagrafica e ridisegniamo
  socket.on("corridori:aggiornati", async () => {
    await caricaCorridori();
    ricaricaArrivo();
  });
}

export function initTraguardi(container) {
  renderTraguardiVolanti(container);
}

export function initGpm(container) {
  renderGpm(container);
}
