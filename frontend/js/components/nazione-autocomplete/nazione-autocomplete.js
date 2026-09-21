import { bandiera } from "../../core/utils.js";
import { cache } from "../../core/state.js";

function codicePulito(iso2) {
  return (iso2 || "").toString().trim().toUpperCase();
}

export function htmlCampoNazione(idPrefix, label) {
  return `
    <div class="field autocomplete-wrap" id="${idPrefix}_wrap">
      <label>${label}</label>
      <div class="autocomplete-input-row">
        <span class="autocomplete-flag" id="${idPrefix}_flag"></span>
        <input type="text" class="autocomplete-input" id="${idPrefix}_input" placeholder="cerca una nazione..." autocomplete="off">
      </div>
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
  const flagEl = wrapEl.querySelector(".autocomplete-flag");

  // mostra accanto al campo la bandiera esatta della nazione selezionata
  // (non solo un'anteprima temporanea nel menu a tendina)
  function mostraBandiera(nazione) {
    if (nazione && nazione.codice_iso2) {
      flagEl.innerHTML = bandiera(nazione.codice_iso2, 20);
      input.classList.add("autocomplete-input--con-bandiera");
    } else {
      flagEl.innerHTML = "";
      input.classList.remove("autocomplete-input--con-bandiera");
    }
  }

  if (valoreIniziale) {
    const n = cache.nazioni.find((n) => n.id === valoreIniziale);
    if (n) {
      input.value = n.nome;
      hidden.value = n.id;
      mostraBandiera(n);
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
          <div class="autocomplete-item" data-id="${n.id}" data-testo="${n.nome}">
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
    mostraBandiera(null);
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
    mostraBandiera(cache.nazioni.find((n) => n.id === +item.dataset.id));
    lista.classList.remove("open");
  });

  return () => +hidden.value || null;
}
