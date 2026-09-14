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
export function bandiera(codiceIso2, larghezzaPx = 20) {
  const codice = (codiceIso2 || "").toString().trim().toUpperCase();
  if (codice.length !== 2 || !/^[A-Z]{2}$/.test(codice)) return "";
  const altezzaPx = Math.round(larghezzaPx * 0.75);
  return `<img class="bandiera-img" src="https://flagcdn.com/${codice.toLowerCase()}.svg" width="${larghezzaPx}" height="${altezzaPx}" alt="${codice}" title="${codice}" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

/* ---------- DATE IN FORMATO ITALIANO ---------- */
// Converte una data ISO (aaaa-mm-gg, eventualmente con orario) nel
// formato italiano gg/mm/aaaa usato in tutta l'interfaccia.
export function formattaDataIt(dataIso) {
  if (!dataIso) return "—";
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return dataIso;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Anno di riferimento della corsa (per calcolare l'età sportiva dei
// corridori, coerente con la classifica giovani/maglia bianca lato
// backend): l'anno più recente tra le tappe in calendario, altrimenti
// l'anno corrente.
export function annoRiferimentoGara(tappe) {
  const anni = (tappe || [])
    .map((t) => (t.data ? new Date(t.data).getFullYear() : null))
    .filter((a) => a && !Number.isNaN(a));
  return anni.length ? Math.max(...anni) : new Date().getFullYear();
}

// Età in anni compiuti nell'anno di riferimento della corsa.
export function calcolaEta(dataNascitaIso, annoRiferimento) {
  if (!dataNascitaIso) return null;
  const anno = new Date(dataNascitaIso).getFullYear();
  if (Number.isNaN(anno)) return null;
  return (annoRiferimento || new Date().getFullYear()) - anno;
}

// Soglia della classifica giovani / maglia bianca (coerente col backend)
export const ETA_LIMITE_MAGLIA_BIANCA = 25;

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
  let corpo = contenitore.querySelector(".subtab-body");

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
    // Alcune sotto-schede (es. Penalità/Abbuoni in Regolamento, Arrivo/GPM
    // in Risultati) agganciano un addEventListener("click", ...) di
    // delega direttamente su "corpo" tramite montaListaConForm. Se
    // riusassimo sempre lo stesso nodo, quei listener si accumulerebbero
    // ad ogni cambio scheda (non vengono mai rimossi da innerHTML=""), e
    // al click su una riga scatterebbero ANCHE i gestori delle schede
    // visitate in precedenza, riaprendo il modale sbagliato (es.
    // "Modifica — Penalità" invece di "Modifica — Abbuoni"). Sostituire il
    // nodo con un clone vuoto ad ogni cambio elimina i vecchi listener
    // insieme al nodo a cui erano agganciati.
    const corpoNuovo = corpo.cloneNode(false);
    corpo.replaceWith(corpoNuovo);
    corpo = corpoNuovo;
    onCambio(key, corpo);
  }

  tabsBar.querySelectorAll(".subtab").forEach((btn) => {
    btn.addEventListener("click", () => attiva(btn.dataset.key));
  });

  attiva(schede[0].key);
}
