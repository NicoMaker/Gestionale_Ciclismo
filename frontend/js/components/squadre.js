import { apiPost, apiPut, apiDelete } from "../api.js";
import {
  apriModal,
  chiudiModal,
  mostraToast,
  bandiera,
  creaSottoSchede,
  htmlCampoRicerca,
  attivaCampoRicerca,
  erroreDaResponse,
  calcolaEta,
  annoRiferimentoGara,
  ETA_LIMITE_MAGLIA_BIANCA,
} from "../utils.js";
import {
  cache,
  caricaSquadre,
  garantisciNazioni,
  garantisciSponsor,
  garantisciCorridori,
  garantisciTappe,
} from "../state.js";
import { socket } from "../socket.js";
import { montaListaConForm } from "./tabella-dati.js";
import {
  htmlCampoNazione,
  attivaCampoNazione,
} from "./nazione-autocomplete.js";
import { icona } from "../icone.js";
import { apriFormCorridore, apriDettaglioCorridore, MOTIVI_RITIRO } from "./corridori.js";

let sottoTabAttiva = "elenco";
let queryCorrente = "";

function renderElenco(corpo) {
  sottoTabAttiva = "elenco";
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca squadra o nazione...")}
      <button class="btn-secondary btn-piccolo" id="btnNuovaSquadra">${icona("aggiungi")}nuova squadra</button>
    </div>
    <div class="cards-wrap" id="cardsSquadre"></div>
  `;
  document
    .getElementById("btnNuovaSquadra")
    .addEventListener("click", async () => {
      await garantisciNazioni();
      apriFormSquadra(null);
    });
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    disegnaElenco();
  });
  ricaricaElenco();
}

function disegnaElenco() {
  const wrap = document.getElementById("cardsSquadre");
  if (!wrap) return;
  const filtrate = cache.squadre.filter((s) => {
    if (!queryCorrente) return true;
    return `${s.nome} ${s.nazione_nome ?? ""}`
      .toLowerCase()
      .includes(queryCorrente);
  });
  wrap.innerHTML =
    filtrate
      .map(
        (s) => `
    <div class="squadra-card" style="border-top-color:${s.colore || "#e6197f"}">
      <h3><span class="dot-colore" style="background:${s.colore || "#e6197f"}"></span>${s.nome}</h3>
      <p>${s.nazione_codice ? `<span class="bandiera">${bandiera(s.nazione_codice)}</span>${s.nazione_nome}` : "nazione non specificata"}</p>
      <p class="conteggio-corridori">${icona("bici")}${s.numero_corridori ?? 0} corridori in rosa${s.numero_corridori && s.numero_corridori !== s.numero_corridori_in_gara ? ` · ${s.numero_corridori_in_gara ?? 0} in gara` : ""}</p>
      <div class="row">
        <button class="btn-secondary btn-piccolo" data-rosa="${s.id}">${icona("bici")}vedi rosa</button>
        <button class="btn-icon" title="modifica" data-modifica="${s.id}">${icona("modifica")}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${s.id}">${icona("elimina")}</button>
      </div>
    </div>
  `,
      )
      .join("") ||
    `<p style="color:#999;">${queryCorrente ? "Nessuna squadra trovata" : "Nessuna squadra inserita"}</p>`;

  wrap.querySelectorAll("[data-rosa]").forEach((b) =>
    b.addEventListener("click", () => {
      const s = cache.squadre.find((s) => s.id === +b.dataset.rosa);
      if (s) apriRosaSquadra(s);
    }),
  );

  wrap.querySelectorAll("[data-modifica]").forEach((b) =>
    b.addEventListener("click", async () => {
      await garantisciNazioni();
      const s = cache.squadre.find((s) => s.id === +b.dataset.modifica);
      if (s) apriFormSquadra(s);
    }),
  );
  wrap
    .querySelectorAll("[data-elimina]")
    .forEach((b) =>
      b.addEventListener("click", () => eliminaSquadra(+b.dataset.elimina)),
    );
}

async function ricaricaElenco() {
  await caricaSquadre();
  disegnaElenco();
}

function apriFormSquadra(squadraEsistente) {
  const s = squadraEsistente || {};
  apriModal(`
    <h2>${squadraEsistente ? "Modifica squadra" : "Nuova squadra"}</h2>
    <div class="field"><label>Nome squadra</label><input id="s_nome" value="${s.nome ?? ""}"></div>
    <div class="field-row">
      ${htmlCampoNazione("s_naz", "Nazione")}
      <div class="field"><label>Colore</label><input type="color" id="s_colore" value="${s.colore ?? "#e6197f"}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="s_annulla">annulla</button>
      <button class="btn-primary" id="s_salva">${squadraEsistente ? "salva modifiche" : "salva squadra"}</button>
    </div>
  `);
  const leggiNazioneId = attivaCampoNazione("s_naz", s.nazione_id ?? null);
  document.getElementById("s_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("s_salva")
    .addEventListener("click", () =>
      salvaSquadra(squadraEsistente, leggiNazioneId),
    );
}

async function salvaSquadra(squadraEsistente, leggiNazioneId) {
  const body = {
    nome: document.getElementById("s_nome").value,
    nazione_id: leggiNazioneId(),
    colore: document.getElementById("s_colore").value,
  };
  if (!body.nome) {
    mostraToast("Il nome è obbligatorio");
    return;
  }
  const res = squadraEsistente
    ? await apiPut("/api/squadre/" + squadraEsistente.id, body)
    : await apiPost("/api/squadre", body);
  if (res.ok) {
    chiudiModal();
    mostraToast(squadraEsistente ? "Squadra modificata" : "Squadra creata");
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

async function eliminaSquadra(id) {
  if (
    !confirm(
      "Eliminare questa squadra? Verrà spostata nel cestino per 15 giorni.",
    )
  )
    return;
  const res = await apiDelete("/api/squadre/" + id);
  if (res.ok) mostraToast("Squadra spostata nel cestino");
  else
    mostraToast(
      await erroreDaResponse(res, "Impossibile eliminare la squadra"),
    );
}

/* ---------------------------------------------------------------------
 * Dettaglio squadra: la rosa completa dei corridori, con ricerca e la
 * possibilità di aggiungerne uno nuovo già assegnato a questa squadra
 * (compare automaticamente anche nell'elenco corridori generale, è la
 * stessa anagrafica). Se poi la squadra di un corridore viene cambiata
 * dalla sezione corridori, la rosa si aggiorna da sola in tempo reale.
 * ------------------------------------------------------------------- */
let squadraRosaId = null;
let queryRosa = "";

function apriRosaSquadra(squadra) {
  squadraRosaId = squadra.id;
  queryRosa = "";
  apriModal(`
    <h2>Rosa — ${squadra.nome}</h2>
    <div class="subtab-head" style="margin-bottom:14px;">
      ${htmlCampoRicerca("cerca nella rosa...")}
      <button class="btn-secondary btn-piccolo" id="rosa_aggiungi">${icona("aggiungi")}aggiungi corridore</button>
    </div>
    <div id="rosaLista"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="rosa_chiudi">chiudi</button>
    </div>
  `);
  attivaCampoRicerca(document.getElementById("modalBox"), (q) => {
    queryRosa = q;
    disegnaRosa();
  });
  document.getElementById("rosa_chiudi").addEventListener("click", () => {
    squadraRosaId = null;
    chiudiModal();
  });
  document.getElementById("rosa_aggiungi").addEventListener("click", () => {
    apriFormCorridore(null, {
      squadraPreselezionata: squadra.id,
      alSalvataggio: () => {
        const s = cache.squadre.find((s) => s.id === squadra.id) || squadra;
        apriRosaSquadra(s);
      },
    });
  });
  garantisciCorridori().then(() => {
    garantisciTappe().then(disegnaRosa);
  });
}

function disegnaRosa() {
  const lista = document.getElementById("rosaLista");
  if (!lista || squadraRosaId == null) return;
  const annoRiferimento = annoRiferimentoGara(cache.tappe);
  const rosa = cache.corridori
    .filter((c) => c.squadra_id === squadraRosaId)
    .filter((c) => {
      if (!queryRosa) return true;
      return `${c.nome} ${c.cognome} ${c.numero_pettorale ?? ""}`
        .toLowerCase()
        .includes(queryRosa);
    })
    .sort((a, b) => (a.numero_pettorale ?? 999) - (b.numero_pettorale ?? 999));

  lista.innerHTML =
    rosa
      .map((c) => {
        const eta = calcolaEta(c.data_nascita, annoRiferimento);
        const giovane = eta != null && eta <= ETA_LIMITE_MAGLIA_BIANCA;
        const stato = c.ritirato
          ? `<span class="badge badge-ritirato">${MOTIVI_RITIRO[c.motivo_ritiro] || "Ritirato"}</span>`
          : '<span class="badge badge-in-gara">in gara</span>';
        return `
      <div class="rosa-riga">
        <span class="badge badge-pettorale">${c.numero_pettorale ?? "—"}</span>
        <div class="rosa-info">
          <div class="rosa-nome"><strong>${c.nome} ${c.cognome}</strong></div>
          <div class="rosa-meta">
            <span>${eta != null ? `${eta} anni` : "età —"}</span>
            ${giovane ? '<span class="badge badge-giovane">bianca</span>' : ""}
            ${stato}
          </div>
        </div>
        <button class="btn-icon" title="vedi dettaglio" data-rosa-dettaglio="${c.id}">${icona("occhio")}</button>
        <button class="btn-icon" title="modifica" data-rosa-modifica="${c.id}">${icona("modifica")}</button>
      </div>
    `;
      })
      .join("") ||
    `<div class="stato-vuoto">${queryRosa ? "Nessun corridore trovato" : "Rosa vuota — aggiungi il primo corridore"}</div>`;

  lista.querySelectorAll("[data-rosa-dettaglio]").forEach((b) =>
    b.addEventListener("click", () =>
      apriDettaglioCorridore(+b.dataset.rosaDettaglio),
    ),
  );
  lista.querySelectorAll("[data-rosa-modifica]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = cache.corridori.find((c) => c.id === +b.dataset.rosaModifica);
      const squadra = cache.squadre.find((s) => s.id === squadraRosaId);
      if (c)
        apriFormCorridore(c, {
          alSalvataggio: () => squadra && apriRosaSquadra(squadra),
        });
    }),
  );
}

function renderStaff(corpo) {
  sottoTabAttiva = "staff";
  montaListaConForm(corpo, {
    titolo: "Staff tecnico",
    apiPath: "/api/staff-tecnico",
    colonne: [
      { key: "nome", label: "Nome", type: "text" },
      { key: "cognome", label: "Cognome", type: "text" },
      {
        key: "ruolo",
        label: "Ruolo",
        type: "select",
        opzioni: [
          "direttore_sportivo",
          "meccanico",
          "medico",
          "massaggiatore",
          "preparatore_atletico",
        ],
      },
      { key: "squadra_id", label: "Squadra", type: "squadra" },
    ],
  });
}

function renderVeicoli(corpo) {
  sottoTabAttiva = "veicoli";
  montaListaConForm(corpo, {
    titolo: "Veicoli squadra",
    apiPath: "/api/veicoli-squadra",
    colonne: [
      { key: "squadra_id", label: "Squadra", type: "squadra" },
      {
        key: "tipo",
        label: "Tipo",
        type: "select",
        opzioni: ["ammiraglia", "furgone", "bus", "camper"],
      },
      { key: "targa", label: "Targa", type: "text" },
      { key: "modello", label: "Modello", type: "text" },
    ],
  });
}

function renderSponsor(corpo) {
  sottoTabAttiva = "sponsor";
  corpo.innerHTML = `<div class="subtab-sezione"><h4>Anagrafica sponsor</h4><div id="listaSponsorAnagrafica"></div></div>
                      <div class="subtab-sezione"><h4>Sponsor per squadra</h4><div id="listaSponsorSquadra"></div></div>`;
  montaListaConForm(document.getElementById("listaSponsorAnagrafica"), {
    titolo: "Sponsor",
    apiPath: "/api/sponsor",
    colonne: [
      { key: "nome", label: "Nome", type: "text" },
      { key: "settore", label: "Settore", type: "text" },
      { key: "sito_web", label: "Sito web", type: "text" },
    ],
  });
  garantisciSponsor().then(() => {
    montaListaConForm(document.getElementById("listaSponsorSquadra"), {
      titolo: "Sponsor per squadra",
      apiPath: "/api/squadra-sponsor",
      colonne: [
        { key: "squadra_id", label: "Squadra", type: "squadra" },
        { key: "sponsor_id", label: "Sponsor", type: "sponsor" },
        {
          key: "tipo",
          label: "Tipo",
          type: "select",
          opzioni: ["main_sponsor", "co_sponsor", "fornitore_tecnico"],
        },
      ],
    });
  });
}

function renderAlloggi(corpo) {
  sottoTabAttiva = "alloggi";
  montaListaConForm(corpo, {
    titolo: "Alloggi",
    apiPath: "/api/hotel",
    colonne: [
      { key: "tappa_id", label: "Tappa", type: "tappa" },
      { key: "squadra_id", label: "Squadra", type: "squadra" },
      { key: "nome", label: "Nome hotel", type: "text" },
      { key: "citta", label: "Città", type: "text" },
      { key: "indirizzo", label: "Indirizzo", type: "text" },
    ],
  });
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "elenco", label: "Elenco squadre" },
      { key: "staff", label: "Staff tecnico" },
      { key: "veicoli", label: "Veicoli" },
      { key: "sponsor", label: "Sponsor" },
      { key: "alloggi", label: "Alloggi" },
    ],
    (key, corpo) => {
      if (key === "elenco") renderElenco(corpo);
      else if (key === "staff") renderStaff(corpo);
      else if (key === "veicoli") renderVeicoli(corpo);
      else if (key === "sponsor") renderSponsor(corpo);
      else renderAlloggi(corpo);
    },
  );

  socket.on("squadre:aggiornate", () => {
    if (sottoTabAttiva === "elenco") ricaricaElenco();
  });
  // se un corridore viene aggiunto/modificato/spostato di squadra altrove
  // nell'app, la rosa aperta qui (se c'è) resta sempre allineata
  socket.on("corridori:aggiornati", () => {
    if (squadraRosaId != null) disegnaRosa();
  });
}
