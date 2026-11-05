// Selezione multipla con checkbox + barra azioni ("elimina selezionati"),
// come in Gestione Magazzino / Gestione Preventivi / Gestionale Fiscale.
//
// Ogni azione viene eseguita elemento per elemento sulle API esistenti, quindi
// valgono le STESSE regole del singolo: gli elementi non eliminabili (es.
// squadra con corridori, nazione ancora in uso) vengono saltati e mostrati
// con il motivo restituito dal server; gli altri vengono processati.
import { apiDelete } from "../../core/api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  erroreDaResponse,
} from "../../core/utils.js";
import { icona } from "../../core/icone.js";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

/* ---------- HTML da inserire nei render dei componenti ---------- */

// Prima colonna dell'intestazione: "seleziona tutti"
export function htmlThSelezione() {
  return `<th class="bulk-col"><input type="checkbox" class="bulk-all" title="Seleziona tutti" aria-label="Seleziona tutti"></th>`;
}

// Prima cella di ogni riga
export function htmlTdSelezione(id) {
  return `<td class="bulk-col"><input type="checkbox" class="bulk-cb" data-id="${id}" title="Seleziona" aria-label="Seleziona"></td>`;
}

// Checkbox da mettere dentro una card (es. squadre)
export function htmlCheckSelezione(id) {
  return `<label class="bulk-card-check" title="Seleziona"><input type="checkbox" class="bulk-cb" data-id="${id}" aria-label="Seleziona"></label>`;
}

export const AZIONE_ELIMINA = {
  chiave: "elimina",
  etichetta: "elimina selezionati",
  icona: "elimina",
  danger: true,
};

// Barra che compare solo quando c'è almeno un elemento selezionato
export function htmlBarraSelezione(azioni = [AZIONE_ELIMINA]) {
  return `
    <div class="bulk-toolbar" hidden>
      <span class="bulk-count">0 selezionati</span>
      <button class="btn-secondary btn-piccolo" data-bulk="deseleziona">deseleziona</button>
      ${azioni
        .map(
          (a) =>
            `<button class="btn-secondary btn-piccolo${a.danger ? " danger" : ""}" data-bulk="${a.chiave}">${icona(a.icona)}${a.etichetta}</button>`,
        )
        .join("")}
    </div>`;
}

/* ---------- esecuzione in sequenza ---------- */

/**
 * Esegue `richiesta(id)` per ogni id, uno alla volta (SQLite + regole di
 * dipendenza: niente richieste in parallelo). Ritorna { ok, saltati } dove
 * `saltati` contiene il motivo dato dal server per ogni elemento rifiutato.
 */
export async function eseguiInSequenza(
  ids,
  richiesta,
  nomeDi,
  erroreGenerico = "Operazione non riuscita",
) {
  let ok = 0;
  const saltati = [];
  for (const id of ids) {
    try {
      const res = await richiesta(id);
      if (res.ok) ok++;
      else
        saltati.push({
          id,
          nome: nomeDi(id),
          motivo: await erroreDaResponse(res, erroreGenerico),
        });
    } catch (err) {
      saltati.push({
        id,
        nome: nomeDi(id),
        motivo: err?.message || "Errore di connessione",
      });
    }
  }
  return { ok, saltati };
}

// Entità che l'API elimina in modo "soft" (finiscono nel cestino per 15 giorni)
const PERCORSI_CON_CESTINO = [
  "/api/squadre",
  "/api/corridori",
  "/api/tappe",
  "/api/nazioni",
  "/api/sponsor",
];

/**
 * Azione "elimina selezionati" pronta all'uso per un'entità con DELETE /:id.
 * @param {string} apiPath es. "/api/tappe"
 * @param {string} plurale es. "tappe"
 * @param {(id:number)=>string} nomeDi etichetta leggibile mostrata se saltato
 */
export function azioneElimina(apiPath, plurale, nomeDi) {
  const cestino = PERCORSI_CON_CESTINO.some((p) => apiPath.startsWith(p));
  return {
    titolo: "Eliminazione multipla",
    conferma: (n) =>
      `Eliminare ${n} ${n === 1 ? "elemento" : plurale}?\n\n` +
      (cestino
        ? "Verranno spostati nel cestino per 15 giorni. "
        : "L'operazione non è reversibile. ") +
      "Quelli non eliminabili (es. ancora collegati ad altri dati) verranno saltati e ti mostrerò il motivo.",
    esegui: (ids) =>
      eseguiInSequenza(
        ids,
        (id) => apiDelete(`${apiPath}/${id}`),
        nomeDi,
        "Impossibile eliminare",
      ),
    fatto: (n) =>
      cestino
        ? `${n} ${n === 1 ? "elemento spostato" : "elementi spostati"} nel cestino`
        : `${n} ${n === 1 ? "elemento eliminato" : "elementi eliminati"}`,
    nonFatto: "Non eliminabili",
  };
}

/* ---------- montaggio ---------- */

/**
 * @param {HTMLElement} contenitore elemento che contiene barra + tabella/card
 * @param {object} cfg
 * @param {Object<string,{conferma:(n:number)=>string, esegui:(ids:number[])=>Promise<{ok:number,saltati:Array}>,
 *        titolo:string, fatto:(n:number)=>string, nonFatto:string}>} cfg.azioni
 *        una voce per ogni `chiave` di azione presente nella barra
 * @param {Function} [cfg.dopo] eseguita a fine operazione (ricarica i dati)
 * @returns {{aggiorna:Function, pulisci:Function}} chiamare `aggiorna()` dopo ogni render
 */
export function montaSelezioneMultipla(contenitore, cfg) {
  // un solo montaggio per contenitore: i render possono rifare innerHTML,
  // ma i listener delegati restano e non vanno duplicati
  if (contenitore._selezioneMultipla) return contenitore._selezioneMultipla;
  const { azioni, dopo } = cfg;
  let inCorso = false;

  const caselle = () => [...contenitore.querySelectorAll(".bulk-cb")];
  const selezionati = () =>
    caselle()
      .filter((c) => c.checked)
      .map((c) => Number(c.dataset.id));

  function aggiorna() {
    const tutte = caselle();
    const n = tutte.filter((c) => c.checked).length;
    tutte.forEach((c) =>
      c
        .closest("tr, .squadra-card")
        ?.classList.toggle("bulk-selected", c.checked),
    );
    const barra = contenitore.querySelector(".bulk-toolbar");
    if (barra) {
      barra.hidden = n === 0;
      barra.querySelector(".bulk-count").textContent =
        `${n} ${n === 1 ? "selezionato" : "selezionati"}`;
    }
    const tutti = contenitore.querySelector(".bulk-all");
    if (tutti) {
      tutti.disabled = tutte.length === 0;
      tutti.checked = n > 0 && n === tutte.length;
      tutti.indeterminate = n > 0 && n < tutte.length;
    }
  }

  function pulisci() {
    caselle().forEach((c) => (c.checked = false));
    aggiorna();
  }

  function mostraEsito(azione, { ok, saltati }) {
    if (saltati.length === 0) {
      mostraToast(azione.fatto(ok));
      return;
    }
    const righe = saltati
      .map((s) => `<li><strong>${esc(s.nome)}</strong> — ${esc(s.motivo)}</li>`)
      .join("");
    apriModal(`
      <h2>${esc(azione.titolo)}</h2>
      ${ok > 0 ? `<p class="bulk-esito-ok">✅ ${esc(azione.fatto(ok))}</p>` : ""}
      <p class="bulk-esito-ko">⚠️ ${esc(azione.nonFatto)} (${saltati.length}):</p>
      <ul class="bulk-esito-lista">${righe}</ul>
      <div class="modal-actions">
        <button class="btn-primary" id="bulkEsitoOk">ok</button>
      </div>
    `);
    document
      .getElementById("bulkEsitoOk")
      ?.addEventListener("click", chiudiModal);
  }

  contenitore.addEventListener("change", (e) => {
    if (e.target.matches(".bulk-all")) {
      caselle().forEach((c) => (c.checked = e.target.checked));
      aggiorna();
    } else if (e.target.matches(".bulk-cb")) {
      aggiorna();
    }
  });

  contenitore.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-bulk]");
    if (!btn || !contenitore.contains(btn)) return;
    const chiave = btn.dataset.bulk;
    if (chiave === "deseleziona") return pulisci();

    const azione = azioni[chiave];
    const ids = selezionati();
    if (!azione || inCorso || ids.length === 0) return;
    if (!confirm(azione.conferma(ids.length))) return;

    inCorso = true;
    contenitore
      .querySelectorAll("[data-bulk]")
      .forEach((b) => (b.disabled = true));
    try {
      mostraEsito(azione, await azione.esegui(ids));
    } catch (err) {
      mostraToast(err?.message || "Errore durante l'operazione");
    } finally {
      inCorso = false;
      contenitore
        .querySelectorAll("[data-bulk]")
        .forEach((b) => (b.disabled = false));
    }
    pulisci();
    if (dopo) await dopo();
    aggiorna();
  });

  contenitore._selezioneMultipla = { aggiorna, pulisci };
  return contenitore._selezioneMultipla;
}
