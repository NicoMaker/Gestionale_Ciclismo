import { creaSottoSchede } from "../../core/utils.js";
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

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "media", label: "Media accreditati" },
      { key: "comunicati", label: "Comunicati stampa" },
    ],
    (key, corpo) => {
      if (key === "media") renderMedia(corpo);
      else renderComunicati(corpo);
    },
  );
}
