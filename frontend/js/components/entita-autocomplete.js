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
    }));
  if (tipo === "corridore")
    return cache.corridori.map((c) => ({
      id: c.id,
      label: `${c.nome} ${c.cognome}${c.numero_pettorale ? " · #" + c.numero_pettorale : ""}`,
      flagCodice: c.nazione_codice || null,
      // un corridore ritirato/infortunato/squalificato non è più
      // selezionabile a partire dalla tappa del ritiro in poi; per le
      // tappe precedenti resta invece disponibile, per poter inserire o
      // correggere risultati storici già disputati prima del ritiro
      ritirato: !!c.ritirato,
      ritiratoTappaNumero: c.ritirato_tappa_numero ?? null,
    }));
  if (tipo === "tappa")
    return cache.tappe.map((t) => ({
      id: t.id,
      label: `Tappa ${t.numero_tappa} — ${t.nome}`,
      flagCodice: null,
      numeroTappa: t.numero_tappa,
    }));
  if (tipo === "sponsor")
    return cache.sponsor.map((s) => ({
      id: s.id,
      label: s.nome,
      flagCodice: null,
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

/**
 * Attiva un campo di ricerca con autocompletamento.
 *
 * @param {string} idPrefix
 * @param {string} tipo - "squadra" | "corridore" | "tappa" | "sponsor"
 * @param {number|null} valoreIniziale - id già salvato, se in modifica
 * @param {object} [opzioni]
 * @param {number|null} [opzioni.tappaNumero] - numero della tappa di
 *   riferimento (solo per tipo "corridore"): un corridore ritirato viene
 *   escluso solo se questa tappa è > alla tappa del suo ritiro (la tappa
 *   del ritiro stesso resta ammessa, per poterne registrare il risultato
 *   di abbandono); oppure sempre, se il ritiro non ha una tappa
 *   specificata o non è nota la tappa di riferimento.
 * @param {number[]} [opzioni.escludiIds] - id aggiuntivi da escludere
 *   sempre (es. corridori già presenti in un'altra riga per la stessa
 *   tappa, per evitare doppioni).
 *
 * Ritorna una funzione getter che restituisce l'id selezionato (o null).
 * La funzione espone anche .aggiornaFiltri({ tappaNumero, escludiIds })
 * per ricalcolare le esclusioni quando cambia il contesto (es. l'utente
 * cambia la tappa in un form che ha sia tappa che corridore).
 */
export function attivaCampoEntita(idPrefix, tipo, valoreIniziale, opzioni) {
  const wrapEl = document.getElementById(idPrefix + "_wrap");
  if (!wrapEl) return () => null;

  const input = wrapEl.querySelector(".autocomplete-input");
  const hidden = wrapEl.querySelector(".autocomplete-hidden");
  const lista = wrapEl.querySelector(".autocomplete-list");
  const flagEl = wrapEl.querySelector(".autocomplete-flag");

  const tuttiGliElementi = elencoPer(tipo);

  let tappaNumeroCorrente = opzioni?.tappaNumero ?? null;
  let escludiIdsCorrenti = new Set(opzioni?.escludiIds ?? []);

  function nonSelezionabile(e) {
    if (escludiIdsCorrenti.has(e.id)) return true;
    if (tipo !== "corridore" || !e.ritirato) return false;
    // ritiro senza tappa specificata, o tappa di riferimento sconosciuta:
    // comportamento prudente, il corridore resta escluso ovunque
    if (tappaNumeroCorrente == null || e.ritiratoTappaNumero == null)
      return true;
    // la tappa del ritiro stesso resta ammessa (es. abbandono in corsa,
    // va comunque registrato il risultato di quella tappa); solo dalle
    // tappe successive il corridore non è più selezionabile
    return tappaNumeroCorrente > e.ritiratoTappaNumero;
  }

  let selezionabili = tuttiGliElementi.filter(
    (e) => e.id === valoreIniziale || !nonSelezionabile(e),
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
    hidden.dispatchEvent(new Event("change"));
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
    // avvisa eventuali campi collegati (es. un campo corridore che deve
    // ricalcolare le esclusioni quando cambia la tappa selezionata qui)
    hidden.dispatchEvent(new Event("change"));
  });

  const getter = () => +hidden.value || null;
  getter.aggiornaFiltri = (nuoveOpzioni) => {
    if (nuoveOpzioni?.tappaNumero !== undefined)
      tappaNumeroCorrente = nuoveOpzioni.tappaNumero;
    if (nuoveOpzioni?.escludiIds !== undefined)
      escludiIdsCorrenti = new Set(nuoveOpzioni.escludiIds);
    selezionabili = tuttiGliElementi.filter(
      (e) => e.id === valoreIniziale || !nonSelezionabile(e),
    );
  };
  return getter;
}
