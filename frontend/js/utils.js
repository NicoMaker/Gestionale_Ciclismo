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

/* ---------- BANDIERA (immagine SVG da codice ISO2) ----------
   Le bandiere-emoji Unicode (es. 🇮🇹) dipendono dai font del sistema
   operativo: su Windows, molte distribuzioni Linux e browser meno recenti
   non vengono renderizzate affatto (restano invisibili o mostrano solo le
   due lettere). Per essere visibili SEMPRE, indipendentemente dal
   dispositivo, usiamo delle vere immagini SVG (via flagcdn.com). */
export function htmlNomeSquadra(nome, codiceIso2, colore) {
  if (!nome) return "—";
  const flag = codiceIso2 ? `${bandiera(codiceIso2, 16)} ` : "";
  const dot = colore
    ? `<span class="dot-colore" style="background:${colore}"></span>`
    : "";
  return `${dot}${flag}${nome}`;
}

export function bandiera(codiceIso2, larghezzaPx = 20) {
  const codice = (codiceIso2 || "").toString().trim().toUpperCase();
  if (codice.length !== 2 || !/^[A-Z]{2}$/.test(codice)) return "";
  const altezzaPx = Math.round(larghezzaPx * 0.75);
  return `<img class="bandiera-img" src="https://flagcdn.com/${codice.toLowerCase()}.svg" width="${larghezzaPx}" height="${altezzaPx}" alt="${codice}" title="${codice}" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

/* ---------- ERRORI API ---------- */
// Estrae il messaggio di errore da una Response non-ok (o testo generico)
export async function erroreDaResponse(
  res,
  generico = "Si è verificato un errore",
) {
  try {
    const corpo = await res.json();
    return corpo?.errore || generico;
  } catch {
    return generico;
  }
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
  const input = contenitore.querySelector(".search-box .search-input");
  if (!input) return;
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      onInput(input.value.trim().toLowerCase());
    }, 120);
  });
}

/* ---------- SELECT TAPPA/SQUADRA CON RICERCA ---------- */
export function htmlSelectConRicerca({
  id,
  opzioni,
  tutteLabel,
  placeholderRicerca,
  classeSelect,
  valore,
}) {
  const tutte = tutteLabel ? `<option value="">${tutteLabel}</option>` : "";
  const opts = (opzioni || [])
    .map((o) => {
      const cerca = String(o.cerca || o.label)
        .toLowerCase()
        .replace(/"/g, "");
      const sel = String(valore) === String(o.value) ? "selected" : "";
      return `<option value="${o.value}" data-cerca="${cerca}" ${sel}>${o.label}</option>`;
    })
    .join("");
  return `
    <div class="select-filtrato">
      <input type="search" class="filtro-select-cerca" data-filtra-select="${id}" placeholder="${placeholderRicerca}" autocomplete="off">
      <select id="${id}" class="${classeSelect || "select-tappa"}">
        ${tutte}${opts}
      </select>
    </div>
  `;
}

export function attivaSelectConRicerca(contenitore) {
  contenitore.querySelectorAll("[data-filtra-select]").forEach((input) => {
    const sel = document.getElementById(input.dataset.filtraSelect);
    if (!sel) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      for (const opt of sel.options) {
        if (!opt.value) {
          opt.hidden = false;
          continue;
        }
        const testo = (opt.dataset.cerca || opt.textContent).toLowerCase();
        opt.hidden = Boolean(q) && !testo.includes(q);
      }
    });
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
