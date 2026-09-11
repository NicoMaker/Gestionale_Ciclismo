import { bandiera } from "../utils.js";
import { cache } from "../state.js";

function codicePulito(iso2) {
  return (iso2 || "").toString().trim().toUpperCase();
}

export function htmlCampoNazione(idPrefix, label) {
  return `
    <div class="field autocomplete-wrap" id="${idPrefix}_wrap">
      <label>${label}</label>
      <input type="text" class="autocomplete-input" id="${idPrefix}_input" placeholder="cerca una nazione..." autocomplete="off">
      <input type="hidden" class="autocomplete-hidden" id="${idPrefix}_hidden">
      <div class="autocomplete-list" id="${idPrefix}_list"></div>
    </div>
  `;
}

export function attivaCampoNazione(idPrefix, valoreIniziale) {
  const wrapEl = document.getElementById(idPrefix + "_wrap");
  if (!wrapEl) return () => null;

  const input = wrapEl.querySelector(".autocomplete-input");
  const hidden = wrapEl.querySelector(".autocomplete-hidden");
  const lista = wrapEl.querySelector(".autocomplete-list");

  if (valoreIniziale) {
    const n = cache.nazioni.find((n) => n.id === valoreIniziale);
    if (n) {
      input.value = `${bandiera(n.codice_iso2)} ${n.nome}`.trim();
      hidden.value = n.id;
    }
  }

  function renderRisultati(query) {
    const q = query.trim().toLowerCase();
    const risultati = q
      ? cache.nazioni
          .filter(
            (n) =>
              n.nome.toLowerCase().includes(q) ||
              codicePulito(n.codice_iso2).toLowerCase().includes(q),
          )
          .slice(0, 12)
      : cache.nazioni.slice(0, 12);

    lista.innerHTML = risultati.length
      ? risultati
          .map(
            (n) => `
          <div class="autocomplete-item" data-id="${n.id}" data-testo="${bandiera(n.codice_iso2)} ${n.nome}">
            <span class="bandiera">${bandiera(n.codice_iso2)}</span> ${n.nome}
          </div>
        `,
          )
          .join("")
      : '<div class="autocomplete-empty">Nessuna nazione trovata</div>';
    lista.classList.add("open");
  }

  input.addEventListener("focus", () => renderRisultati(""));
  input.addEventListener("input", () => {
    hidden.value = "";
    renderRisultati(input.value);
  });
  input.addEventListener("blur", () =>
    setTimeout(() => lista.classList.remove("open"), 150),
  );
  lista.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    input.value = item.dataset.testo;
    hidden.value = item.dataset.id;
    lista.classList.remove("open");
  });

  return () => +hidden.value || null;
}