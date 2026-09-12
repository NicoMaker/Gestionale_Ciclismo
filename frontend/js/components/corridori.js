import { apiPost, apiPut, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  bandiera,
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  erroreDaResponse,
} from "../utils.js";
import {
  cache,
  caricaCorridori,
  garantisciSquadre,
  garantisciNazioni,
  garantisciTappe,
} from "../state.js";
import { socket } from "../socket.js";
import { montaListaConForm } from "./tabella-dati.js";
import {
  htmlCampoNazione,
  attivaCampoNazione,
} from "./nazione-autocomplete.js";
import {
  htmlCampoEntita,
  attivaCampoEntita,
} from "./entita-autocomplete.js";
import { icona } from "../icone.js";

const MOTIVI_RITIRO = {
  infortunio: "Infortunio",
  abbandono: "Abbandono / non partecipazione",
  squalifica: "Squalifica",
  altro: "Altro",
};

let sottoTabAttiva = "elenco";
let queryCorrente = "";

function renderElenco(corpo) {
  sottoTabAttiva = "elenco";
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca corridore, nazione o squadra...")}
      <button class="btn-secondary btn-piccolo" id="btnNuovoCorridore">${icona("aggiungi")}nuovo corridore</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pett.</th><th>Nome</th><th>Nazionalità</th><th>Squadra</th><th>Stato</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaCorridori"></tbody>
      </table>
    </div>
  `;
  document
    .getElementById("btnNuovoCorridore")
    .addEventListener("click", async () => {
      await garantisciSquadre();
      await garantisciNazioni();
      apriFormCorridore(null);
    });
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    disegnaElenco();
  });
  ricaricaElenco();
}

function badgeStato(c) {
  if (!c.ritirato) return '<span class="badge badge-in-gara">in gara</span>';
  const motivo = MOTIVI_RITIRO[c.motivo_ritiro] || "Ritirato";
  const daTappa = c.ritirato_tappa_numero
    ? ` dalla tappa ${c.ritirato_tappa_numero}`
    : "";
  return `<span class="badge badge-ritirato" title="${motivo}${daTappa}">${icona("infortunio")}${motivo}${daTappa}</span>`;
}

function disegnaElenco() {
  const tbody = document.getElementById("tabellaCorridori");
  if (!tbody) return;
  const filtrati = cache.corridori.filter((c) => {
    if (!queryCorrente) return true;
    const testo =
      `${c.nome} ${c.cognome} ${c.nazione_nome ?? ""} ${c.squadra_nome ?? ""} ${c.numero_pettorale ?? ""}`.toLowerCase();
    return testo.includes(queryCorrente);
  });
  tbody.innerHTML =
    filtrati
      .map(
        (c) => `
    <tr class="${c.ritirato ? "riga-ritirato" : ""}">
      <td><span class="badge badge-pettorale">${c.numero_pettorale ?? "—"}</span></td>
      <td><strong>${c.nome} ${c.cognome}</strong></td>
      <td>${c.nazione_codice ? `<span class="bandiera">${bandiera(c.nazione_codice)}</span>${c.nazione_nome}` : "—"}</td>
      <td>${c.squadra_nome ? `${c.squadra_nazione_codice ? `<span class="bandiera">${bandiera(c.squadra_nazione_codice)}</span>` : ""}<span class="dot-colore" style="background:${c.squadra_colore || "#999"}"></span>${c.squadra_nome}` : "—"}</td>
      <td>${badgeStato(c)}</td>
      <td class="td-azioni">
        ${
          c.ritirato
            ? `<button class="btn-icon" title="riammetti in gara" data-riammetti="${c.id}">${icona("ripristina")}</button>`
            : `<button class="btn-icon" title="segna infortunio / ritiro" data-ritira="${c.id}">${icona("infortunio")}</button>`
        }
        <button class="btn-icon" title="modifica" data-modifica="${c.id}">${icona("modifica")}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${c.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">${queryCorrente ? "Nessun corridore trovato" : "Nessun corridore inserito"}</td></tr>`;

  tbody.querySelectorAll("[data-modifica]").forEach((b) =>
    b.addEventListener("click", async () => {
      await garantisciSquadre();
      await garantisciNazioni();
      const c = cache.corridori.find((c) => c.id === +b.dataset.modifica);
      if (c) apriFormCorridore(c);
    }),
  );
  tbody
    .querySelectorAll("[data-elimina]")
    .forEach((b) =>
      b.addEventListener("click", () => eliminaCorridore(+b.dataset.elimina)),
    );
  tbody.querySelectorAll("[data-ritira]").forEach((b) =>
    b.addEventListener("click", async () => {
      await garantisciTappe();
      const c = cache.corridori.find((c) => c.id === +b.dataset.ritira);
      if (c) apriFormRitiro(c);
    }),
  );
  tbody
    .querySelectorAll("[data-riammetti]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        riammettiCorridore(+b.dataset.riammetti),
      ),
    );
}

async function ricaricaElenco() {
  await caricaCorridori();
  disegnaElenco();
}

function apriFormCorridore(corridoreEsistente) {
  const c = corridoreEsistente || {};
  apriModal(`
    <h2>${corridoreEsistente ? "Modifica corridore" : "Nuovo corridore"}</h2>
    <div class="field-row">
      <div class="field"><label>Nome</label><input id="c_nome" value="${c.nome ?? ""}"></div>
      <div class="field"><label>Cognome</label><input id="c_cognome" value="${c.cognome ?? ""}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Pettorale</label><input type="number" id="c_pettorale" value="${c.numero_pettorale ?? ""}"></div>
      ${htmlCampoNazione("c_naz", "Nazionalità")}
    </div>
    ${htmlCampoEntita("c_squadra", "Squadra", "squadra")}
    <div class="modal-actions">
      <button class="btn-secondary" id="c_annulla">annulla</button>
      <button class="btn-primary" id="c_salva">${corridoreEsistente ? "salva modifiche" : "salva corridore"}</button>
    </div>
  `);
  const leggiNazioneId = attivaCampoNazione("c_naz", c.nazione_id ?? null);
  const leggiSquadraId = attivaCampoEntita(
    "c_squadra",
    "squadra",
    c.squadra_id ?? null,
  );
  document.getElementById("c_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("c_salva")
    .addEventListener("click", () =>
      salvaCorridore(corridoreEsistente, leggiNazioneId, leggiSquadraId),
    );
}

async function salvaCorridore(corridoreEsistente, leggiNazioneId, leggiSquadraId) {
  const body = {
    nome: document.getElementById("c_nome").value,
    cognome: document.getElementById("c_cognome").value,
    numero_pettorale: +document.getElementById("c_pettorale").value || null,
    nazione_id: leggiNazioneId(),
    squadra_id: leggiSquadraId(),
  };
  if (!body.nome || !body.cognome) {
    mostraToast("Nome e cognome obbligatori");
    return;
  }
  const res = corridoreEsistente
    ? await apiPut("/api/corridori/" + corridoreEsistente.id, body)
    : await apiPost("/api/corridori", body);
  if (res.ok) {
    chiudiModal();
    mostraToast(
      corridoreEsistente ? "Corridore modificato" : "Corridore aggiunto",
    );
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

async function eliminaCorridore(id) {
  if (
    !confirm(
      "Eliminare questo corridore? Verrà spostato nel cestino per 15 giorni.",
    )
  )
    return;
  const res = await apiDelete("/api/corridori/" + id);
  if (res.ok) mostraToast("Corridore spostato nel cestino");
  else
    mostraToast(
      await erroreDaResponse(res, "Impossibile eliminare il corridore"),
    );
}

/* ---------------------------------------------------------------------
 * Ritiro / infortunio: da quando un corridore viene segnato come ritirato
 * (infortunio, abbandono, squalifica...) non è più selezionabile per
 * nessuna nuova tappa e sparisce da tutte le classifiche, pur restando
 * visibile in anagrafica con lo storico dei risultati già ottenuti.
 * ------------------------------------------------------------------- */
function apriFormRitiro(corridore) {
  const c = corridore;
  // di default si propone la prima tappa "programmata" successiva come
  // ultima tappa NON disputata: comodo per il caso comune "esce ora,
  // dalla prossima tappa non corre più"
  const prossimaTappa = [...cache.tappe]
    .sort((a, b) => a.numero_tappa - b.numero_tappa)
    .find((t) => t.stato !== "conclusa");

  apriModal(`
    <h2>Segna ritiro — ${c.nome} ${c.cognome}</h2>
    <p style="color:var(--testo-soft);font-size:13.5px;margin:-6px 0 16px;">
      Da questo momento il corridore non potrà più essere selezionato per
      risultati di tappa, traguardi volanti o GPM, e non comparirà più in
      nessuna classifica.
    </p>
    <div class="field">
      <label>Non parteciperà più a partire dalla tappa</label>
      <select id="rit_tappa">
        <option value="">— non specificato —</option>
        ${cache.tappe
          .slice()
          .sort((a, b) => a.numero_tappa - b.numero_tappa)
          .map(
            (t) =>
              `<option value="${t.numero_tappa}" ${prossimaTappa && t.id === prossimaTappa.id ? "selected" : ""}>Tappa ${t.numero_tappa} — ${t.nome}</option>`,
          )
          .join("")}
      </select>
    </div>
    <div class="field">
      <label>Motivo</label>
      <select id="rit_motivo">
        ${Object.entries(MOTIVI_RITIRO)
          .map(([v, l]) => `<option value="${v}">${l}</option>`)
          .join("")}
      </select>
    </div>
    <div class="field"><label>Note (opzionale)</label><input id="rit_note" placeholder="es. caduta al km 80, frattura al polso"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="rit_annulla">annulla</button>
      <button class="btn-primary" id="rit_conferma">conferma ritiro</button>
    </div>
  `);
  document
    .getElementById("rit_annulla")
    .addEventListener("click", chiudiModal);
  document.getElementById("rit_conferma").addEventListener("click", () =>
    confermaRitiro(c.id),
  );
}

async function confermaRitiro(corridoreId) {
  const body = {
    ritirato_tappa_numero:
      +document.getElementById("rit_tappa").value || null,
    motivo_ritiro: document.getElementById("rit_motivo").value,
    note_ritiro: document.getElementById("rit_note").value || null,
  };
  const res = await apiPost(`/api/corridori/${corridoreId}/ritira`, body);
  if (res.ok) {
    chiudiModal();
    mostraToast("Corridore segnato come ritirato");
    ricaricaElenco();
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

async function riammettiCorridore(corridoreId) {
  if (!confirm("Riammettere questo corridore in gara?")) return;
  const res = await apiPost(`/api/corridori/${corridoreId}/riammetti`, {});
  if (res.ok) {
    mostraToast("Corridore riammesso in gara");
    ricaricaElenco();
  } else mostraToast(await erroreDaResponse(res, "Impossibile riammettere"));
}

function renderBiciclette(corpo) {
  sottoTabAttiva = "biciclette";
  montaListaConForm(corpo, {
    titolo: "Biciclette",
    apiPath: "/api/biciclette",
    colonne: [
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "marca", label: "Marca", type: "text" },
      { key: "modello", label: "Modello", type: "text" },
      { key: "telaio", label: "N. telaio", type: "text" },
    ],
  });
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "elenco", label: "Elenco corridori" },
      { key: "biciclette", label: "Biciclette" },
    ],
    (key, corpo) => {
      if (key === "elenco") renderElenco(corpo);
      else renderBiciclette(corpo);
    },
  );

  socket.on("corridori:aggiornati", () => {
    if (sottoTabAttiva === "elenco") ricaricaElenco();
  });
}
