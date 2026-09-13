import { apiGet, apiPost, apiDelete } from "../api.js";
import { mostraToast, attivaCampoRicerca, erroreDaResponse } from "../utils.js";
import {
  caricaSquadre,
  caricaCorridori,
  caricaTappe,
  caricaNazioni,
  caricaSponsor,
} from "../state.js";
import { socket } from "../socket.js";
import { icona } from "../icone.js";

let vociCorrenti = [];
let queryCorrente = "";
let tbodyGlobale = null;
let contatoreGlobale = null;

// Dopo un ripristino, la cache dell'entità coinvolta va ricaricata perché
// le altre schermate leggono cache.* invece di rifare sempre la fetch.
const RICARICA_PER_ENTITA = {
  squadre: caricaSquadre,
  corridori: caricaCorridori,
  tappe: caricaTappe,
  nazioni: caricaNazioni,
  sponsor: caricaSponsor,
};

function formattaData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("it-IT") +
    " " +
    d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
  );
}

function badgeScadenza(giorni) {
  const classe =
    giorni <= 3
      ? "badge-positivo"
      : giorni <= 7
        ? "badge-cronometro"
        : "badge-pianura";
  const testo =
    giorni <= 0
      ? "scade oggi"
      : `scade tra ${giorni} giorn${giorni === 1 ? "o" : "i"}`;
  return `<span class="badge ${classe}">${testo}</span>`;
}

function disegna() {
  if (!tbodyGlobale) return;
  const filtrate = vociCorrenti.filter((v) => {
    if (!queryCorrente) return true;
    return `${v.etichetta} ${v.descrizione}`
      .toLowerCase()
      .includes(queryCorrente);
  });
  tbodyGlobale.innerHTML =
    filtrate
      .map(
        (v) => `
    <tr>
      <td><span class="badge badge-numero">${v.etichetta}</span></td>
      <td><strong>${v.descrizione}</strong></td>
      <td>${formattaData(v.eliminato_il)}</td>
      <td>${badgeScadenza(v.giorni_rimanenti)}</td>
      <td class="td-azioni">
        <button class="btn-icon" title="ripristina" data-ripristina="${v.id}">${icona("ripristina")}</button>
        <button class="btn-icon danger" title="elimina definitivamente" data-elimina-def="${v.id}">${icona("elimina_definitivo")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" class="stato-vuoto">${queryCorrente ? "Nessun elemento trovato" : "Il cestino è vuoto"}</td></tr>`;

  if (contatoreGlobale)
    contatoreGlobale.textContent = `${vociCorrenti.length} element${vociCorrenti.length === 1 ? "o" : "i"} nel cestino`;

  tbodyGlobale
    .querySelectorAll("[data-ripristina]")
    .forEach((b) =>
      b.addEventListener("click", () => ripristina(+b.dataset.ripristina)),
    );
  tbodyGlobale
    .querySelectorAll("[data-elimina-def]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        eliminaDefinitivo(+b.dataset.eliminaDef),
      ),
    );
}

async function ricarica() {
  vociCorrenti = await apiGet("/api/cestino");
  disegna();
}

async function ripristina(id) {
  const voce = vociCorrenti.find((v) => v.id === id);
  if (!voce) return;
  if (!confirm(`Ripristinare "${voce.descrizione}"?`)) return;

  const res = await apiPost(`/api/cestino/${id}/ripristina`, {});
  if (res.ok) {
    mostraToast(`${voce.etichetta} ripristinato/a`);
    const ricaricaCache = RICARICA_PER_ENTITA[voce.entita];
    if (ricaricaCache) await ricaricaCache();
    ricarica();
  } else {
    mostraToast(await erroreDaResponse(res, "Impossibile ripristinare"));
  }
}

async function eliminaDefinitivo(id) {
  const voce = vociCorrenti.find((v) => v.id === id);
  if (!voce) return;
  if (
    !confirm(
      `Eliminare definitivamente "${voce.descrizione}"? L'operazione non è reversibile.`,
    )
  )
    return;
  const res = await apiDelete(`/api/cestino/${id}`);
  if (res.ok) {
    mostraToast("Eliminato definitivamente");
    ricarica();
  } else {
    mostraToast(await erroreDaResponse(res, "Impossibile eliminare"));
  }
}

async function svuotaTutto() {
  if (!vociCorrenti.length) return;
  if (
    !confirm(
      `Svuotare completamente il cestino? Tutti i ${vociCorrenti.length} elementi verranno eliminati in modo definitivo e non reversibile.`,
    )
  )
    return;
  const res = await apiDelete("/api/cestino");
  if (res.ok) {
    mostraToast("Cestino svuotato");
    ricarica();
  } else {
    mostraToast(await erroreDaResponse(res, "Impossibile svuotare il cestino"));
  }
}

export function init(container) {
  container.innerHTML = `
    <div class="subtab-head">
      <div class="search-box">${icona("cerca")}<input type="text" class="search-input" placeholder="cerca nel cestino..." autocomplete="off"></div>
      <span id="cestinoContatore" style="color:#74758a;font-size:13px;margin-left:8px;"></span>
      <button class="btn-secondary btn-piccolo danger" id="btnSvuotaCestino">${icona("elimina_definitivo")}svuota cestino</button>
    </div>
    <p style="color:#74758a;font-size:13px;margin:0 0 12px;">
      Gli elementi eliminati restano qui per 15 giorni prima di essere rimossi automaticamente ogni notte.
      Un elemento può essere ripristinato solo se non genera conflitti (es. nome già in uso) o riferimenti a dati nel frattempo eliminati.
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tipo</th><th>Elemento</th><th>Eliminato il</th><th>Scadenza</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaCestino"></tbody>
      </table>
    </div>
  `;

  tbodyGlobale = container.querySelector("#tabellaCestino");
  contatoreGlobale = container.querySelector("#cestinoContatore");

  container
    .querySelector("#btnSvuotaCestino")
    .addEventListener("click", svuotaTutto);

  attivaCampoRicerca(container, (q) => {
    queryCorrente = q;
    disegna();
  });

  socket.on("cestino:aggiornato", ricarica);

  ricarica();
}
