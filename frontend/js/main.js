import { socket } from "./socket.js";
import {
  cache,
  caricaNazioni,
  caricaTappe,
  caricaCorridori,
  caricaSquadre,
} from "./state.js";

import * as Tappe from "./components/tappe.js";
import * as Corridori from "./components/corridori.js";
import * as Squadre from "./components/squadre.js";
import * as Risultati from "./components/risultati.js";
import * as Classifiche from "./components/classifiche.js";
import * as Regolamento from "./components/regolamento.js";
import * as Stampa from "./components/stampa.js";
import * as Nazioni from "./components/nazioni.js";

const sezioni = {
  tappe: Tappe,
  corridori: Corridori,
  squadre: Squadre,
  risultati: Risultati,
  classifiche: Classifiche,
  regolamento: Regolamento,
  stampa: Stampa,
  nazioni: Nazioni,
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
caricaNazioni();
caricaTappe();
caricaCorridori();
caricaSquadre();
mostraSezione("tappe");
