import { apiGet } from "../../core/api.js";
import {
  cache,
  caricaTappe,
  caricaCorridori,
  caricaSquadre,
  caricaNazioni,
  garantisciSponsor,
} from "../../core/state.js";
import { socket } from "../../core/socket.js";
import { icona, iconaValore } from "../../core/icone.js";
import { formattaDataIt, bandiera } from "../../core/utils.js";

let container = null;
let controlliCache = [];

function prossimaTappa() {
  return cache.tappe
    .filter((t) => t.stato === "programmata")
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))[0];
}

function tappaInCorso() {
  return cache.tappe.find((t) => t.stato === "in_corso");
}

function render() {
  if (!container) return;

  const totaleTappe = cache.tappe.length;
  const tappeConcluse = cache.tappe.filter(
    (t) => t.stato === "conclusa",
  ).length;
  const inCorso = tappaInCorso();
  const prossima = prossimaTappa();

  const totaleCorridori = cache.corridori.length;
  const ritirati = cache.corridori.filter((c) => c.ritirato).length;
  const inGara = totaleCorridori - ritirati;

  const totaleSquadre = cache.squadre.length;
  const totaleNazioni = cache.nazioni.length;
  const totaleSponsor = cache.sponsor.length;

  const controlliPositivi = controlliCache.filter(
    (c) => c.esito === "positivo",
  ).length;
  const controlliAttesa = controlliCache.filter(
    (c) => c.esito === "in_attesa",
  ).length;

  container.innerHTML = `
    <div class="view-head">
      <h1>${icona("diretta", "view-icon")}Dashboard</h1>
      <p>Colpo d'occhio sulla corsa: tappe, corridori, squadre e controlli antidoping in tempo reale.</p>
    </div>

    ${
      inCorso
        ? `<div class="banner-maglia" style="margin-bottom:20px;">
            <span class="maglia-dot"></span>
            <div>
              <strong>Tappa ${inCorso.numero_tappa} in corso — ${inCorso.partenza} → ${inCorso.arrivo}</strong>
              <span class="maglia-label">diretta live · ${formattaDataIt(inCorso.data)}</span>
            </div>
          </div>`
        : ""
    }

    <div class="griglia-statistiche">
      <div class="statistica">
        <div class="numero">${totaleTappe}</div>
        <div class="etichetta">tappe totali</div>
      </div>
      <div class="statistica">
        <div class="numero">${tappeConcluse}</div>
        <div class="etichetta">tappe concluse</div>
      </div>
      <div class="statistica">
        <div class="numero">${inGara}</div>
        <div class="etichetta">corridori in gara</div>
      </div>
      <div class="statistica">
        <div class="numero">${ritirati}</div>
        <div class="etichetta">corridori ritirati</div>
      </div>
      <div class="statistica">
        <div class="numero">${totaleSquadre}</div>
        <div class="etichetta">squadre</div>
      </div>
      <div class="statistica">
        <div class="numero">${totaleNazioni}</div>
        <div class="etichetta">nazioni</div>
      </div>
      <div class="statistica">
        <div class="numero">${totaleSponsor}</div>
        <div class="etichetta">sponsor</div>
      </div>
      <div class="statistica">
        <div class="numero">${controlliPositivi}</div>
        <div class="etichetta">controlli positivi</div>
      </div>
    </div>

    <div class="griglia-card" style="margin-top:6px;">
      <div class="card" id="dashProssimaTappa"></div>
      <div class="card" id="dashSquadre"></div>
    </div>
  `;

  const boxProssima = document.getElementById("dashProssimaTappa");
  if (prossima) {
    boxProssima.innerHTML = `
      <h3 style="margin-bottom:10px;">Prossima tappa</h3>
      <p class="testo-soft" style="margin-bottom:12px;">
        Tappa ${prossima.numero_tappa} — ${prossima.partenza} → ${prossima.arrivo}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="badge badge-${prossima.stato}">${iconaValore(prossima.stato)}${prossima.stato.replace("_", " ")}</span>
        <span class="badge badge-numero">${formattaDataIt(prossima.data)}</span>
        ${prossima.tipo ? `<span class="badge badge-${prossima.tipo}">${iconaValore(prossima.tipo)}${prossima.tipo}</span>` : ""}
      </div>
    `;
  } else {
    boxProssima.innerHTML = `
      <h3 style="margin-bottom:10px;">Prossima tappa</h3>
      <p class="testo-soft">Nessuna tappa in programma al momento.</p>
    `;
  }

  const boxSquadre = document.getElementById("dashSquadre");
  const topSquadre = [...cache.squadre]
    .sort((a, b) => (b.numero_corridori ?? 0) - (a.numero_corridori ?? 0))
    .slice(0, 5);
  boxSquadre.innerHTML = `
    <h3 style="margin-bottom:10px;">Squadre più numerose</h3>
    ${
      topSquadre.length
        ? topSquadre
            .map(
              (s) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bordo,#eee);">
        <span><span class="dot-colore" style="background:${s.colore || "#e6197f"}"></span>${s.nome}${s.nazione_codice ? ` ${bandiera(s.nazione_codice, 15)}` : ""}</span>
        <span class="testo-soft">${s.numero_corridori ?? 0} corridori</span>
      </div>`,
            )
            .join("")
        : `<p class="testo-soft">Nessuna squadra inserita.</p>`
    }
    ${controlliAttesa ? `<p class="testo-soft" style="margin-top:12px;">${controlliAttesa} controllo/i antidoping in attesa di esito.</p>` : ""}
  `;
}

async function ricaricaControlli() {
  try {
    controlliCache = await apiGet("/api/controlli-antidoping");
  } catch {
    controlliCache = [];
  }
  render();
}

export function init(cont) {
  container = cont;
  render();

  Promise.all([
    caricaTappe(),
    caricaCorridori(),
    caricaSquadre(),
    caricaNazioni(),
    garantisciSponsor(),
  ])
    .then(render)
    .catch(() => {});
  ricaricaControlli();

  socket.on("tappe:aggiornate", render);
  socket.on("corridori:aggiornati", render);
  socket.on("squadre:aggiornate", render);
  socket.on("nazioni:aggiornate", render);
  socket.on("controlli-antidoping:aggiornati", ricaricaControlli);
}
