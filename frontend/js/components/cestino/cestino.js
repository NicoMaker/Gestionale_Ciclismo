import { apiGet, apiPost, apiDelete } from "../../core/api.js";
import {
  mostraToast,
  attivaCampoRicerca,
  erroreDaResponse,
} from "../../core/utils.js";
import {
  caricaSquadre,
  caricaCorridori,
  caricaTappe,
  caricaNazioni,
  caricaSponsor,
} from "../../core/state.js";
import { socket } from "../../core/socket.js";
import { icona } from "../../core/icone.js";
import {
  htmlThSelezione,
  htmlTdSelezione,
  htmlBarraSelezione,
  montaSelezioneMultipla,
  eseguiInSequenza,
} from "../selezione-multipla/selezione-multipla.js";

let vociCorrenti = [];
let queryCorrente = "";
let tbodyGlobale = null;
let contatoreGlobale = null;
let selezione = null;

// Ordine di ripristino: prima le entità da cui le altre dipendono
// (nazioni/sponsor -> squadre -> tappe -> corridori), così se si selezionano
// insieme una squadra e i suoi corridori, la squadra torna per prima.
const ORDINE_RIPRISTINO = [
  "nazioni",
  "sponsor",
  "squadre",
  "tappe",
  "corridori",
];
const posRipristino = (voce) => {
  const i = ORDINE_RIPRISTINO.indexOf(voce?.entita);
  return i === -1 ? ORDINE_RIPRISTINO.length : i;
};
const nomeVoce = (id) => {
  const v = vociCorrenti.find((x) => x.id === id);
  return v ? `${v.etichetta}: ${v.descrizione}` : `#${id}`;
};

const AZIONI_CESTINO = [
  {
    chiave: "ripristina",
    etichetta: "ripristina selezionati",
    icona: "ripristina",
    danger: false,
  },
  {
    chiave: "elimina",
    etichetta: "elimina definitivamente",
    icona: "elimina_definitivo",
    danger: true,
  },
];

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
      ${htmlTdSelezione(v.id)}
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
    `<tr><td colspan="6" class="stato-vuoto">${queryCorrente ? "Nessun elemento trovato" : "Il cestino è vuoto"}</td></tr>`;

  if (contatoreGlobale)
    contatoreGlobale.textContent = `${vociCorrenti.length} element${vociCorrenti.length === 1 ? "o" : "i"} nel cestino`;

  selezione?.aggiorna();
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
    ${htmlBarraSelezione(AZIONI_CESTINO)}
    <div class="table-wrap">
      <table>
        <thead><tr>${htmlThSelezione()}<th>Tipo</th><th>Elemento</th><th>Eliminato il</th><th>Scadenza</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaCestino"></tbody>
      </table>
    </div>
  `;

  selezione = montaSelezioneMultipla(container, {
    azioni: {
      // il server valida ogni ripristino (nome già in uso, riferimenti a dati
      // eliminati...): solo le voci valide tornano, le altre restano nel
      // cestino e vengono elencate con il motivo
      ripristina: {
        titolo: "Ripristino multiplo",
        conferma: (n) =>
          `Ripristinare ${n} ${n === 1 ? "elemento" : "elementi"}?\n\nTorneranno disponibili solo quelli che non generano conflitti; gli altri restano nel cestino e ti mostrerò il motivo.`,
        esegui: async (ids) => {
          const ordinati = [...ids].sort(
            (a, b) =>
              posRipristino(vociCorrenti.find((v) => v.id === a)) -
              posRipristino(vociCorrenti.find((v) => v.id === b)),
          );
          const entita = new Set(
            ordinati.map((id) => vociCorrenti.find((v) => v.id === id)?.entita),
          );
          const esito = await eseguiInSequenza(
            ordinati,
            (id) => apiPost(`/api/cestino/${id}/ripristina`, {}),
            nomeVoce,
            "Impossibile ripristinare",
          );
          // le altre schermate leggono cache.*: va riallineata
          for (const e of entita) {
            const ricaricaCache = RICARICA_PER_ENTITA[e];
            if (ricaricaCache) await ricaricaCache();
          }
          return esito;
        },
        fatto: (n) =>
          `${n} ${n === 1 ? "elemento ripristinato" : "elementi ripristinati"}`,
        nonFatto: "Non ripristinabili (restano nel cestino)",
      },
      elimina: {
        titolo: "Eliminazione definitiva",
        conferma: (n) =>
          `Eliminare DEFINITIVAMENTE ${n} ${n === 1 ? "elemento" : "elementi"}?\n\nL'operazione non è reversibile.`,
        esegui: (ids) =>
          eseguiInSequenza(
            ids,
            (id) => apiDelete(`/api/cestino/${id}`),
            nomeVoce,
            "Impossibile eliminare",
          ),
        fatto: (n) =>
          `${n} ${n === 1 ? "elemento eliminato" : "elementi eliminati"} definitivamente`,
        nonFatto: "Non eliminabili",
      },
    },
    dopo: () => ricarica(),
  });

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
