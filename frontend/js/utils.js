// Utility condivise: modali, toast, ricerca, bandiere, sotto-schede.
// Nessuna dipendenza da altri moduli del progetto per evitare cicli di import.

/* ---------- MODAL ---------- */
export function apriModal(htmlInterno) {
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  if (!overlay || !box) return;
  box.innerHTML = htmlInterno;
  overlay.classList.add("active");
}

export function chiudiModal() {
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  if (!overlay || !box) return;
  overlay.classList.remove("active");
  box.innerHTML = "";
}

// Chiudi cliccando sullo sfondo
document.addEventListener("click", (e) => {
  const overlay = document.getElementById("modalOverlay");
  if (overlay && e.target === overlay) chiudiModal();
});

// Chiudi con ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") chiudiModal();
});

/* ---------- TOAST ---------- */
let toastTimer = null;
export function mostraToast(messaggio) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = messaggio;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- BANDIERA (emoji da codice ISO2) ---------- */
export function bandiera(codiceIso2) {
  const codice = (codiceIso2 || "").toString().trim().toUpperCase();
  if (codice.length !== 2 || !/^[A-Z]{2}$/.test(codice)) return "🏳️";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (codice.charCodeAt(0) - 65),
    base + (codice.charCodeAt(1) - 65),
  );
}

/* ---------- CAMPO DI RICERCA ---------- */
export function htmlCampoRicerca(placeholder) {
  return `
    <div class="search-box">
      <svg viewBox="0 0 24 24" class="icona" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5"/>
        <path d="M15.3 15.3 L20 20" stroke-linecap="round"/>
      </svg>
      <input type="text" class="search-input" placeholder="${placeholder}" autocomplete="off">
    </div>
  `;
}

export function attivaCampoRicerca(contenitore, onInput) {
  const input = contenitore.querySelector(".search-input");
  if (!input) return;
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      onInput(input.value.trim().toLowerCase());
    }, 120);
  });
}

/* ---------- SOTTO-SCHEDE ---------- */
export function creaSottoSchede(contenitore, schede, onCambio) {
  contenitore.innerHTML = `
    <div class="subtabs"></div>
    <div class="subtab-body"></div>
  `;
  const tabsBar = contenitore.querySelector(".subtabs");
  const corpo = contenitore.querySelector(".subtab-body");

  tabsBar.innerHTML = schede
    .map(
      (s, i) =>
        `<button class="subtab ${i === 0 ? "active" : ""}" data-key="${s.key}">${s.label}</button>`,
    )
    .join("");

  function attiva(key) {
    tabsBar
      .querySelectorAll(".subtab")
      .forEach((b) => b.classList.toggle("active", b.dataset.key === key));
    corpo.innerHTML = "";
    onCambio(key, corpo);
  }

  tabsBar.querySelectorAll(".subtab").forEach((btn) => {
    btn.addEventListener("click", () => attiva(btn.dataset.key));
  });

  attiva(schede[0].key);
}
