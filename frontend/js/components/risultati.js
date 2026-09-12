import { apiGet, apiPost, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
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
import { montaListaConForm } from "./tabella-dati.js";
import { icona, medaglia } from "../icone.js";

let sottoTabAttiva = "arrivo";
let tappaSelezionataId = null;

function htmlSelectTappe(idSelect) {
  return `<select id="${idSelect}" class="select-tappa">
    ${cache.tappe.map((t) => `<option value="${t.id}">Tappa ${t.numero_tappa} — ${t.nome}</option>`).join("")}
  </select>`;
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
  `;

  const sel = document.getElementById("selRisultatiTappa");
  sel.value = tappaSelezionataId;
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
        return `
    <tr>
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : (r.posizione ?? "—")}</td>
      <td>${r.numero_pettorale ?? "—"}</td>
      <td><strong>${r.nazione_codice ? bandiera(r.nazione_codice, 16) + " " : ""}${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? "—"}</td>
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
}

function apriFormRisultato(risultatoEsistente) {
  const r = risultatoEsistente || {};
  apriModal(`
    <h2>${risultatoEsistente ? "Modifica risultato" : "Aggiungi risultato"}</h2>
    <div class="field"><label>Corridore</label>
      <select id="r_corridore" ${risultatoEsistente ? "disabled" : ""}>
        ${cache.corridori.map((c) => `<option value="${c.id}" ${r.corridore_id === c.id ? "selected" : ""}>${c.nome} ${c.cognome}</option>`).join("")}
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

async function salvaRisultato(risultatoEsistente) {
  const body = {
    tappa_id: tappaSelezionataId,
    corridore_id: +document.getElementById("r_corridore").value,
    posizione: +document.getElementById("r_posizione").value || null,
    punti: +document.getElementById("r_punti").value || 0,
    tempo: document.getElementById("r_tempo").value,
    distacco: document.getElementById("r_distacco").value,
  };
  // La route risultati fa upsert su (tappa_id, corridore_id): stesso endpoint per crea e modifica
  const res = await apiPost("/api/risultati", body);
  if (res.ok) {
    chiudiModal();
    mostraToast(
      risultatoEsistente ? "Risultato modificato" : "Risultato salvato",
    );
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
    colonne: [
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "posizione", label: "Posizione", type: "number" },
      { key: "punti", label: "Punti", type: "number" },
    ],
  });
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "arrivo", label: "Arrivo di tappa" },
      { key: "traguardi", label: "Traguardi volanti" },
      { key: "gpm", label: "Gran Premi Montagna" },
    ],
    (key, corpo) => {
      if (key === "arrivo") renderArrivo(corpo);
      else if (key === "traguardi") renderTraguardiVolanti(corpo);
      else renderGpm(corpo);
    },
  );

  socket.on("risultati:aggiornati", () => {
    if (sottoTabAttiva === "arrivo") ricaricaArrivo();
  });
}
