import { apiGet, apiPost, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  htmlSelectConRicerca,
  attivaSelectConRicerca,
  bandiera,
  htmlNomeSquadra,
  erroreDaResponse,
} from "../utils.js";
import {
  cache,
  caricaTappe,
  caricaCorridori,
  garantisciTappe,
  garantisciCorridori,
} from "../state.js";
import { socket } from "../socket.js";
import { montaListaConForm, opzioniSelectTappe } from "./tabella-dati.js";
import { montaGestioneRitiri } from "./ritiri-ui.js";
import { icona, medaglia } from "../icone.js";

let sottoTabAttiva = "arrivo";
let tappaSelezionataId = null;

function htmlSelectTappe(idSelect) {
  return htmlSelectConRicerca({
    id: idSelect,
    opzioni: opzioniSelectTappe(),
    placeholderRicerca: "cerca tappa...",
    valore: tappaSelezionataId,
  });
}

function etichettaMotivo(motivo) {
  if (motivo === "infortunio") return "infortunio in tappa";
  if (motivo === "non_partecipa") return "non parteciperà dalla tappa dopo";
  return motivo;
}

async function renderArrivo(corpo) {
  sottoTabAttiva = "arrivo";
  await garantisciTappe();
  if (!tappaSelezionataId && cache.tappe.length)
    tappaSelezionataId = cache.tappe[0].id;

  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlSelectTappe("selRisultatiTappa")}
      ${htmlCampoRicerca("cerca corridore o squadra...")}
      <button class="btn-secondary btn-piccolo" id="btnAggiungiRisultato">${icona("aggiungi")}aggiungi risultato</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Tempo</th><th>Distacco</th><th>Punti</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaRisultati"></tbody>
      </table>
    </div>
    <div class="subtab-sezione sezione-ritiri">
      <div class="subtab-head">
        <h4>Ritiri e infortuni a fine tappa</h4>
        <button class="btn-secondary btn-piccolo" id="btnAggiungiRitiro">${icona("aggiungi")}inserisci ritiro</button>
      </div>
      <p class="hint-ritiri">Chi si infortuna in questa tappa, o chi non parteciperà più dalla tappa successiva, va inserito qui. Da quel momento non compare più nelle classifiche e non può gareggiare nelle tappe seguenti.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Motivo</th><th class="th-azioni"></th></tr></thead>
          <tbody id="tabellaRitiri"></tbody>
        </table>
      </div>
    </div>
  `;

  const sel = document.getElementById("selRisultatiTappa");
  sel.value = tappaSelezionataId;
  attivaSelectConRicerca(corpo);
  sel.addEventListener("change", () => {
    tappaSelezionataId = +sel.value;
    ricaricaArrivo();
  });
  document
    .getElementById("btnAggiungiRisultato")
    .addEventListener("click", async () => {
      await garantisciCorridori();
      apriFormRisultato(null);
    });
  document
    .getElementById("btnAggiungiRitiro")
    .addEventListener("click", async () => {
      await garantisciCorridori();
      apriFormRitiro();
    });
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    ricaricaArrivo();
  });

  ricaricaArrivo();
}

let queryCorrente = "";
let risultatiCorrenti = [];
let ritiriCorrenti = [];
let esclusiCorrenti = [];

function idsEsclusi() {
  return new Set(esclusiCorrenti.map((e) => e.corridore_id));
}

async function ricaricaArrivo() {
  const tbody = document.getElementById("tabellaRisultati");
  if (!tbody || !tappaSelezionataId) return;
  const [risultati, ritiri, esclusi] = await Promise.all([
    apiGet("/api/risultati/tappa/" + tappaSelezionataId),
    apiGet("/api/ritiri/tappa/" + tappaSelezionataId),
    apiGet("/api/ritiri/esclusi/" + tappaSelezionataId),
  ]);
  risultatiCorrenti = risultati;
  ritiriCorrenti = ritiri;
  esclusiCorrenti = esclusi;
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
        return `
    <tr>
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : (r.posizione ?? "—")}</td>
      <td>${r.numero_pettorale ?? "—"}</td>
      <td><strong>${r.nazione_codice ? bandiera(r.nazione_codice, 16) + " " : ""}${r.nome} ${r.cognome}</strong></td>
      <td>${htmlNomeSquadra(r.squadra_nome, r.squadra_nazione_codice)}</td>
      <td>${r.tempo ?? "—"}</td>
      <td>${r.distacco}</td>
      <td><span class="badge badge-punti">${r.punti}</span></td>
      <td class="td-azioni">
        <button class="btn-icon" title="modifica" data-modifica='${JSON.stringify({ id: r.id, corridore_id: r.corridore_id, posizione: r.posizione, tempo: r.tempo, distacco: r.distacco, punti: r.punti })}'>${icona("modifica")}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${r.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="8" style="text-align:center;color:#999;padding:24px;">${queryCorrente ? "Nessun risultato trovato" : "Nessun risultato per questa tappa"}</td></tr>`;

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

  disegnaRitiri();
}

function disegnaRitiri() {
  const tbody = document.getElementById("tabellaRitiri");
  if (!tbody) return;
  const filtrati = ritiriCorrenti.filter((r) => {
    if (!queryCorrente) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""} ${etichettaMotivo(r.motivo)}`
      .toLowerCase()
      .includes(queryCorrente);
  });
  tbody.innerHTML =
    filtrati
      .map(
        (r) => `
    <tr>
      <td>${r.numero_pettorale ?? "—"}</td>
      <td><strong>${r.nazione_codice ? bandiera(r.nazione_codice, 16) + " " : ""}${r.nome} ${r.cognome}</strong></td>
      <td>${htmlNomeSquadra(r.squadra_nome, r.squadra_nazione_codice)}</td>
      <td><span class="badge badge-${r.motivo}">${etichettaMotivo(r.motivo)}</span></td>
      <td class="td-azioni">
        <button class="btn-icon danger" title="elimina" data-elimina-ritiro="${r.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">Nessun ritiro per questa tappa</td></tr>`;

  tbody
    .querySelectorAll("[data-elimina-ritiro]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        eliminaRitiro(+b.dataset.eliminaRitiro),
      ),
    );
}

function corridoriDisponibiliPerRisultato(corridoreIdFisso) {
  const fuori = idsEsclusi();
  const giaArrivati = new Set(risultatiCorrenti.map((r) => r.corridore_id));
  return cache.corridori.filter((c) => {
    if (corridoreIdFisso && c.id === corridoreIdFisso) return true;
    if (fuori.has(c.id)) return false;
    if (giaArrivati.has(c.id)) return false;
    return true;
  });
}

function corridoriDisponibiliPerRitiro() {
  const giaRitirati = new Set(ritiriCorrenti.map((r) => r.corridore_id));
  const fuori = idsEsclusi();
  return cache.corridori.filter(
    (c) => !giaRitirati.has(c.id) && !fuori.has(c.id),
  );
}

function apriFormRisultato(risultatoEsistente) {
  const r = risultatoEsistente || {};
  const elenco = corridoriDisponibiliPerRisultato(r.corridore_id);
  if (!elenco.length) {
    mostraToast("Non ci sono corridori ancora in gara per questa tappa");
    return;
  }
  apriModal(`
    <h2>${risultatoEsistente ? "Modifica risultato" : "Aggiungi risultato"}</h2>
    <div class="field"><label>Corridore</label>
      <select id="r_corridore" ${risultatoEsistente ? "disabled" : ""}>
        ${elenco.map((c) => `<option value="${c.id}" ${r.corridore_id === c.id ? "selected" : ""}>${c.nome} ${c.cognome}</option>`).join("")}
      </select>
    </div>
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
  document.getElementById("r_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("r_salva")
    .addEventListener("click", () => salvaRisultato(risultatoEsistente));
}

function apriFormRitiro() {
  const elenco = corridoriDisponibiliPerRitiro();
  if (!elenco.length) {
    mostraToast("Non ci sono corridori da ritirare per questa tappa");
    return;
  }
  apriModal(`
    <h2>Ritiro a fine tappa</h2>
    <div class="field"><label>Corridore</label>
      <select id="rit_corridore">
        ${elenco.map((c) => `<option value="${c.id}">${c.nome} ${c.cognome}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Motivo</label>
      <select id="rit_motivo">
        <option value="infortunio">infortunio in questa tappa (fuori da ora)</option>
        <option value="non_partecipa">non parteciperà più dalla tappa successiva</option>
      </select>
    </div>
    <p class="hint-ritiri">L'infortunato non deve avere un arrivo in questa tappa. Chi non parte più dalla tappa dopo può comunque avere il risultato di oggi; dalla prossima non potrà più essere inserito e sparisce dalle classifiche.</p>
    <div class="modal-actions">
      <button class="btn-secondary" id="rit_annulla">annulla</button>
      <button class="btn-primary" id="rit_salva">salva ritiro</button>
    </div>
  `);
  document.getElementById("rit_annulla").addEventListener("click", chiudiModal);
  document.getElementById("rit_salva").addEventListener("click", salvaRitiro);
}

async function salvaRisultato(risultatoEsistente) {
  const body = {
    tappa_id: tappaSelezionataId,
    corridore_id: +document.getElementById("r_corridore").value,
    posizione: +document.getElementById("r_posizione").value || null,
    punti: +document.getElementById("r_punti").value || 0,
    tempo: document.getElementById("r_tempo").value,
    distacco: document.getElementById("r_distacco").value,
  };
  const res = await apiPost("/api/risultati", body);
  if (res.ok) {
    chiudiModal();
    mostraToast(
      risultatoEsistente ? "Risultato modificato" : "Risultato salvato",
    );
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

async function salvaRitiro() {
  const body = {
    tappa_id: tappaSelezionataId,
    corridore_id: +document.getElementById("rit_corridore").value,
    motivo: document.getElementById("rit_motivo").value,
  };
  const res = await apiPost("/api/ritiri", body);
  if (res.ok) {
    chiudiModal();
    mostraToast("Ritiro registrato: il corridore esce dalle classifiche");
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

async function eliminaRisultato(id) {
  if (!confirm("Eliminare questo risultato?")) return;
  const res = await apiDelete("/api/risultati/" + id);
  if (res.ok) mostraToast("Risultato eliminato");
  else mostraToast(await erroreDaResponse(res, "Impossibile eliminare"));
}

async function eliminaRitiro(id) {
  if (!confirm("Eliminare questo ritiro? Il corridore tornerà in classifica."))
    return;
  const res = await apiDelete("/api/ritiri/" + id);
  if (res.ok) mostraToast("Ritiro eliminato");
  else mostraToast(await erroreDaResponse(res, "Impossibile eliminare"));
}

function renderTraguardiVolanti(corpo) {
  sottoTabAttiva = "traguardi";
  montaListaConForm(corpo, {
    titolo: "Traguardi volanti",
    placeholderRicerca: "cerca corridore, squadra o tappa...",
    apiPath: "/api/traguardi-volanti",
    filtroSelect: { tipo: "tappa", key: "tappa_id", tutte: "tutte le tappe" },
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
    placeholderRicerca: "cerca corridore, squadra o tappa...",
    apiPath: "/api/gpm-risultati",
    filtroSelect: { tipo: "tappa", key: "tappa_id", tutte: "tutte le tappe" },
    colonne: [
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "posizione", label: "Posizione", type: "number" },
      { key: "punti", label: "Punti", type: "number" },
    ],
  });
}

function renderRitiri(corpo) {
  sottoTabAttiva = "ritiri";
  montaGestioneRitiri(corpo);
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "arrivo", label: "Arrivo di tappa" },
      { key: "ritiri", label: "Ritiri per tappa" },
      { key: "traguardi", label: "Traguardi volanti" },
      { key: "gpm", label: "Gran Premi Montagna" },
    ],
    (key, corpo) => {
      if (key === "arrivo") renderArrivo(corpo);
      else if (key === "ritiri") renderRitiri(corpo);
      else if (key === "traguardi") renderTraguardiVolanti(corpo);
      else renderGpm(corpo);
    },
  );

  socket.on("risultati:aggiornati", () => {
    if (sottoTabAttiva === "arrivo") ricaricaArrivo();
  });
  socket.on("ritiri:aggiornati", () => {
    if (sottoTabAttiva === "arrivo") ricaricaArrivo();
  });
}
