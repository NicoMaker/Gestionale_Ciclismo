import { apiGet, apiPost, apiPut, apiDelete } from "../api.js";
import {
  mostraToast,
  apriModal,
  chiudiModal,
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
  erroreDaResponse,
  formattaDataIt,
} from "../utils.js";
import { cache } from "../state.js";
import { socket } from "../socket.js";
import { icona, iconaValore } from "../icone.js";
import { htmlCampoEntita, attivaCampoEntita } from "./entita-autocomplete.js";

const TIPI_ENTITA = ["squadra", "corridore", "tappa", "sponsor"];

function risolviValore(colonna, valore) {
  if (valore === null || valore === undefined || valore === "") return "—";
  if (colonna.type === "squadra") {
    const s = cache.squadre.find((s) => s.id === valore);
    if (!s) return valore;
    return `${s.nazione_codice ? bandiera(s.nazione_codice, 16) + " " : ""}${s.nome}`;
  }
  if (colonna.type === "corridore") {
    const c = cache.corridori.find((c) => c.id === valore);
    if (!c) return valore;
    return `${c.nazione_codice ? bandiera(c.nazione_codice, 16) + " " : ""}${c.nome} ${c.cognome}${c.ritirato ? ' <span class="badge badge-ritirato">ritirato</span>' : ""}`;
  }
  if (colonna.type === "tappa") {
    const t = cache.tappe.find((t) => t.id === valore);
    return t ? `Tappa ${t.numero_tappa}` : valore;
  }
  if (colonna.type === "sponsor")
    return cache.sponsor.find((s) => s.id === valore)?.nome ?? valore;
  if (colonna.type === "select") {
    return `<span class="badge badge-${valore}">${iconaValore(valore)}${String(valore).replace(/_/g, " ")}</span>`;
  }
  if (colonna.type === "date") return formattaDataIt(valore);
  return valore;
}

function campoHtml(c, id, valore) {
  if (c.type === "select") {
    return `<div class="field"><label>${c.label}</label><select id="${id}">
      ${c.opzioni.map((o) => `<option value="${o}" ${valore === o ? "selected" : ""}>${o.replace(/_/g, " ")}</option>`).join("")}
    </select></div>`;
  }
  if (TIPI_ENTITA.includes(c.type)) {
    return htmlCampoEntita(id, c.label, c.type);
  }
  const tipoInput =
    c.type === "number" ? "number" : c.type === "date" ? "date" : "text";
  return `<div class="field"><label>${c.label}</label><input type="${tipoInput}" id="${id}" value="${valore ?? ""}"></div>`;
}

export function montaListaConForm(contenitore, cfg) {
  contenitore.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca in " + cfg.titolo.toLowerCase() + "...")}
      <button class="btn-secondary btn-piccolo" data-azione="nuovo">${icona("aggiungi")}aggiungi</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${cfg.colonne.map((c) => `<th>${c.label}</th>`).join("")}<th class="th-azioni"></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  const tbody = contenitore.querySelector("tbody");
  let righeCorrenti = [];
  let query = "";

  function corrisponde(r) {
    if (!query) return true;
    return cfg.colonne.some((c) =>
      String(risolviValore(c, r[c.key]) ?? "")
        .replace(/<[^>]*>/g, "")
        .toLowerCase()
        .includes(query),
    );
  }

  function disegna() {
    const righe = righeCorrenti.filter(corrisponde);
    tbody.innerHTML =
      righe
        .map(
          (r) => `
      <tr>
        ${cfg.colonne.map((c) => `<td>${risolviValore(c, r[c.key])}</td>`).join("")}
        <td class="td-azioni">
          <button class="btn-icon" title="modifica" data-azione="modifica" data-id="${r.id}">${icona("modifica")}</button>
          <button class="btn-icon danger" title="elimina" data-azione="elimina" data-id="${r.id}">${icona("elimina")}</button>
        </td>
      </tr>
    `,
        )
        .join("") ||
      `<tr><td colspan="${cfg.colonne.length + 1}" style="text-align:center;color:#999;padding:20px;">${query ? "Nessun risultato per la ricerca" : "Nessun dato"}</td></tr>`;
  }

  async function ricarica() {
    righeCorrenti = await apiGet(cfg.apiPath);
    if (cfg.filtro) righeCorrenti = righeCorrenti.filter(cfg.filtro);
    disegna();
  }

  attivaCampoRicerca(contenitore, (q) => {
    query = q;
    disegna();
  });

  function apriForm(rigaEsistente) {
    const campiVisibili = cfg.colonne.filter(
      (c) =>
        !(rigaEsistente ? false : cfg.valoriFissi && c.key in cfg.valoriFissi),
    );
    const html = campiVisibili
      .map((c) =>
        campoHtml(c, "cd_" + c.key, rigaEsistente ? rigaEsistente[c.key] : ""),
      )
      .join("");

    apriModal(`
      <h2>${rigaEsistente ? "Modifica — " + cfg.titolo : cfg.titoloForm || "Nuovo — " + cfg.titolo}</h2>
      ${html}
      <div class="modal-actions">
        <button class="btn-secondary" id="cd_annulla">annulla</button>
        <button class="btn-primary" id="cd_salva">${rigaEsistente ? "salva modifiche" : "salva"}</button>
      </div>
    `);

    // i campi entità (squadra/corridore/tappa/sponsor) sono autocomplete di
    // ricerca: vanno attivati dopo l'inserimento nel DOM e letti tramite il
    // getter che restituiscono, non con .value come i campi normali
    const colTappa = campiVisibili.find((c) => c.type === "tappa");
    const colCorridore = campiVisibili.find((c) => c.type === "corridore");

    function esclusiPerTappa(tappaId) {
      // corridori già presenti in un'altra riga per la stessa tappa (es.
      // due volate/GPM sulla stessa tappa per lo stesso corridore) — si
      // attiva solo se la configurazione lo richiede esplicitamente
      if (!cfg.evitaDuplicatiTappaCorridore || !colTappa || !tappaId)
        return [];
      return righeCorrenti
        .filter(
          (r) =>
            r[colTappa.key] === tappaId &&
            (!rigaEsistente || r.id !== rigaEsistente.id),
        )
        .map((r) => r[colCorridore.key]);
    }
    function numeroTappaDa(tappaId) {
      return tappaId
        ? (cache.tappe.find((t) => t.id === tappaId)?.numero_tappa ?? null)
        : null;
    }

    const lettoriEntita = {};
    campiVisibili.forEach((c) => {
      if (!TIPI_ENTITA.includes(c.type)) return;
      let opzioni;
      if (c.type === "corridore" && colTappa) {
        const tappaIdIniziale = rigaEsistente
          ? rigaEsistente[colTappa.key]
          : null;
        opzioni = {
          tappaNumero: numeroTappaDa(tappaIdIniziale),
          escludiIds: esclusiPerTappa(tappaIdIniziale),
        };
      }
      lettoriEntita[c.key] = attivaCampoEntita(
        "cd_" + c.key,
        c.type,
        rigaEsistente ? rigaEsistente[c.key] : null,
        opzioni,
      );
    });

    // se il form ha sia una tappa che un corridore, cambiare la tappa deve
    // ricalcolare al volo sia l'esclusione dei ritirati (in base alla
    // nuova tappa) sia i doppioni già presenti per quella tappa
    if (colTappa && colCorridore) {
      const hiddenTappa = document.getElementById(
        "cd_" + colTappa.key + "_hidden",
      );
      hiddenTappa?.addEventListener("change", () => {
        const tappaId = +hiddenTappa.value || null;
        lettoriEntita[colCorridore.key].aggiornaFiltri({
          tappaNumero: numeroTappaDa(tappaId),
          escludiIds: esclusiPerTappa(tappaId),
        });
      });
    }

    document
      .getElementById("cd_annulla")
      .addEventListener("click", chiudiModal);
    document.getElementById("cd_salva").addEventListener("click", async () => {
      const body = { ...(cfg.valoriFissi || {}) };
      campiVisibili.forEach((c) => {
        if (TIPI_ENTITA.includes(c.type)) {
          body[c.key] = lettoriEntita[c.key]();
          return;
        }
        const el = document.getElementById("cd_" + c.key);
        const v = el.value;
        body[c.key] = c.type === "number" ? (v === "" ? null : +v) : v || null;
      });
      const res = rigaEsistente
        ? await apiPut(cfg.apiPath + "/" + rigaEsistente.id, body)
        : await apiPost(cfg.apiPath, body);
      if (res.ok) {
        chiudiModal();
        mostraToast(rigaEsistente ? "Modifiche salvate" : "Salvato");
        ricarica();
      } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
    });
  }

  contenitore.addEventListener("click", async (e) => {
    const btnNuovo = e.target.closest('[data-azione="nuovo"]');
    const btnModifica = e.target.closest('[data-azione="modifica"]');
    const btnElimina = e.target.closest('[data-azione="elimina"]');

    if (btnNuovo) apriForm(null);

    if (btnModifica) {
      const riga = righeCorrenti.find((r) => r.id === +btnModifica.dataset.id);
      if (riga) apriForm(riga);
    }

    if (btnElimina) {
      if (!confirm("Eliminare questa riga?")) return;
      const res = await apiDelete(cfg.apiPath + "/" + btnElimina.dataset.id);
      if (res.ok) {
        mostraToast("Eliminato");
        ricarica();
      } else {
        mostraToast(await erroreDaResponse(res, "Impossibile eliminare"));
      }
    }
  });

  if (cfg.eventoSocket) socket.on(cfg.eventoSocket, ricarica);
  ricarica();
  return ricarica;
}
