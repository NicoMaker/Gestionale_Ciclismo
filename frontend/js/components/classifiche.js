import { apiGet } from "../api.js";
import {
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
} from "../utils.js";
import { socket } from "../socket.js";
import { montaListaConForm } from "./tabella-dati.js";
import { medaglia } from "../icone.js";

let sottoTabAttiva = "generale";
let queryCorrente = "";
let classificaCorrente = [];

async function renderGenerale(corpo) {
  sottoTabAttiva = "generale";
  corpo.innerHTML = `
    <div class="subtab-head">${htmlCampoRicerca("cerca corridore o squadra...")}</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Corridore</th><th>Squadra</th><th>Tappe</th><th>Punti totali</th></tr></thead>
        <tbody id="tabellaClassificaGenerale"></tbody>
      </table>
    </div>
  `;
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    disegnaGenerale();
  });
  await ricaricaGenerale();
}

function disegnaGenerale() {
  const tbody = document.getElementById("tabellaClassificaGenerale");
  if (!tbody) return;
  const filtrati = classificaCorrente.filter((r) => {
    if (!queryCorrente) return true;
    return `${r.nome} ${r.cognome} ${r.squadra_nome ?? ""}`
      .toLowerCase()
      .includes(queryCorrente);
  });
  tbody.innerHTML =
    filtrati
      .map((r, i) => {
        const pos = classificaCorrente.indexOf(r) + 1;
        const m = medaglia(pos);
        return `
    <tr class="${pos <= 3 ? "riga-podio" : ""}">
      <td>${m ? `<span class="medaglia-podio">${m}</span>` : pos}</td>
      <td><strong>${r.nome} ${r.cognome}</strong></td>
      <td>${r.squadra_nome ?? "—"}</td>
      <td>${r.tappe_disputate}</td>
      <td><span class="badge badge-punti">${r.punti_totali ?? 0}</span></td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">${queryCorrente ? "Nessun corridore trovato" : "Nessun dato disponibile"}</td></tr>`;
}

async function ricaricaGenerale() {
  classificaCorrente = await apiGet("/api/risultati/classifica-generale");
  disegnaGenerale();
}

function renderTipiClassifica(corpo) {
  sottoTabAttiva = "tipi";
  montaListaConForm(corpo, {
    titolo: "Tipo di classifica",
    apiPath: "/api/classifiche-tipo",
    colonne: [
      { key: "nome", label: "Nome", type: "text" },
      { key: "descrizione", label: "Descrizione", type: "text" },
    ],
  });
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "generale", label: "Classifica generale" },
      { key: "tipi", label: "Tipi di classifica" },
    ],
    (key, corpo) => {
      if (key === "generale") renderGenerale(corpo);
      else renderTipiClassifica(corpo);
    },
  );

  socket.on("risultati:aggiornati", () => {
    if (sottoTabAttiva === "generale") ricaricaGenerale();
  });
}
