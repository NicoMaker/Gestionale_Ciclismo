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
import * as Regolamento from "../components/regolamento/regolamento.js";
import * as Stampa from "../components/stampa/stampa.js";
import * as Nazioni from "../components/nazioni/nazioni.js";
import * as Cestino from "../components/cestino/cestino.js";

const sezioni = {
  dashboard: Dashboard,
  tappe: Tappe,
  corridori: Corridori,
  squadre: Squadre,
  risultati: Risultati,
  classifiche: Classifiche,
  regolamento: Regolamento,
  stampa: Stampa,
  nazioni: Nazioni,
  cestino: Cestino,
};

const inizializzate = new Set();

function mostraSezione(key) {
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === key));
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === "view-" + key));

  if (!inizializzate.has(key)) {
    const container = document.getElementById("view-" + key);
    if (sezioni[key]) {
      sezioni[key].init(container);
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
