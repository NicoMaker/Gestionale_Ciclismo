// Libreria di icone SVG inline condivisa da tutti i componenti.
// Nessuna immagine esterna: ogni icona è un piccolo path vettoriale colorabile via CSS (currentColor).

const D = {
  modifica: '<path d="M4 20 L4 16.2 L15.5 4.7 C16.3 3.9 17.6 3.9 18.4 4.7 L19.3 5.6 C20.1 6.4 20.1 7.7 19.3 8.5 L7.8 20 Z" stroke-linejoin="round"/><path d="M13.5 6.7 L17.3 10.5" stroke-linecap="round"/>',
  elimina: '<path d="M5 7 H19 M9 7 V4.6 C9 4 9.4 3.5 10 3.5 H14 C14.6 3.5 15 4 15 4.6 V7 M7.5 7 L8.3 19.4 C8.35 20.2 9 20.8 9.8 20.8 H14.2 C15 20.8 15.65 20.2 15.7 19.4 L16.5 7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.3 10.5 V17 M13.7 10.5 V17" stroke-linecap="round"/>',
  aggiungi: '<circle cx="12" cy="12" r="9"/><path d="M12 8 V16 M8 12 H16" stroke-linecap="round"/>',
  cerca: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3 L20 20" stroke-linecap="round"/>',
  diretta: '<circle cx="12" cy="12" r="2.6"/><path d="M8.2 8.2 C6 10.4 6 13.6 8.2 15.8 M15.8 8.2 C18 10.4 18 13.6 15.8 15.8 M5 5 C1.3 8.7 1.3 15.3 5 19 M19 5 C22.7 8.7 22.7 15.3 19 19" stroke-linecap="round"/>',
  bandieraTraguardo: '<path d="M6 21 V4 M6 4 L18 4 L15 8 L18 12 L6 12" stroke-linejoin="round" stroke-linecap="round"/>',
  chevron: '<path d="M8 5 L16 12 L8 19" stroke-linecap="round" stroke-linejoin="round"/>',
  // meteo
  sereno: '<circle cx="12" cy="12" r="4.4"/><path d="M12 3 V5.4 M12 18.6 V21 M3 12 H5.4 M18.6 12 H21 M5.6 5.6 L7.3 7.3 M16.7 16.7 L18.4 18.4 M18.4 5.6 L16.7 7.3 M7.3 16.7 L5.6 18.4" stroke-linecap="round"/>',
  nuvoloso: '<path d="M7 18.5 C4.5 18.5 3 16.6 3 14.6 C3 12.6 4.6 11 6.5 11 C6.8 8.3 9.1 6.3 11.8 6.3 C14.6 6.3 16.9 8.5 17.1 11.2 C19.2 11.4 21 13.2 21 15.4 C21 17.7 19.1 18.5 17.5 18.5 Z" stroke-linejoin="round"/>',
  pioggia: '<path d="M6.5 15.5 C4.3 15.5 3 13.8 3 12 C3 10.2 4.4 8.7 6.2 8.7 C6.5 6.2 8.6 4.3 11.2 4.3 C13.8 4.3 15.9 6.3 16.1 8.8 C18 9 19.5 10.6 19.5 12.6 C19.5 14.7 17.8 15.5 16.3 15.5 Z" stroke-linejoin="round"/><path d="M8 18.5 L7 21 M12 18.5 L11 21 M16 18.5 L15 21" stroke-linecap="round"/>',
  vento_forte: '<path d="M3 8.5 H14.5 C16 8.5 17 7.4 17 6 C17 4.6 16 3.5 14.5 3.5 C13.4 3.5 12.5 4.1 12.1 5" stroke-linecap="round"/><path d="M3 13 H17.5 C19.2 13 20.5 14.2 20.5 15.8 C20.5 17.4 19.2 18.5 17.5 18.5 C16.2 18.5 15.2 17.8 14.8 16.8" stroke-linecap="round"/><path d="M3 18 H10" stroke-linecap="round"/>',
  neve: '<path d="M12 3 V21 M6 6 L18 18 M18 6 L6 18" stroke-linecap="round"/>',
  // tipi tappa
  pianura: '<path d="M3 16 H21" stroke-linecap="round"/><path d="M6 16 L9 12 L12 16 L16 9 L20 16" stroke-linecap="round" stroke-linejoin="round"/>',
  collina: '<path d="M2 18 L8 9 L12 14 L15 10 L22 18 Z" stroke-linejoin="round"/>',
  montagna: '<path d="M2 19 L8 6 L11.5 12 L14 8 L22 19 Z" stroke-linejoin="round"/><path d="M6.3 11.5 L9.6 11.5 M12.6 10 L14 10" stroke-linecap="round"/>',
  cronometro: '<circle cx="12" cy="13" r="8"/><path d="M12 13 V8.2 M12 13 L15.2 15" stroke-linecap="round"/><path d="M9.5 2.3 H14.5" stroke-linecap="round"/>',
  // regolamento / antidoping
  penalita: '<path d="M12 3 L20 6.3 V11.5 C20 16.4 16.8 19.9 12 21.5 C7.2 19.9 4 16.4 4 11.5 V6.3 Z" stroke-linejoin="round"/><path d="M12 8 V13 M12 16 V16.1" stroke-linecap="round"/>',
  esitoNegativo: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5 L10.8 14.8 L15.7 9.5" stroke-linecap="round" stroke-linejoin="round"/>',
  esitoPositivo: '<circle cx="12" cy="12" r="9"/><path d="M9 9 L15 15 M15 9 L9 15" stroke-linecap="round"/>',
  esitoAttesa: '<circle cx="12" cy="12" r="9"/><path d="M12 7.3 V12 L15.2 14" stroke-linecap="round" stroke-linejoin="round"/>',
  // squadre / persone
  bici: '<circle cx="6" cy="17" r="3.4"/><circle cx="18" cy="17" r="3.4"/><path d="M6 17 L10 8 L15 8 M10 8 L8.3 4.7 H11.5 M10 8 L14.3 13.6 L18 17" stroke-linecap="round" stroke-linejoin="round"/>',
  staff: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20 C4.5 15.6 7.8 13.4 12 13.4 C16.2 13.4 19.5 15.6 19.5 20" stroke-linecap="round"/>',
  veicolo: '<path d="M3.5 16 V11.5 L5.5 7.5 H16 L19 11.2 H20.5 V16" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="16.3" r="1.9"/><circle cx="16.5" cy="16.3" r="1.9"/>',
  hotel: '<path d="M4 20 V6 M4 6 H15 C17 6 18.5 7.5 18.5 9.5 V12 M4 12 H18.5 M4 20 H20 V12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="9" r="1.3"/>',
  sponsor: '<path d="M12 3 L14.4 8.6 L20.5 9.2 L15.9 13.2 L17.3 19.2 L12 15.9 L6.7 19.2 L8.1 13.2 L3.5 9.2 L9.6 8.6 Z" stroke-linejoin="round"/>',
  // stampa
  stampa: '<rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M7 9 H13 M7 12.5 H17 M7 16 H17" stroke-linecap="round"/>',
  tv: '<rect x="3" y="6" width="18" height="12.5" rx="1.5"/><path d="M8 3.5 L12 6 L16 3.5" stroke-linecap="round" stroke-linejoin="round"/>',
  radio: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><circle cx="8" cy="14.5" r="1.9"/><path d="M13 13 H17 M13 16 H17" stroke-linecap="round"/><path d="M6 9 L15 4" stroke-linecap="round"/>',
  foto: '<rect x="3" y="7" width="18" height="13" rx="1.8"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8 7 L9.4 4.5 H14.6 L16 7" stroke-linecap="round" stroke-linejoin="round"/>',
  online: '<circle cx="12" cy="12" r="9"/><path d="M3 12 H21 M12 3 C14.5 6 14.5 18 12 21 C9.5 18 9.5 6 12 3" stroke-linecap="round"/>',
  comunicato: '<path d="M4 5.5 H20 V16 H9 L5 19.5 V16 H4 Z" stroke-linejoin="round"/><path d="M8 9.5 H16 M8 12.5 H13" stroke-linecap="round"/>',
  // classifiche
  medaglia: '<circle cx="12" cy="14.5" r="6"/><path d="M9 3.5 L7 9.6 L12 8.3 L17 9.6 L15 3.5" stroke-linecap="round" stroke-linejoin="round"/>',
  nastro: '<path d="M7 12 L4 20 L9 18.3 L11 21 L14 13" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 12 L20 20 L15 18.3 L13 21" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="9" r="5.5"/>',
};

/** Restituisce un <svg> inline per il nome icona richiesto. */
export function icona(nome, extraClass = '') {
  const path = D[nome];
  if (!path) return '';
  return `<svg viewBox="0 0 24 24" class="icona ${extraClass}" aria-hidden="true">${path}</svg>`;
}

/** Icona coerente per un valore di enum (meteo, tipo tappa, esito, tipo media...). */
export function iconaValore(valore) {
  const mappa = {
    sereno: 'sereno', nuvoloso: 'nuvoloso', pioggia: 'pioggia', vento_forte: 'vento_forte', neve: 'neve',
    pianura: 'pianura', collina: 'collina', montagna: 'montagna', cronometro: 'cronometro',
    negativo: 'esitoNegativo', positivo: 'esitoPositivo', in_attesa: 'esitoAttesa',
    stampa: 'stampa', tv: 'tv', radio: 'radio', foto: 'foto', online: 'online',
    ammiraglia: 'veicolo', furgone: 'veicolo', bus: 'veicolo', camper: 'veicolo',
    main_sponsor: 'sponsor', co_sponsor: 'sponsor', fornitore_tecnico: 'sponsor',
    direttore_sportivo: 'staff', meccanico: 'staff', medico: 'staff', massaggiatore: 'staff', preparatore_atletico: 'staff',
    programmata: '', in_corso: 'diretta', conclusa: 'bandieraTraguardo'
  };
  return mappa[valore] ? icona(mappa[valore]) : '';
}

/** Emoji medaglia per le prime 3 posizioni, altrimenti la posizione numerica. */
export function medaglia(posizione) {
  if (posizione === 1) return '🥇';
  if (posizione === 2) return '🥈';
  if (posizione === 3) return '🥉';
  return null;
}
