import { apiGet, apiPost, apiPut, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  bandiera,
  attivaCampoRicerca,
} from "../utils.js";
import { socket } from "../socket.js";
import { icona } from "../icone.js";

let nazioniCorrenti = [];
let queryCorrente = "";

function disegna(tbody) {
  const filtrate = nazioniCorrenti.filter(
    (n) =>
      !queryCorrente ||
      n.nome.toLowerCase().includes(queryCorrente) ||
      n.codice_iso2.toLowerCase().includes(queryCorrente),
  );
  tbody.innerHTML =
    filtrate
      .map(
        (n) => `
    <tr>
      <td><span class="bandiera">${bandiera(n.codice_iso2)}</span>${n.nome}</td>
      <td><span class="badge badge-codice">${n.codice_iso2}</span></td>
      <td class="td-azioni">
        <button class="btn-icon" title="modifica" data-modifica='${JSON.stringify(n)}'>${icona("modifica")}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${n.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="3" style="text-align:center;color:#999;padding:24px;">${queryCorrente ? "Nessuna nazione trovata" : "Nessuna nazione inserita"}</td></tr>`;

  tbody
    .querySelectorAll("[data-modifica]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        apriForm(JSON.parse(b.dataset.modifica)),
      ),
    );
  tbody
    .querySelectorAll("[data-elimina]")
    .forEach((b) =>
      b.addEventListener("click", () => eliminaNazione(+b.dataset.elimina)),
    );
}

async function ricarica(tbody) {
  nazioniCorrenti = await apiGet("/api/nazioni");
  disegna(tbody);
}

function apriForm(nazioneEsistente) {
  const n = nazioneEsistente || {};
  apriModal(`
    <h2>${nazioneEsistente ? "Modifica nazione" : "Nuova nazione"}</h2>
    <div class="field"><label>Nome</label><input id="n_nome" value="${n.nome ?? ""}"></div>
    <div class="field"><label>Codice ISO2</label><input id="n_codice" maxlength="2" placeholder="es. IT" value="${n.codice_iso2 ?? ""}"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="n_annulla">annulla</button>
      <button class="btn-primary" id="n_salva">${nazioneEsistente ? "salva modifiche" : "salva"}</button>
    </div>
  `);
  document.getElementById("n_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("n_salva")
    .addEventListener("click", () => salvaNazione(nazioneEsistente));
}

async function salvaNazione(nazioneEsistente) {
  const body = {
    nome: document.getElementById("n_nome").value,
    codice_iso2: document.getElementById("n_codice").value,
  };
  if (!body.nome || body.codice_iso2.length !== 2) {
    mostraToast("Nome e codice ISO2 (2 lettere) sono obbligatori");
    return;
  }
  const res = nazioneEsistente
    ? await apiPut("/api/nazioni/" + nazioneEsistente.id, body)
    : await apiPost("/api/nazioni", body);
  if (res.ok) {
    chiudiModal();
    mostraToast(nazioneEsistente ? "Nazione modificata" : "Nazione aggiunta");
  } else mostraToast("Errore nel salvataggio (nome o codice già usati?)");
}

async function eliminaNazione(id) {
  if (
    !confirm(
      "Eliminare questa nazione? I riferimenti in corridori/squadre verranno svuotati.",
    )
  )
    return;
  await apiDelete("/api/nazioni/" + id);
  mostraToast("Nazione eliminata");
}

export function init(container) {
  const corpo = document.createElement("div");
  corpo.innerHTML = `
    <div class="subtab-head">
      <div class="search-box">${icona("cerca")}<input type="text" class="search-input" placeholder="cerca nazione o codice..." autocomplete="off"></div>
      <button class="btn-secondary btn-piccolo" id="btnNuovaNazione">${icona("aggiungi")}nuova nazione</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nazione</th><th>Codice</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaNazioni"></tbody>
      </table>
    </div>
  `;
  container.appendChild(corpo);
  corpo
    .querySelector("#btnNuovaNazione")
    .addEventListener("click", () => apriForm(null));
  const tbody = corpo.querySelector("#tabellaNazioni");
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    disegna(tbody);
  });
  socket.on("nazioni:aggiornate", () => ricarica(tbody));
  ricarica(tbody);
}
