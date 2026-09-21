import { montaListaConForm } from "../tabella-dati/tabella-dati.js";

function renderPenalita(corpo) {
  montaListaConForm(corpo, {
    titolo: "Penalità",
    apiPath: "/api/penalita",
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
    apiPath: "/api/controlli-antidoping",
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

function renderAbbuoni(corpo) {
  corpo.innerHTML = `
    <p style="color:var(--testo-soft);font-size:13.5px;margin-bottom:16px;max-width:640px;">
      Secondi guadagnati in classifica generale da chi taglia il traguardo di
      tappa in una di queste posizioni (si sottraggono dal tempo totale). Si
      applicano solo alle tappe con "assegna abbuoni" attivo — di norma tutte
      tranne le cronometro. Aggiungi righe per altre posizioni se vuoi
      premiarne più di tre.
    </p>
    <div id="abbuoniLista"></div>
  `;
  montaListaConForm(document.getElementById("abbuoniLista"), {
    titolo: "Abbuoni per posizione di tappa",
    apiPath: "/api/abbuoni",
    colonne: [
      { key: "posizione", label: "Posizione d'arrivo", type: "number" },
      { key: "secondi", label: "Secondi abbuono", type: "number" },
    ],
  });
}

// Penalità, Controlli antidoping e Abbuoni erano sotto-schede di
// "Regolamento": ora sono tre voci di navbar separate.
export function initPenalita(container) {
  renderPenalita(container);
}

export function initAntidoping(container) {
  renderAntidoping(container);
}

export function initAbbuoni(container) {
  renderAbbuoni(container);
}
