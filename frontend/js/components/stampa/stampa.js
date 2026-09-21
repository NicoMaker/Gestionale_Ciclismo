import { montaListaConForm } from "../tabella-dati/tabella-dati.js";

function renderMedia(corpo) {
  montaListaConForm(corpo, {
    titolo: "Accredito media",
    apiPath: "/api/media-accreditati",
    colonne: [
      { key: "nome", label: "Nome", type: "text" },
      { key: "testata", label: "Testata", type: "text" },
      {
        key: "tipo",
        label: "Tipo",
        type: "select",
        opzioni: ["stampa", "tv", "radio", "foto", "online"],
      },
      { key: "tappa_id", label: "Tappa", type: "tappa" },
    ],
  });
}

function renderComunicati(corpo) {
  montaListaConForm(corpo, {
    titolo: "Comunicato stampa",
    apiPath: "/api/comunicati-stampa",
    colonne: [
      { key: "titolo", label: "Titolo", type: "text" },
      { key: "contenuto", label: "Contenuto", type: "text" },
      { key: "data", label: "Data", type: "date" },
      { key: "tappa_id", label: "Tappa", type: "tappa" },
    ],
  });
}

// "Media accreditati" e "Comunicati stampa" erano sotto-schede di
// "Stampa": ora sono due voci di navbar separate.
export function initMedia(container) {
  renderMedia(container);
}

export function initComunicati(container) {
  renderComunicati(container);
}
