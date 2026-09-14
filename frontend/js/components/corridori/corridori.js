import { apiGet, apiPost, apiPut, apiDelete } from "../../core/api.js";
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
} from "../../core/utils.js";
import {
  cache,
  caricaCorridori,
  garantisciSquadre,
  garantisciNazioni,
  garantisciTappe,
} from "../../core/state.js";
import { socket } from "../../core/socket.js";
import { montaListaConForm } from "../tabella-dati/tabella-dati.js";
import {
  htmlCampoNazione,
  attivaCampoNazione,
} from "../nazione-autocomplete/nazione-autocomplete.js";
import {
  htmlCampoEntita,
  attivaCampoEntita,
} from "../entita-autocomplete/entita-autocomplete.js";
import { icona } from "../../core/icone.js";

export const MOTIVI_RITIRO = {
  infortunio: "Infortunio",
  abbandono: "Abbandono / non partecipazione",
  squalifica: "Squalifica",
  doping: "Doping",
  altro: "Altro",
};

let sottoTabAttiva = "elenco";
let queryCorrente = "";

function renderElenco(corpo) {
  sottoTabAttiva = "elenco";
  corpo.innerHTML = `
    <div class="subtab-head">
      ${htmlCampoRicerca("cerca corridore, nazione, squadra o motivo ritiro...")}
      <button class="btn-secondary btn-piccolo" id="btnNuovoCorridore">${icona("aggiungi")}nuovo corridore</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pett.</th><th>Nome</th><th>Età</th><th>Nazionalità</th><th>Squadra</th><th>Stato</th><th class="th-azioni"></th></tr></thead>
        <tbody id="tabellaCorridori"></tbody>
      </table>
    </div>
  `;
  document
    .getElementById("btnNuovoCorridore")
    .addEventListener("click", () => apriFormCorridore(null));
  attivaCampoRicerca(corpo, (q) => {
    queryCorrente = q;
    disegnaElenco();
  });
  ricaricaElenco();
}

export function badgeStato(c) {
  if (!c.ritirato) return '<span class="badge badge-in-gara">in gara</span>';
  const motivo = MOTIVI_RITIRO[c.motivo_ritiro] || "Ritirato";
  const iconaMotivo = c.motivo_ritiro === "doping" ? "doping" : "infortunio";
  const daTappa = c.ritirato_tappa_numero
    ? ` dalla tappa ${c.ritirato_tappa_numero}`
    : "";
  return `<span class="badge badge-ritirato badge-ritirato-${c.motivo_ritiro || "altro"}" title="${motivo}${daTappa}">${icona(iconaMotivo)}${motivo}${daTappa}</span>`;
}

function disegnaElenco() {
  const tbody = document.getElementById("tabellaCorridori");
  if (!tbody) return;
  const annoRiferimento = annoRiferimentoGara(cache.tappe);
  const filtrati = cache.corridori.filter((c) => {
    if (!queryCorrente) return true;
    const testo =
      `${c.nome} ${c.cognome} ${c.nazione_nome ?? ""} ${c.squadra_nome ?? ""} ${c.numero_pettorale ?? ""} ${MOTIVI_RITIRO[c.motivo_ritiro] ?? ""} ${c.note_ritiro ?? ""}`.toLowerCase();
    return testo.includes(queryCorrente);
  });
  tbody.innerHTML =
    filtrati
      .map((c) => {
        const eta = calcolaEta(c.data_nascita, annoRiferimento);
        const giovane = eta != null && eta <= ETA_LIMITE_MAGLIA_BIANCA;
        return `
    <tr class="${c.ritirato ? "riga-ritirato" : ""}">
      <td><span class="badge badge-pettorale">${c.numero_pettorale ?? "—"}</span></td>
      <td><strong>${c.nome} ${c.cognome}</strong></td>
      <td>${eta != null ? `${eta} anni` : "—"}${giovane ? ' <span class="badge badge-giovane" title="Rientra nella classifica giovani (maglia bianca)">maglia bianca</span>' : ""}</td>
      <td>${c.nazione_codice ? `<span class="bandiera">${bandiera(c.nazione_codice)}</span>${c.nazione_nome}` : "—"}</td>
      <td>${c.squadra_nome ? `${c.squadra_nazione_codice ? `<span class="bandiera">${bandiera(c.squadra_nazione_codice)}</span>` : ""}<span class="dot-colore" style="background:${c.squadra_colore || "#999"}"></span>${c.squadra_nome}` : "—"}</td>
      <td>${badgeStato(c)}</td>
      <td class="td-azioni">
        <button class="btn-icon" title="vedi dettaglio" data-dettaglio="${c.id}">${icona("occhio")}</button>
        ${
          c.ritirato
            ? `<button class="btn-icon" title="modifica dati del ritiro" data-modifica-ritiro="${c.id}">${icona("modifica")}</button>
               <button class="btn-icon" title="riammetti in gara" data-riammetti="${c.id}">${icona("ripristina")}</button>`
            : `<button class="btn-icon" title="segna infortunio / ritiro" data-ritira="${c.id}">${icona("infortunio")}</button>`
        }
        <button class="btn-icon" title="modifica" data-modifica="${c.id}">${icona("modifica")}</button>
        <button class="btn-icon danger" title="elimina" data-elimina="${c.id}">${icona("elimina")}</button>
      </td>
    </tr>
  `;
      })
      .join("") ||
    `<tr><td colspan="7" class="stato-vuoto">${queryCorrente ? "Nessun corridore trovato" : "Nessun corridore inserito"}</td></tr>`;

  tbody
    .querySelectorAll("[data-dettaglio]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        apriDettaglioCorridore(+b.dataset.dettaglio),
      ),
    );
  tbody.querySelectorAll("[data-modifica]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = cache.corridori.find((c) => c.id === +b.dataset.modifica);
      if (c) apriFormCorridore(c);
    }),
  );
  tbody
    .querySelectorAll("[data-elimina]")
    .forEach((b) =>
      b.addEventListener("click", () => eliminaCorridore(+b.dataset.elimina)),
    );
  tbody.querySelectorAll("[data-modifica-ritiro]").forEach((b) =>
    b.addEventListener("click", async () => {
      await garantisciTappe();
      const c = cache.corridori.find((c) => c.id === +b.dataset.modificaRitiro);
      if (c) apriFormRitiro(c);
    }),
  );
  tbody.querySelectorAll("[data-ritira]").forEach((b) =>
    b.addEventListener("click", async () => {
      await garantisciTappe();
      const c = cache.corridori.find((c) => c.id === +b.dataset.ritira);
      if (c) apriFormRitiro(c);
    }),
  );
  tbody
    .querySelectorAll("[data-riammetti]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        riammettiCorridore(+b.dataset.riammetti),
      ),
    );
}

async function ricaricaElenco() {
  await caricaCorridori();
  await garantisciTappe();
  disegnaElenco();
}

export async function apriFormCorridore(corridoreEsistente, opzioni) {
  await garantisciSquadre();
  await garantisciNazioni();
  await garantisciTappe();
  const c = corridoreEsistente || {};
  const squadraIniziale =
    c.squadra_id ?? opzioni?.squadraPreselezionata ?? null;
  apriModal(`
    <h2>${corridoreEsistente ? "Modifica corridore" : "Nuovo corridore"}</h2>
    <div class="field-row">
      <div class="field"><label>Nome</label><input id="c_nome" value="${c.nome ?? ""}"></div>
      <div class="field"><label>Cognome</label><input id="c_cognome" value="${c.cognome ?? ""}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Pettorale</label><input type="number" id="c_pettorale" value="${c.numero_pettorale ?? ""}"></div>
      ${htmlCampoNazione("c_naz", "Nazionalità")}
    </div>
    <div class="field-row">
      <div class="field">
        <label>Data di nascita</label>
        <input type="date" id="c_nascita" value="${c.data_nascita ?? ""}">
      </div>
      <div class="field">
        <label>Età / classifica giovani</label>
        <div class="campo-hint" id="c_eta_hint">—</div>
      </div>
    </div>
    ${htmlCampoEntita("c_squadra", "Squadra", "squadra")}
    ${
      c.ritirato
        ? `
    <hr style="border:none;border-top:1px solid var(--bordo,#e5e5e5);margin:18px 0 14px;">
    <p style="color:var(--testo-soft);font-size:13.5px;margin:0 0 10px;font-weight:600;">Stato ritiro</p>
    <div class="field">
      <label>Non parteciperà più a partire dalla tappa</label>
      <select id="c_rit_tappa">
        <option value="">— non specificato —</option>
        ${cache.tappe
          .slice()
          .sort((a, b) => a.numero_tappa - b.numero_tappa)
          .map(
            (t) =>
              `<option value="${t.numero_tappa}" ${t.numero_tappa === c.ritirato_tappa_numero ? "selected" : ""}>Tappa ${t.numero_tappa} — ${t.nome}</option>`,
          )
          .join("")}
      </select>
    </div>
    <div class="field">
      <label>Motivo</label>
      <select id="c_rit_motivo">
        ${Object.entries(MOTIVI_RITIRO)
          .map(
            ([v, l]) =>
              `<option value="${v}" ${v === c.motivo_ritiro ? "selected" : ""}>${l}</option>`,
          )
          .join("")}
      </select>
    </div>
    <div class="field"><label>Note (opzionale)</label><input id="c_rit_note" placeholder="es. caduta al km 80, frattura al polso" value="${(c.note_ritiro ?? "").replace(/"/g, "&quot;")}"></div>
    <p style="color:var(--testo-soft);font-size:12.5px;margin:2px 0 0;">Per far rientrare in gara il corridore usa "riammetti" dall'elenco, non questo modulo.</p>
    `
        : ""
    }
    <div class="modal-actions">
      <button class="btn-secondary" id="c_annulla">annulla</button>
      <button class="btn-primary" id="c_salva">${corridoreEsistente ? "salva modifiche" : "salva corridore"}</button>
    </div>
  `);
  const leggiNazioneId = attivaCampoNazione("c_naz", c.nazione_id ?? null);
  const leggiSquadraId = attivaCampoEntita(
    "c_squadra",
    "squadra",
    squadraIniziale,
  );

  // età calcolata al volo, per capire subito — mentre si inserisce la
  // data di nascita — se il corridore rientrerà nella classifica giovani
  // (maglia bianca), che in questo gestionale è riservata a chi ha 25
  // anni o meno nell'anno della corsa
  const annoRiferimento = annoRiferimentoGara(cache.tappe);
  const inputNascita = document.getElementById("c_nascita");
  const etaHint = document.getElementById("c_eta_hint");
  function aggiornaEtaHint() {
    const eta = calcolaEta(inputNascita.value, annoRiferimento);
    if (eta == null) {
      etaHint.textContent = "—";
      return;
    }
    etaHint.textContent =
      eta <= ETA_LIMITE_MAGLIA_BIANCA
        ? `${eta} anni · rientra in classifica giovani (maglia bianca)`
        : `${eta} anni · fuori classifica giovani (oltre ${ETA_LIMITE_MAGLIA_BIANCA} anni)`;
  }
  inputNascita.addEventListener("input", aggiornaEtaHint);
  aggiornaEtaHint();

  document.getElementById("c_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("c_salva")
    .addEventListener("click", () =>
      salvaCorridore(
        corridoreEsistente,
        leggiNazioneId,
        leggiSquadraId,
        opzioni,
      ),
    );
}

async function salvaCorridore(
  corridoreEsistente,
  leggiNazioneId,
  leggiSquadraId,
  opzioni,
) {
  const body = {
    nome: document.getElementById("c_nome").value,
    cognome: document.getElementById("c_cognome").value,
    numero_pettorale: +document.getElementById("c_pettorale").value || null,
    data_nascita: document.getElementById("c_nascita").value || null,
    nazione_id: leggiNazioneId(),
    squadra_id: leggiSquadraId(),
  };
  if (!body.nome || !body.cognome) {
    mostraToast("Nome e cognome obbligatori");
    return;
  }
  const res = corridoreEsistente
    ? await apiPut("/api/corridori/" + corridoreEsistente.id, body)
    : await apiPost("/api/corridori", body);
  if (!res.ok) {
    mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
    return;
  }
  // se il modulo mostrava anche la sezione "Stato ritiro" (corridore già
  // ritirato), si salvano in un colpo solo pure tappa/motivo/note del
  // ritiro, così non serve passare dal bottone dedicato per ogni modifica
  const campoRitMotivo = document.getElementById("c_rit_motivo");
  if (corridoreEsistente?.ritirato && campoRitMotivo) {
    const bodyRitiro = {
      ritirato_tappa_numero:
        +document.getElementById("c_rit_tappa").value || null,
      motivo_ritiro: campoRitMotivo.value,
      note_ritiro: document.getElementById("c_rit_note").value || null,
    };
    const resRitiro = await apiPost(
      `/api/corridori/${corridoreEsistente.id}/ritira`,
      bodyRitiro,
    );
    if (!resRitiro.ok) {
      mostraToast(
        await erroreDaResponse(
          resRitiro,
          "Corridore salvato, ma il ritiro non è stato aggiornato",
        ),
      );
      chiudiModal();
      opzioni?.alSalvataggio?.(await res.json());
      return;
    }
  }
  chiudiModal();
  mostraToast(
    corridoreEsistente ? "Corridore modificato" : "Corridore aggiunto",
  );
  opzioni?.alSalvataggio?.(await res.json());
}

async function eliminaCorridore(id) {
  if (
    !confirm(
      "Eliminare questo corridore? Verrà spostato nel cestino per 15 giorni.",
    )
  )
    return;
  const res = await apiDelete("/api/corridori/" + id);
  if (res.ok) mostraToast("Corridore spostato nel cestino");
  else
    mostraToast(
      await erroreDaResponse(res, "Impossibile eliminare il corridore"),
    );
}

/* ---------------------------------------------------------------------
 * Ritiro / infortunio: da quando un corridore viene segnato come ritirato
 * (infortunio, abbandono, squalifica...) non è più selezionabile per
 * nessuna nuova tappa e sparisce da tutte le classifiche, pur restando
 * visibile in anagrafica con lo storico dei risultati già ottenuti.
 * ------------------------------------------------------------------- */
/**
 * Apre il modale di ritiro per un corridore.
 *
 * @param {{id:number, nome:string, cognome:string}} corridore
 * @param {object} [opzioni]
 * @param {number|null} [opzioni.tappaNumeroPreselezionata] - numero tappa da
 *   preselezionare nel menu "non parteciperà più a partire dalla tappa"
 *   (es. la tappa di riferimento aperta nella pagina Risultati). Se
 *   omesso, si propone di default la prima tappa non ancora conclusa.
 * @param {Function} [opzioni.alSalvataggio] - callback eseguita dopo un
 *   ritiro salvato con successo, al posto del refresh predefinito
 *   dell'elenco corridori (utile per aggiornare la pagina chiamante,
 *   es. la tabella dei risultati di tappa).
 */
export function apriFormRitiro(corridore, opzioni = {}) {
  const c = corridore;
  // modalità modifica: il corridore è già segnato come ritirato, quindi si
  // precompilano tappa/motivo/note con i valori già registrati invece di
  // riproporre i default del "nuovo ritiro"
  const modifica = !!c.ritirato;

  // di default si propone la prima tappa "programmata" successiva come
  // ultima tappa NON disputata: comodo per il caso comune "esce ora,
  // dalla prossima tappa non corre più"; se il chiamante indica già una
  // tappa di riferimento (es. la tappa aperta nella pagina Risultati) si
  // preseleziona invece quella. In modifica si preselezionano invece i
  // valori già salvati per quel ritiro.
  const prossimaTappa = [...cache.tappe]
    .sort((a, b) => a.numero_tappa - b.numero_tappa)
    .find((t) => t.stato !== "conclusa");
  const numeroPreselezionato = modifica
    ? (c.ritirato_tappa_numero ?? null)
    : (opzioni.tappaNumeroPreselezionata ??
      prossimaTappa?.numero_tappa ??
      null);
  const motivoPreselezionato = modifica ? c.motivo_ritiro : null;
  const notePreselezionate = modifica ? (c.note_ritiro ?? "") : "";

  apriModal(`
    <h2>${modifica ? "Modifica ritiro" : "Segna ritiro"} — ${c.nome} ${c.cognome}</h2>
    <p style="color:var(--testo-soft);font-size:13.5px;margin:-6px 0 16px;">
      ${
        modifica
          ? 'Correggi la tappa, il motivo o le note del ritiro già registrato. Per far rientrare in gara il corridore usa invece "riammetti".'
          : "Da questo momento il corridore non potrà più essere selezionato per risultati di tappa, traguardi volanti o GPM, e non comparirà più in nessuna classifica."
      }
    </p>
    <div class="field">
      <label>Non parteciperà più a partire dalla tappa</label>
      <select id="rit_tappa">
        <option value="">— non specificato —</option>
        ${cache.tappe
          .slice()
          .sort((a, b) => a.numero_tappa - b.numero_tappa)
          .map(
            (t) =>
              `<option value="${t.numero_tappa}" ${t.numero_tappa === numeroPreselezionato ? "selected" : ""}>Tappa ${t.numero_tappa} — ${t.nome}</option>`,
          )
          .join("")}
      </select>
    </div>
    <div class="field">
      <label>Motivo</label>
      <select id="rit_motivo">
        ${Object.entries(MOTIVI_RITIRO)
          .map(
            ([v, l]) =>
              `<option value="${v}" ${v === motivoPreselezionato ? "selected" : ""}>${l}</option>`,
          )
          .join("")}
      </select>
    </div>
    <div class="field"><label>Note (opzionale)</label><input id="rit_note" placeholder="es. caduta al km 80, frattura al polso" value="${notePreselezionate.replace(/"/g, "&quot;")}"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="rit_annulla">annulla</button>
      <button class="btn-primary" id="rit_conferma">${modifica ? "salva modifiche" : "conferma ritiro"}</button>
    </div>
  `);
  document.getElementById("rit_annulla").addEventListener("click", chiudiModal);
  document
    .getElementById("rit_conferma")
    .addEventListener("click", () =>
      confermaRitiro(c.id, opzioni.alSalvataggio, modifica),
    );
}

async function confermaRitiro(corridoreId, alSalvataggio, modifica = false) {
  const body = {
    ritirato_tappa_numero: +document.getElementById("rit_tappa").value || null,
    motivo_ritiro: document.getElementById("rit_motivo").value,
    note_ritiro: document.getElementById("rit_note").value || null,
  };
  const res = await apiPost(`/api/corridori/${corridoreId}/ritira`, body);
  if (res.ok) {
    chiudiModal();
    mostraToast(
      modifica
        ? "Dati del ritiro aggiornati"
        : "Corridore segnato come ritirato",
    );
    if (alSalvataggio) await alSalvataggio();
    else ricaricaElenco();
  } else mostraToast(await erroreDaResponse(res, "Errore nel salvataggio"));
}

/**
 * Riammette in gara un corridore precedentemente ritirato.
 * @param {number} corridoreId
 * @param {object} [opzioni]
 * @param {Function} [opzioni.alSalvataggio] - callback dopo la riammissione,
 *   al posto del refresh predefinito dell'elenco corridori.
 */
export async function riammettiCorridore(corridoreId, opzioni = {}) {
  if (!confirm("Riammettere questo corridore in gara?")) return;
  const res = await apiPost(`/api/corridori/${corridoreId}/riammetti`, {});
  if (res.ok) {
    mostraToast("Corridore riammesso in gara");
    if (opzioni.alSalvataggio) await opzioni.alSalvataggio();
    else ricaricaElenco();
  } else mostraToast(await erroreDaResponse(res, "Impossibile riammettere"));
}

function htmlMaglia(nome, coloreVar, posizione) {
  const testo = posizione
    ? `${posizione.posizione}° / ${posizione.totale}`
    : "non in classifica";
  return `
    <div class="banner-maglia dettaglio-maglia" style="--colore-maglia:${coloreVar};">
      <span class="maglia-dot"></span>
      <div>
        <strong>${testo}</strong>
        <span class="maglia-label">${nome}</span>
      </div>
    </div>
  `;
}

export async function apriDettaglioCorridore(corridoreId) {
  const c = cache.corridori.find((c) => c.id === corridoreId);
  if (!c) return;
  apriModal(`
    <h2>${c.nazione_codice ? bandiera(c.nazione_codice, 20) + " " : ""}${c.nome} ${c.cognome}</h2>
    <p style="color:var(--testo-soft);margin-top:-8px;margin-bottom:16px;">
      ${c.numero_pettorale ? `Pettorale #${c.numero_pettorale} · ` : ""}${c.squadra_nome ?? "senza squadra"}
      ${badgeStato(c)}
    </p>
    <div id="dettaglioMaglie" class="dettaglio-maglie">Caricamento posizioni in classifica…</div>
    <h4 style="margin:18px 0 8px;">Tappa per tappa</h4>
    <div class="table-wrap" style="max-height:38vh;">
      <table>
        <thead><tr><th>#</th><th>Tappa</th><th>Pos.</th><th>Tempo</th><th>Punti</th></tr></thead>
        <tbody id="dettaglioTappeBody"><tr><td colspan="5" class="stato-vuoto">Caricamento…</td></tr></tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="dett_chiudi">chiudi</button>
    </div>
  `);
  document.getElementById("dett_chiudi").addEventListener("click", chiudiModal);

  const dati = await apiGet("/api/risultati/corridore/" + corridoreId);
  const maglie = document.getElementById("dettaglioMaglie");
  const corpoBody = document.getElementById("dettaglioTappeBody");
  if (!dati || !maglie || !corpoBody) return; // il modale è stato chiuso nel frattempo

  maglie.innerHTML =
    htmlMaglia(
      "maglia rosa (generale)",
      "var(--rosa-maglia)",
      dati.classifiche.generale,
    ) +
    htmlMaglia(
      "maglia ciclamino (punti)",
      "var(--viola)",
      dati.classifiche.punti,
    ) +
    htmlMaglia(
      "maglia verde (montagna)",
      "var(--verde-montagna)",
      dati.classifiche.montagna,
    ) +
    (dati.classifiche.giovani
      ? htmlMaglia(
          "maglia bianca (giovani)",
          "var(--bianca-maglia)",
          dati.classifiche.giovani,
        )
      : "");

  corpoBody.innerHTML =
    dati.risultati
      .map(
        (r) => `
    <tr>
      <td><span class="badge badge-numero">${r.numero_tappa}</span></td>
      <td>${r.tappa_nome} <span class="testo-soft">(${r.partenza} → ${r.arrivo})</span></td>
      <td>${r.posizione ?? "—"}</td>
      <td>${r.tempo ?? "—"}</td>
      <td>${r.punti ?? 0}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" class="stato-vuoto">Nessun risultato ancora registrato</td></tr>`;
}

function renderBiciclette(corpo) {
  sottoTabAttiva = "biciclette";
  montaListaConForm(corpo, {
    titolo: "Biciclette",
    apiPath: "/api/biciclette",
    colonne: [
      { key: "corridore_id", label: "Corridore", type: "corridore" },
      { key: "marca", label: "Marca", type: "text" },
      { key: "modello", label: "Modello", type: "text" },
      { key: "telaio", label: "N. telaio", type: "text" },
    ],
  });
}

export function init(container) {
  creaSottoSchede(
    container,
    [
      { key: "elenco", label: "Elenco corridori" },
      { key: "biciclette", label: "Biciclette" },
    ],
    (key, corpo) => {
      if (key === "elenco") renderElenco(corpo);
      else renderBiciclette(corpo);
    },
  );

  socket.on("corridori:aggiornati", () => {
    if (sottoTabAttiva === "elenco") ricaricaElenco();
  });
}
