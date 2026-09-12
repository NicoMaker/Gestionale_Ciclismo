import { apiGet, apiPost, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  htmlCampoRicerca,
  attivaCampoRicerca,
  htmlSelectConRicerca,
  attivaSelectConRicerca,
  bandiera,
  htmlNomeSquadra,
  erroreDaResponse,
} from "../utils.js";
import { cache, garantisciTappe, garantisciCorridori } from "../state.js";
import { socket } from "../socket.js";
import { icona } from "../icone.js";
import { opzioniSelectTappe } from "./tabella-dati.js";

function etichettaMotivo(motivo) {
  if (motivo === "infortunio") return "infortunio in tappa";
  if (motivo === "non_partecipa") return "non parteciperà dalla tappa dopo";
  return motivo;
}

export function montaGestioneRitiri(contenitore) {
  Promise.all([garantisciTappe(), garantisciCorridori()]).then(avvia);

  function avvia() {
    let tappaId = cache.tappe[0]?.id ?? null;
    let query = "";
    let ritiri = [];
    let esclusi = [];

    contenitore.innerHTML = `
      <div class="subtab-head">
        ${htmlSelectConRicerca({
          id: "selRitiriTappa",
          opzioni: opzioniSelectTappe(),
          tutteLabel: "tutte le tappe",
          placeholderRicerca: "cerca tappa...",
          valore: tappaId,
        })}
        ${htmlCampoRicerca("cerca corridore, squadra o motivo...")}
        <button class="btn-secondary btn-piccolo" id="btnAggiungiRitiro">${icona("aggiungi")}inserisci ritiro</button>
      </div>
      <p class="hint-ritiri">Scegli la tappa, poi inserisci chi si è infortunato in quella frazione o chi non partirà più dalla successiva. Il ritiro vale per quella tappa: da lì in poi il corridore non compare nelle classifiche e non può più gareggiare.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tappa</th><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Motivo</th><th class="th-azioni"></th></tr></thead>
          <tbody id="tabellaRitiriTutti"></tbody>
        </table>
      </div>
    `;

    const sel = document.getElementById("selRitiriTappa");
    if (tappaId) sel.value = tappaId;
    sel.addEventListener("change", () => {
      tappaId = sel.value ? +sel.value : null;
      ricarica();
    });
    attivaSelectConRicerca(contenitore);
    attivaCampoRicerca(contenitore, (q) => {
      query = q;
      disegna();
    });
    document
      .getElementById("btnAggiungiRitiro")
      .addEventListener("click", () => apriForm());

    async function ricarica() {
      ritiri = await apiGet("/api/ritiri");
      esclusi = tappaId
        ? await apiGet("/api/ritiri/esclusi/" + tappaId)
        : ritiri.map((r) => ({ corridore_id: r.corridore_id }));
      disegna();
    }

    function disegna() {
      const tbody = document.getElementById("tabellaRitiriTutti");
      if (!tbody) return;
      const filtrati = ritiri.filter((r) => {
        if (tappaId && r.tappa_id !== tappaId) return false;
        if (!query) return true;
        return `${r.numero_tappa} ${r.tappa_nome} ${r.nome} ${r.cognome} ${r.squadra_nome ?? ""} ${etichettaMotivo(r.motivo)}`
          .toLowerCase()
          .includes(query);
      });
      tbody.innerHTML =
        filtrati
          .map(
            (r) => `
        <tr>
          <td>Tappa ${r.numero_tappa} — ${r.tappa_nome}</td>
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
        `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">${query ? "Nessun ritiro trovato" : tappaId ? "Nessun ritiro per questa tappa" : "Nessun ritiro inserito"}</td></tr>`;

      tbody.querySelectorAll("[data-elimina-ritiro]").forEach((b) =>
        b.addEventListener("click", async () => {
          if (
            !confirm(
              "Eliminare questo ritiro? Il corridore tornerà in classifica.",
            )
          )
            return;
          const res = await apiDelete("/api/ritiri/" + b.dataset.eliminaRitiro);
          if (res.ok) mostraToast("Ritiro eliminato");
          else
            mostraToast(await erroreDaResponse(res, "Impossibile eliminare"));
        }),
      );
    }

    function apriForm() {
      const tappaForm = tappaId || cache.tappe[0]?.id;
      if (!tappaForm) {
        mostraToast("Inserisci prima almeno una tappa");
        return;
      }
      const gia = new Set(
        ritiri
          .filter((r) => !tappaId || r.tappa_id === tappaId)
          .map((r) => r.corridore_id),
      );
      const fuori = new Set(esclusi.map((e) => e.corridore_id));
      const elenco = cache.corridori.filter(
        (c) => !gia.has(c.id) && !fuori.has(c.id),
      );
      if (!elenco.length) {
        mostraToast("Non ci sono corridori da ritirare per questa tappa");
        return;
      }
      apriModal(`
        <h2>Ritiro di tappa</h2>
        ${
          tappaId
            ? ""
            : `<div class="field"><label>Tappa</label>
          <select id="rit_tappa">
            ${cache.tappe.map((t) => `<option value="${t.id}">Tappa ${t.numero_tappa} — ${t.nome}</option>`).join("")}
          </select></div>`
        }
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
        <div class="modal-actions">
          <button class="btn-secondary" id="rit_annulla">annulla</button>
          <button class="btn-primary" id="rit_salva">salva ritiro</button>
        </div>
      `);
      document.getElementById("rit_annulla").addEventListener("click", chiudiModal);
      document.getElementById("rit_salva").addEventListener("click", async () => {
        const body = {
          tappa_id: tappaId || +document.getElementById("rit_tappa").value,
          corridore_id: +document.getElementById("rit_corridore").value,
          motivo: document.getElementById("rit_motivo").value,
        };
        const res = await apiPost("/api/ritiri", body);
        if (res.ok) {
          chiudiModal();
          mostraToast("Ritiro registrato per la tappa");
        } else
          mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
      });
    }

    socket.on("ritiri:aggiornati", ricarica);
    ricarica();
  }
}
