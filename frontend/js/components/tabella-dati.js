import { apiGet, apiPost, apiPut, apiDelete } from "../api.js";
import {
  mostraToast,
  apriModal,
  chiudiModal,
  htmlCampoRicerca,
  attivaCampoRicerca,
  htmlSelectConRicerca,
  attivaSelectConRicerca,
  bandiera,
  htmlNomeSquadra,
  erroreDaResponse,
} from "../utils.js";
import { cache, garantisciTappe, garantisciSquadre, garantisciCorridori } from "../state.js";
import { socket } from "../socket.js";
import { icona, iconaValore } from "../icone.js";

function opzioniPer(tipo) {
  if (tipo === "squadra")
    return cache.squadre.map((s) => ({ value: s.id, label: s.nome }));
  if (tipo === "corridore")
    return cache.corridori.map((c) => ({
      value: c.id,
      label: `${c.nome} ${c.cognome}`,
    }));
  if (tipo === "tappa")
    return cache.tappe.map((t) => ({
      value: t.id,
      label: `Tappa ${t.numero_tappa} — ${t.nome}`,
    }));
  if (tipo === "sponsor")
    return cache.sponsor.map((s) => ({ value: s.id, label: s.nome }));
  return [];
}

export function opzioniSelectTappe() {
  return cache.tappe.map((t) => ({
    value: t.id,
    label: `Tappa ${t.numero_tappa} — ${t.nome}`,
    cerca: `${t.numero_tappa} ${t.nome} ${t.partenza} ${t.arrivo} ${t.tipo} ${t.stato ?? ""}`,
  }));
}

export function opzioniSelectSquadre() {
  return cache.squadre.map((s) => ({
    value: s.id,
    label: s.nome,
    cerca: `${s.nome} ${s.nazione_nome ?? ""}`,
  }));
}

function risolviValore(colonna, valore) {
  if (valore === null || valore === undefined || valore === "") return "—";
  if (colonna.type === "squadra") {
    const s = cache.squadre.find((s) => s.id === valore);
    if (!s) return valore;
    return htmlNomeSquadra(s.nome, s.nazione_codice, s.colore);
  }
  if (colonna.type === "corridore") {
    const c = cache.corridori.find((c) => c.id === valore);
    if (!c) return valore;
    return `${c.nazione_codice ? bandiera(c.nazione_codice, 16) + " " : ""}${c.nome} ${c.cognome}`;
  }
  if (colonna.type === "tappa") {
    const t = cache.tappe.find((t) => t.id === valore);
    return t ? `Tappa ${t.numero_tappa} — ${t.nome}` : valore;
  }
  if (colonna.type === "sponsor")
    return cache.sponsor.find((s) => s.id === valore)?.nome ?? valore;
  if (colonna.type === "select") {
    return `<span class="badge badge-${valore}">${iconaValore(valore)}${String(valore).replace(/_/g, " ")}</span>`;
  }
  return valore;
}

function testoRicercaColonna(colonna, valore) {
  const visibile = String(risolviValore(colonna, valore) ?? "").replace(
    /<[^>]*>/g,
    "",
  );
  if (colonna.type === "tappa") {
    const t = cache.tappe.find((t) => t.id === valore);
    if (t)
      return `${visibile} ${t.partenza} ${t.arrivo} ${t.tipo} ${t.numero_tappa}`;
  }
  if (colonna.type === "squadra") {
    const s = cache.squadre.find((s) => s.id === valore);
    if (s) return `${visibile} ${s.nazione_nome ?? ""}`;
  }
  if (colonna.type === "corridore") {
    const c = cache.corridori.find((c) => c.id === valore);
    if (c)
      return `${visibile} ${c.numero_pettorale ?? ""} ${c.squadra_nome ?? ""} ${c.nazione_nome ?? ""}`;
  }
  return visibile;
}

function campoHtml(c, id, valore) {
  if (c.type === "select") {
    return `<div class="field"><label>${c.label}</label><select id="${id}">
      ${c.opzioni.map((o) => `<option value="${o}" ${valore === o ? "selected" : ""}>${o.replace(/_/g, " ")}</option>`).join("")}
    </select></div>`;
  }
  if (["squadra", "corridore", "tappa", "sponsor"].includes(c.type)) {
    const opz = opzioniPer(c.type);
    return `<div class="field"><label>${c.label}</label><select id="${id}">
      <option value="">— seleziona —</option>
      ${opz.map((o) => `<option value="${o.value}" ${valore == o.value ? "selected" : ""}>${o.label}</option>`).join("")}
    </select></div>`;
  }
  const tipoInput =
    c.type === "number" ? "number" : c.type === "date" ? "date" : "text";
  return `<div class="field"><label>${c.label}</label><input type="${tipoInput}" id="${id}" value="${valore ?? ""}"></div>`;
}

function normalizzaFiltri(cfg) {
  if (Array.isArray(cfg.filtriSelect)) return cfg.filtriSelect;
  if (cfg.filtroSelect) return [cfg.filtroSelect];
  return [];
}

export function montaListaConForm(contenitore, cfg) {
  const filtri = normalizzaFiltri(cfg);
  const idBase = "filtro_" + String(cfg.apiPath).replace(/\W/g, "_");

  Promise.all([garantisciTappe(), garantisciSquadre(), garantisciCorridori()]).then(
    () => avvia(),
  );

  function htmlFiltri() {
    return filtri
      .map((f) => {
        const opzioni =
          f.tipo === "squadra" ? opzioniSelectSquadre() : opzioniSelectTappe();
        return htmlSelectConRicerca({
          id: idBase + "_" + f.key,
          opzioni,
          tutteLabel: f.tutte || (f.tipo === "squadra" ? "tutte le squadre" : "tutte le tappe"),
          placeholderRicerca:
            f.tipo === "squadra" ? "cerca squadra..." : "cerca tappa...",
        });
      })
      .join("");
  }

  function avvia() {
    contenitore.innerHTML = `
    <div class="subtab-head">
      ${htmlFiltri()}
      ${htmlCampoRicerca(cfg.placeholderRicerca || "cerca in " + cfg.titolo.toLowerCase() + "...")}
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

    function idFiltro(f) {
      const sel = document.getElementById(idBase + "_" + f.key);
      if (!sel || !sel.value) return null;
      return +sel.value;
    }

    function valoriFissiFiltri() {
      const fissi = { ...(cfg.valoriFissi || {}) };
      for (const f of filtri) {
        const id = idFiltro(f);
        if (id) fissi[f.key] = id;
      }
      return fissi;
    }

    function corrisponde(r) {
      for (const f of filtri) {
        const id = idFiltro(f);
        if (id && r[f.key] != id) return false;
      }
      if (!query) return true;
      return cfg.colonne.some((c) =>
        testoRicercaColonna(c, r[c.key]).toLowerCase().includes(query),
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
    attivaSelectConRicerca(contenitore);
    filtri.forEach((f) => {
      const sel = document.getElementById(idBase + "_" + f.key);
      if (sel) sel.addEventListener("change", disegna);
    });

    function apriForm(rigaEsistente) {
      const fissi = valoriFissiFiltri();
      const campiVisibili = cfg.colonne.filter(
        (c) => !(rigaEsistente ? false : c.key in fissi),
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
      document.getElementById("cd_annulla").addEventListener("click", chiudiModal);
      document.getElementById("cd_salva").addEventListener("click", async () => {
        const body = { ...fissi };
        campiVisibili.forEach((c) => {
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
        } else {
          mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
        }
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
  }
}
