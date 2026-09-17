import { socket } from "./socket.js";
import { mostraToast } from "./utils.js";
import {
  cache,
  caricaNazioni,
  caricaTappe,
  caricaCorridori,
  caricaSquadre,
} from "./state.js";

import * as Dashboard from "../components/dashboard/dashboard.js";
import * as Tappe from "../components/tappe/tappe.js";
import * as Corridori from "../components/corridori/corridori.js";
import * as Squadre from "../components/squadre/squadre.js";
import * as Risultati from "../components/risultati/risultati.js";
import * as Classifiche from "../components/classifiche/classifiche.js";
import * as Ritiri from "../components/ritiri/ritiri.js";
import * as Regolamento from "../components/regolamento/regolamento.js";
import * as Stampa from "../components/stampa/stampa.js";
import * as Nazioni from "../components/nazioni/nazioni.js";
import * as Cestino from "../components/cestino/cestino.js";

// Ogni voce di navbar corrisponde ormai a UNA sola funzionalità: ognuna ha
// il proprio init dedicato nel modulo del componente (prima erano tutte
// raggruppate come sotto-schede di poche sezioni). La chiave qui sotto è
// lo stesso "data-view" usato in index.html e lo stesso id "view-<key>"
// della sezione di contenuto corrispondente.
const sezioni = {
  dashboard: Dashboard.init,

  "tappe-elenco": Tappe.initElenco,
  "tappe-percorso": Tappe.initPercorso,
  "tappe-meteo": Tappe.initMeteo,

  "corridori-elenco": Corridori.initElenco,
  "corridori-biciclette": Corridori.initBiciclette,

  "squadre-elenco": Squadre.initElenco,
  "squadre-staff": Squadre.initStaff,
  "squadre-veicoli": Squadre.initVeicoli,
  "squadre-sponsor": Squadre.initSponsor,
  "squadre-alloggi": Squadre.initAlloggi,

  "risultati-arrivo": Risultati.initArrivo,
  "risultati-traguardi": Risultati.initTraguardi,
  "risultati-gpm": Risultati.initGpm,

  "classifiche-tempo": Classifiche.initTempo,
  "classifiche-punti": Classifiche.initPunti,
  "classifiche-giovani": Classifiche.initGiovani,
  "classifiche-montagna": Classifiche.initMontagna,
  "classifiche-squadre": Classifiche.initSquadre,
  "classifiche-tipi": Classifiche.initTipi,

  ritiri: Ritiri.init,

  "regolamento-penalita": Regolamento.initPenalita,
  "regolamento-antidoping": Regolamento.initAntidoping,
  "regolamento-abbuoni": Regolamento.initAbbuoni,

  "stampa-media": Stampa.initMedia,
  "stampa-comunicati": Stampa.initComunicati,
  nazioni: Nazioni.init,
  cestino: Cestino.init,
};

const inizializzate = new Set();

function mostraSezione(key) {
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === key));
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === "view-" + key));

  // topbar sempre visibile in cima al contenuto (sticky): mostra il titolo
  // e l'icona della sezione corrente, così anche scorrendo la pagina resta
  // chiaro in quale scheda ci si trova
  const bottone = document.querySelector(`.nav-item[data-view="${key}"]`);
  const titoloBar = document.getElementById("topbarTitle");
  const iconaBar = document.getElementById("topbarIcon");
  if (bottone && titoloBar && iconaBar) {
    titoloBar.textContent = bottone.querySelector("span")?.textContent ?? "";
    const svg = bottone.querySelector("svg");
    iconaBar.innerHTML = svg ? svg.outerHTML : "";
  }

  if (!inizializzate.has(key)) {
    const container = document.getElementById("view-" + key);
    const init = sezioni[key];
    if (container && init) {
      init(container);
      inizializzate.add(key);
    }
  }
}

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => mostraSezione(btn.dataset.view));
});

// ---------- Stato live ----------
socket.on("stato-live:aggiornato", (stato) => {
  const dot = document.getElementById("liveDot");
  const label = document.getElementById("liveLabel");
  const spettatori = document.getElementById("liveSpettatori");
  if (!dot || !label || !spettatori) return;
  if (stato.tappaInCorsoId) {
    dot.classList.add("on");
    const t = cache.tappe.find((t) => t.id === stato.tappaInCorsoId);
    label.textContent = t ? `LIVE — Tappa ${t.numero_tappa}` : "LIVE";
  } else {
    dot.classList.remove("on");
    label.textContent = "nessuna diretta";
  }
  spettatori.textContent = `${stato.spettatoriConnessi} connessi`;
});

// ---------- Avvio ----------
Promise.all([
  caricaNazioni(),
  caricaTappe(),
  caricaCorridori(),
  caricaSquadre(),
]).catch((err) => {
  console.error("Avvio: impossibile caricare i dati iniziali —", err);
  mostraToast(
    err?.message ||
      "Impossibile contattare il server. Avvia il backend con 'npm start' sulla porta 3000.",
  );
});
mostraSezione("dashboard");
