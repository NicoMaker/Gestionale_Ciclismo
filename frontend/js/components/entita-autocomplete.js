// Campo di ricerca con autocompletamento generico, riusabile per qualunque
// selezione di entità (squadra, corridore, tappa, sponsor) al posto delle
// lunghissime <select> semplici, difficili da usare con molte righe.
import { bandiera } from "../utils.js";
import { cache } from "../state.js";

function elencoPer(tipo) {
  if (tipo === "squadra")
    return cache.squadre.map((s) => ({
      id: s.id,
      label: s.nome,
      flagCodice: s.nazione_codice || null,
      escluso: false,
    }));
  if (tipo === "corridore")
    return cache.corridori.map((c) => ({
      id: c.id,
      label: `${c.nome} ${c.cognome}${c.numero_pettorale ? " · #" + c.numero_pettorale : ""}`,
      flagCodice: c.nazione_codice || null,
      // un corridore ritirato/infortunato non è più selezionabile per nuove
      // tappe: resta visibile solo se è già il valore correntemente scelto
      escluso: !!c.ritirato,
    }));
  if (tipo === "tappa")
    return cache.tappe.map((t) => ({
      id: t.id,
      label: `Tappa ${t.numero_tappa} — ${t.nome}`,
      flagCodice: null,
      escluso: false,
    }));
  if (tipo === "sponsor")
    return cache.sponsor.map((s) => ({
      id: s.id,
      label: s.nome,
      flagCodice: null,
      escluso: false,
    }));
  return [];
}

function placeholderPer(tipo) {
  return (
    {
      squadra: "cerca una squadra...",
      corridore: "cerca un corridore...",
      tappa: "cerca una tappa...",
      sponsor: "cerca uno sponsor...",
    }[tipo] || "cerca..."
  );
}

export function htmlCampoEntita(idPrefix, label, tipo) {
  return `
    <div class="field autocomplete-wrap" id="${idPrefix}_wrap">
      <label>${label}</label>
      <div class="autocomplete-input-row">
        <span class="autocomplete-flag" id="${idPrefix}_flag"></span>
        <input type="text" class="autocomplete-input" id="${idPrefix}_input" placeholder="${placeholderPer(tipo)}" autocomplete="off">
      </div>
      <input type="hidden" class="autocomplete-hidden" id="${idPrefix}_hidden">
      <div class="autocomplete-list" id="${idPrefix}_list"></div>
    </div>
  `;
}

// Ritorna una funzione getter (come attivaCampoNazione) che restituisce
// l'id selezionato (o null). "valoreIniziale" è l'id già salvato, se in
// modifica.
export function attivaCampoEntita(idPrefix, tipo, valoreIniziale) {
  const wrapEl = document.getElementById(idPrefix + "_wrap");
  if (!wrapEl) return () => null;

  const input = wrapEl.querySelector(".autocomplete-input");
  const hidden = wrapEl.querySelector(".autocomplete-hidden");
  const lista = wrapEl.querySelector(".autocomplete-list");
  const flagEl = wrapEl.querySelector(".autocomplete-flag");

  const tuttiGliElementi = elencoPer(tipo);
  // includi comunque l'elemento correntemente selezionato anche se
  // "escluso" (es. corridore ritirato in un risultato già registrato)
  const selezionabili = tuttiGliElementi.filter(
    (e) => !e.escluso || e.id === valoreIniziale,
  );

  function mostraFlag(elemento) {
    if (elemento && elemento.flagCodice) {
      flagEl.innerHTML = bandiera(elemento.flagCodice, 20);
      input.classList.add("autocomplete-input--con-bandiera");
    } else {
      flagEl.innerHTML = "";
      input.classList.remove("autocomplete-input--con-bandiera");
    }
  }

  if (valoreIniziale) {
    const e = tuttiGliElementi.find((e) => e.id === valoreIniziale);
    if (e) {
      input.value = e.label;
      hidden.value = e.id;
      mostraFlag(e);
    }
  }

  function renderRisultati(query) {
    const q = query.trim().toLowerCase();
    const risultati = (
      q
        ? selezionabili.filter((e) => e.label.toLowerCase().includes(q))
        : selezionabili
    ).slice(0, 30);

    lista.innerHTML = risultati.length
      ? risultati
          .map(
            (e) => `
          <div class="autocomplete-item" data-id="${e.id}" data-testo="${e.label.replace(/"/g, "&quot;")}">
            ${e.flagCodice ? `<span class="bandiera">${bandiera(e.flagCodice)}</span>` : ""} ${e.label}
          </div>
        `,
          )
          .join("")
      : '<div class="autocomplete-empty">Nessun risultato</div>';
    lista.classList.add("open");
  }

  input.addEventListener("focus", () => renderRisultati(""));
  input.addEventListener("input", () => {
    hidden.value = "";
    mostraFlag(null);
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
    mostraFlag(selezionabili.find((e) => e.id === +item.dataset.id));
    lista.classList.remove("open");
  });

  return () => +hidden.value || null;
}
