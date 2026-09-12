import { creaSottoSchede } from "../utils.js";
import { montaListaConForm } from "./tabella-dati.js";

function renderPenalita(corpo) {
  montaListaConForm(corpo, {
    titolo: "Penalità",
    placeholderRicerca: "cerca corridore, motivo o tappa...",
    apiPath: "/api/penalita",
    filtroSelect: { tipo: "tappa", key: "tappa_id", tutte: "tutte le tappe" },
    colonne: [
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "motivo", label: "Motivo", type: "text" },
      { key: "secondi", label: "Secondi", type: "number" },
      { key: "punti", label: "Punti", type: "number" },
    ],
  });
}

function renderAntidoping(corpo) {
  montaListaConForm(corpo, {
    titolo: "Controllo antidoping",
    placeholderRicerca: "cerca corridore, esito o tappa...",
    apiPath: "/api/controlli-antidoping",
    filtroSelect: { tipo: "tappa", key: "tappa_id", tutte: "tutte le tappe" },
    colonne: [
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "data", label: "Data", type: "date" },
      {
        key: "esito",
        label: "Esito",
        type: "select",
        opzioni: ["negativo", "positivo", "in_attesa"],
      },
    ],
  });
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "penalita", label: "Penalità" },
      { key: "antidoping", label: "Controlli antidoping" },
    ],
    (key, corpo) => {
      if (key === "penalita") renderPenalita(corpo);
      else renderAntidoping(corpo);
    },
  );
}
