// Utility condivise da tutti i componenti: bandiere, notifiche, modale, ricerca.
import { icona } from "./icone.js";

/** Calcola l'emoji bandiera da un codice ISO2 — nessuna immagine esterna. */
export function bandiera(iso2) {
  if (!iso2) return "";
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const toastEl = document.getElementById("toast");
export function mostraToast(messaggio) {
  toastEl.textContent = messaggio;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2400);
}

const overlayEl = document.getElementById("modalOverlay");
const modalEl = document.getElementById("modalBox");

export function apriModal(html) {
  modalEl.innerHTML = html;
  overlayEl.classList.add("active");
}

export function chiudiModal() {
  overlayEl.classList.remove("active");
}

overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) chiudiModal();
});

/** Crea la barra di sotto-schede usata dentro le sezioni con più tabelle collegate. */
export function creaSottoSchede(container, schede, ontab) {
  const barra = document.createElement("div");
  barra.className = "subtabs";
  barra.innerHTML = schede
    .map(
      (s, i) => `
    <button class="subtab ${i === 0 ? "active" : ""}" data-key="${s.key}">${s.label}</button>
  `,
    )
    .join("");
  container.appendChild(barra);

  const corpo = document.createElement("div");
  corpo.className = "subtab-body";
  container.appendChild(corpo);

  barra.addEventListener("click", (e) => {
    const btn = e.target.closest(".subtab");
    if (!btn) return;
    barra
      .querySelectorAll(".subtab")
      .forEach((b) => b.classList.toggle("active", b === btn));
    ontab(btn.dataset.key, corpo);
  });

  ontab(schede[0].key, corpo);
  return corpo;
}

/**
 * Crea un campo di ricerca con icona, riusato in ogni tabella dell'app ("ricerca dappertutto").
 * @param {string} placeholder - testo placeholder
 * @param {(query: string) => void} onCerca - richiamata ad ogni digitazione
 * @returns {string} html del campo — da inserire nel markup, poi va attivato con attivaCampoRicerca
 */
export function htmlCampoRicerca(placeholder = "cerca...") {
  return `
    <div class="search-box">
      ${icona("cerca")}
      <input type="text" class="search-input" placeholder="${placeholder}" autocomplete="off">
    </div>
  `;
}

/** Collega l'input di un campo generato con htmlCampoRicerca al callback di filtro. */
export function attivaCampoRicerca(contenitore, onCerca) {
  const input = contenitore.querySelector(".search-input");
  if (!input) return;
  input.addEventListener("input", () =>
    onCerca(input.value.trim().toLowerCase()),
  );
}
