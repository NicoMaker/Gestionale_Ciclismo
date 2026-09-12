import { apiPost, apiPut, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  bandiera,
  htmlNomeSquadra,
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
} from "../state.js";
import { socket } from "../socket.js";
import { montaListaConForm } from "./tabella-dati.js";
import {
  htmlCampoNazione,
  attivaCampoNazione,
} from "./nazione-autocomplete.js";
import { icona } from "../icone.js";

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
        <thead><tr><th>Pett.</th><th>Nome</th><th>Nazionalità</th><th>Squadra</th><th class="th-azioni"></th></tr></thead>
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
    <tr>
      <td><span class="badge badge-pettorale">${c.numero_pettorale ?? "—"}</span></td>
      <td><strong>${c.nome} ${c.cognome}</strong></td>
      <td>${c.nazione_codice ? `<span class="bandiera">${bandiera(c.nazione_codice)}</span>${c.nazione_nome}` : "—"}</td>
      <td>${htmlNomeSquadra(c.squadra_nome, c.squadra_nazione_codice, c.squadra_colore)}</td>
      <td class="td-azioni">
        <button class="btn-icon" title="modifica" data-modifica="${c.id}">${icona("modifica")}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${c.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">${queryCorrente ? "Nessun corridore trovato" : "Nessun corridore inserito"}</td></tr>`;

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
    <div class="field"><label>Squadra</label>
      <select id="c_squadra">
        <option value="">— nessuna —</option>
        ${cache.squadre.map((s) => `<option value="${s.id}" ${c.squadra_id === s.id ? "selected" : ""}>${s.nome}</option>`).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="c_annulla">annulla</button>
      <button class="btn-primary" id="c_salva">${corridoreEsistente ? "salva modifiche" : "salva corridore"}</button>
    </div>
  `);
  const leggiNazioneId = attivaCampoNazione("c_naz", c.nazione_id ?? null);
  document.getElementById("c_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("c_salva")
    .addEventListener("click", () =>
      salvaCorridore(corridoreEsistente, leggiNazioneId),
    );
}

async function salvaCorridore(corridoreEsistente, leggiNazioneId) {
  const body = {
    nome: document.getElementById("c_nome").value,
    cognome: document.getElementById("c_cognome").value,
    numero_pettorale: +document.getElementById("c_pettorale").value || null,
    nazione_id: leggiNazioneId(),
    squadra_id: document.getElementById("c_squadra").value || null,
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

export function init(container) {
  creaSottoSchede(
    container,
    [{ key: "elenco", label: "Elenco corridori" }],
    (key, corpo) => {
      if (key === "elenco") renderElenco(corpo);
    },
  );

  socket.on("corridori:aggiornati", () => {
    if (sottoTabAttiva === "elenco") ricaricaElenco();
  });
}
