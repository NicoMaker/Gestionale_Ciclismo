// "Ritiri" prima esisteva come sotto-scheda duplicata sia dentro
// "Risultati" sia dentro "Classifiche" (stessa identica funzionalità:
// elenco dei corridori ritirati, nuovo ritiro, modifica dati del ritiro,
// riammissione in gara). Ora che ogni funzionalità ha una propria voce di
// navbar, tenerne due identiche non avrebbe senso: questa pagina unica
// sostituisce entrambe, mantenendo tutte le azioni disponibili prima.
import {
  apriModal,
  chiudiModal,
  mostraToast,
  htmlCampoRicerca,
  attivaCampoRicerca,
  bandiera,
} from "../../core/utils.js";
import { socket } from "../../core/socket.js";
import {
  cache,
  caricaCorridori,
  garantisciCorridori,
  garantisciTappe,
} from "../../core/state.js";
import {
  htmlCampoEntita,
  attivaCampoEntita,
} from "../entita-autocomplete/entita-autocomplete.js";
import { icona } from "../../core/icone.js";
import {
  apriFormRitiro,
  riammettiCorridore,
  badgeStato,
} from "../corridori/corridori.js";

let queryRitiri = "";

async function renderRitiri(corpo) {
  await garantisciCorridori();
  await garantisciTappe();
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca corridore, squadra o motivo...")}
      <button class="btn-secondary btn-piccolo" id="btnNuovoRitiro">${icona("aggiungi")}nuovo ritiro</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pett.</th><th>Corridore</th><th>Squadra</th><th>Ritirato dalla tappa</th><th>Motivo</th><th>Note</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaRitiri"></tbody>
      </table>
    </div>
  `;
  document
    .getElementById("btnNuovoRitiro")
    .addEventListener("click", apriNuovoRitiro);
  attivaCampoRicerca(corpo, (q) => {
    queryRitiri = q;
    disegnaRitiri();
  });
  disegnaRitiri();
}

function disegnaRitiri() {
  const tbody = document.getElementById("tabellaRitiri");
  if (!tbody) return;
  const ritirati = cache.corridori
    .filter((c) => c.ritirato)
    .filter((c) => {
      if (!queryRitiri) return true;
      return `${c.nome} ${c.cognome} ${c.squadra_nome ?? ""} ${c.note_ritiro ?? ""}`
        .toLowerCase()
        .includes(queryRitiri);
    })
    .sort(
      (a, b) =>
        (a.ritirato_tappa_numero ?? 0) - (b.ritirato_tappa_numero ?? 0) ||
        a.cognome.localeCompare(b.cognome),
    );

  tbody.innerHTML =
    ritirati
      .map(
        (c) => `
    <tr class="riga-ritirato">
      <td><span class="badge badge-pettorale">${c.numero_pettorale ?? "—"}</span></td>
      <td><strong>${c.nazione_codice ? bandiera(c.nazione_codice, 16) + " " : ""}${c.nome} ${c.cognome}</strong></td>
      <td>${c.squadra_nome ? `${c.squadra_nazione_codice ? bandiera(c.squadra_nazione_codice, 16) + " " : ""}${c.squadra_nome}` : "—"}</td>
      <td>${c.ritirato_tappa_numero ? `Tappa ${c.ritirato_tappa_numero}` : "—"}</td>
      <td>${badgeStato(c)}</td>
      <td>${c.note_ritiro ?? "—"}</td>
      <td class="td-azioni">
        <button class="btn-icon" title="modifica dati del ritiro" data-modifica-ritiro="${c.id}">${icona("modifica")}</button>
        <button class="btn-icon" title="riammetti in gara" data-riammetti="${c.id}">${icona("ripristina")}</button>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="7" class="stato-vuoto">${queryRitiri ? "Nessun ritiro trovato" : "Nessun corridore ritirato"}</td></tr>`;

  tbody.querySelectorAll("[data-modifica-ritiro]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = cache.corridori.find((c) => c.id === +b.dataset.modificaRitiro);
      if (c) apriFormRitiro(c, { alSalvataggio: aggiornaDopoRitiro });
    }),
  );
  tbody.querySelectorAll("[data-riammetti]").forEach((b) =>
    b.addEventListener("click", () =>
      riammettiCorridore(+b.dataset.riammetti, {
        alSalvataggio: aggiornaDopoRitiro,
      }),
    ),
  );
}

async function aggiornaDopoRitiro() {
  await caricaCorridori();
  disegnaRitiri();
}

// piccolo modale "ponte": si sceglie il corridore ancora in gara, poi si
// passa al modale di ritiro vero e proprio (già usato in Corridori) con
// motivo/tappa/note
function apriNuovoRitiro() {
  apriModal(`
    <h2>Nuovo ritiro</h2>
    <p style="color:var(--testo-soft);font-size:13.5px;margin:-6px 0 16px;">
      Scegli il corridore da segnare come ritirato. Al passo successivo
      potrai indicare tappa, motivo e note.
    </p>
    ${htmlCampoEntita("nr_corridore", "Corridore", "corridore")}
    <div class="modal-actions">
      <button class="btn-secondary" id="nr_annulla">annulla</button>
      <button class="btn-primary" id="nr_avanti">avanti</button>
    </div>
  `);
  // i corridori già ritirati non hanno senso qui: per loro c'è "riammetti"
  const idGiaRitirati = cache.corridori
    .filter((c) => c.ritirato)
    .map((c) => c.id);
  const leggiCorridoreId = attivaCampoEntita(
    "nr_corridore",
    "corridore",
    null,
    { escludiIds: idGiaRitirati },
  );
  document.getElementById("nr_annulla").addEventListener("click", chiudiModal);
  document.getElementById("nr_avanti").addEventListener("click", () => {
    const corridoreId = leggiCorridoreId();
    if (!corridoreId) {
      mostraToast("Seleziona un corridore");
      return;
    }
    const c = cache.corridori.find((c) => c.id === corridoreId);
    if (!c) return;
    apriFormRitiro(c, { alSalvataggio: aggiornaDopoRitiro });
  });
}

export function init(container) {
  renderRitiri(container);

  socket.on("corridori:aggiornati", async () => {
    await caricaCorridori();
    disegnaRitiri();
  });
}
