import { creaSottoSchede } from "../utils.js";
import { montaListaConForm } from "./tabella-dati.js";

export function init(container) {
  creaSottoSchede(
    container,
    [{ key: "penalita", label: "Penalità" }],
    (key, corpo) => {
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
    },
  );
}
