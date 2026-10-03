import { apiGet } from "../../core/api.js";
import {
  cache,
  caricaTappe,
  caricaCorridori,
  caricaSquadre,
  caricaNazioni,
  garantisciSponsor,
} from "../../core/state.js";
import { socket } from "../../core/socket.js";
import { icona, iconaValore } from "../../core/icone.js";
import { formattaDataIt, bandiera } from "../../core/utils.js";

let container = null;
let controlliCache = [];
let classifiche = { tempo: [], punti: [], montagna: [] };

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const COLORI_TIPO = {
  pianura: "#10b981",
  collina: "#f59e0b",
  montagna: "#ef4444",
  cronometro: "#0ea5e9",
};
const fmt = (n) => Number(n || 0).toLocaleString("it-IT");

function anello(perc, etichetta) {
  const r = 52,
    c = 2 * Math.PI * r;
  return `<svg class="anello" viewBox="0 0 130 130" role="img" aria-label="${perc}% completato">
    <circle cx="65" cy="65" r="${r}" class="anello-bg"/>
    <circle cx="65" cy="65" r="${r}" class="anello-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - perc / 100)}" transform="rotate(-90 65 65)"/>
    <text x="65" y="62" class="anello-n">${perc}%</text><text x="65" y="82" class="anello-l">${etichetta}</text></svg>`;
}

function donut(parti) {
  const tot = parti.reduce((a, p) => a + p.v, 0);
  if (!tot) return `<p class="testo-soft">Nessun dato disponibile.</p>`;
  const r = 40,
    c = 2 * Math.PI * r;
  let off = 0;
  const archi = parti
    .filter((p) => p.v)
    .map((p) => {
      const len = (p.v / tot) * c;
      const el = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${p.c}" stroke-width="16" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${p.l}: ${p.v}</title></circle>`;
      off += len;
      return el;
    })
    .join("");
  return `<div class="donut-wrap"><svg viewBox="0 0 120 120" class="donut">${archi}<text x="60" y="66" class="anello-n" style="font-size:20px">${tot}</text></svg>
    <ul class="legenda">${parti.map((p) => `<li><i style="background:${p.c}"></i>${p.l}<b>${p.v}</b></li>`).join("")}</ul></div>`;
}

function podio(lista) {
  if (!lista.length)
    return `<p class="testo-soft">La classifica sarà disponibile dopo la prima tappa conclusa.</p>`;
  const ordine = [1, 0, 2].filter((i) => lista[i]);
  return `<div class="podio-dash">${ordine
    .map((i) => {
      const c = lista[i];
      return `<div class="podio-pos pos-${i + 1}"><div class="podio-avatar" style="--c:${esc(c.squadra_colore || "#e91e78")}">${esc((c.nome || "?")[0])}${esc((c.cognome || "")[0])}</div>
      <b>${esc(c.nome)} ${esc(c.cognome)}</b><small>${esc(c.squadra_nome || "")}</small>
      <span class="podio-tempo">${i === 0 ? esc(c.tempo_totale) : esc(c.distacco)}</span><div class="podio-base">${i + 1}</div></div>`;
    })
    .join("")}</div>`;
}

function miniClassifica(lista, campo, unita) {
  if (!lista.length) return `<p class="testo-soft">Nessun dato.</p>`;
  const max = Math.max(...lista.slice(0, 5).map((r) => r[campo] || 0), 1);
  return lista
    .slice(0, 5)
    .map(
      (r, i) => `<div class="mini-riga"><span class="mini-pos">${i + 1}</span>
    <div class="mini-info"><b>${esc(r.nome)} ${esc(r.cognome)}</b><small>${esc(r.squadra_nome || "")}</small>
    <div class="mini-barra"><i style="width:${((r[campo] || 0) / max) * 100}%"></i></div></div>
    <span class="mini-val">${fmt(r[campo])} <small>${unita}</small></span></div>`,
    )
    .join("");
}

function profiloStagione(tappe) {
  if (!tappe.length) return `<p class="testo-soft">Nessuna tappa inserita.</p>`;
  const ord = [...tappe].sort((a, b) => a.numero_tappa - b.numero_tappa);
  const max = Math.max(...ord.map((t) => t.dislivello_m || 0), 1);
  return `<div class="profilo">${ord
    .map(
      (
        t,
      ) => `<div class="profilo-col" title="Tappa ${t.numero_tappa} · ${esc(t.partenza)} → ${esc(t.arrivo)} · ${t.distanza_km} km · +${fmt(t.dislivello_m)} m">
    <span class="profilo-val">${fmt(t.dislivello_m)}</span>
    <div class="profilo-bar ${t.stato}" style="height:${Math.max(((t.dislivello_m || 0) / max) * 100, 4)}%;--c:${COLORI_TIPO[t.tipo] || "#e91e78"}"></div>
    <span class="profilo-n">${t.numero_tappa}</span></div>`,
    )
    .join("")}</div>
    <div class="legenda orizz">${Object.entries(COLORI_TIPO)
      .map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`)
      .join(
        "",
      )}<span class="testo-soft">dislivello (m) per tappa · colori = tipo</span></div>`;
}

function prossimaTappa() {
  return cache.tappe
    .filter((t) => t.stato === "programmata")
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))[0];
}

function tappaInCorso() {
  return cache.tappe.find((t) => t.stato === "in_corso");
}

function render() {
  if (!container) return;

  const totaleTappe = cache.tappe.length;
  const tappeConcluse = cache.tappe.filter(
    (t) => t.stato === "conclusa",
  ).length;
  const inCorso = tappaInCorso();
  const prossima = prossimaTappa();

  const totaleCorridori = cache.corridori.length;
  const ritirati = cache.corridori.filter((c) => c.ritirato).length;
  const inGara = totaleCorridori - ritirati;

  const totaleSquadre = cache.squadre.length;
  const totaleNazioni = cache.nazioni.length;
  const totaleSponsor = cache.sponsor.length;

  const controlliPositivi = controlliCache.filter(
    (c) => c.esito === "positivo",
  ).length;
  const controlliAttesa = controlliCache.filter(
    (c) => c.esito === "in_attesa",
  ).length;

  container.innerHTML = `
    <div class="view-head dashboard-heading">
      <div>
        <span class="eyebrow">CENTRO OPERATIVO · STAGIONE 2025</span>
        <h1>${icona("diretta", "view-icon")}Dashboard</h1>
        <p>Colpo d'occhio sulla corsa: tappe, corridori, squadre e controlli antidoping in tempo reale.</p>
      </div>
      <div class="dashboard-date"><span class="pulse-dot"></span><span>Sincronizzato ora</span></div>
    </div>

    ${
      inCorso
        ? `<div class="banner-maglia" style="margin-bottom:20px;">
            <span class="maglia-dot"></span>
            <div>
              <strong>Tappa ${inCorso.numero_tappa} in corso — ${inCorso.partenza} → ${inCorso.arrivo}</strong>
              <span class="maglia-label">diretta live · ${formattaDataIt(inCorso.data)}</span>
            </div>
          </div>`
        : ""
    }

    <div class="griglia-statistiche">
      <div class="statistica stat-tappe">
        <div class="stat-top"><span class="stat-icon">↗</span><span class="stat-trend">stagione</span></div>
        <div class="numero">${totaleTappe}</div>
        <div class="etichetta">tappe totali</div>
      </div>
      <div class="statistica">
        <div class="numero">${tappeConcluse}</div>
        <div class="etichetta">tappe concluse</div>
      </div>
      <div class="statistica">
        <div class="numero">${inGara}</div>
        <div class="etichetta">corridori in gara</div>
      </div>
      <div class="statistica">
        <div class="numero">${ritirati}</div>
        <div class="etichetta">corridori ritirati</div>
      </div>
      <div class="statistica">
        <div class="numero">${totaleSquadre}</div>
        <div class="etichetta">squadre</div>
      </div>
      <div class="statistica">
        <div class="numero">${totaleNazioni}</div>
        <div class="etichetta">nazioni</div>
      </div>
      <div class="statistica">
        <div class="numero">${totaleSponsor}</div>
        <div class="etichetta">sponsor</div>
      </div>
      <div class="statistica">
        <div class="numero">${controlliPositivi}</div>
        <div class="etichetta">controlli positivi</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card dash-span2"><h3>Maglia rosa · classifica generale</h3><div id="dashPodio"></div></div>
      <div class="card"><h3>Avanzamento stagione</h3><div id="dashAvanzamento"></div></div>
      <div class="card dash-span3"><h3>Profilo della stagione</h3><div id="dashProfilo"></div></div>
      <div class="card"><h3>Punti · maglia ciclamino</h3><div id="dashPunti"></div></div>
      <div class="card"><h3>Gran premio della montagna</h3><div id="dashMontagna"></div></div>
      <div class="card"><h3>Controlli antidoping</h3><div id="dashDoping"></div></div>
    </div>

    <div class="quick-actions">
      <div><span class="eyebrow">AZIONI RAPIDE</span><h2>Gestisci la corsa</h2></div>
      <button class="quick-action" data-quick-view="tappe-elenco"><span>＋</span><b>Nuova tappa</b><small>pianifica il percorso</small></button>
      <button class="quick-action" data-quick-view="corridori-elenco"><span>＋</span><b>Aggiungi corridore</b><small>aggiorna la rosa</small></button>
      <button class="quick-action" data-quick-view="risultati-arrivo"><span>↗</span><b>Inserisci risultato</b><small>chiudi una tappa</small></button>
    </div>

    <div class="griglia-card" style="margin-top:6px;">
      <div class="card" id="dashProssimaTappa"></div>
      <div class="card" id="dashSquadre"></div>
    </div>
  `;

  container.querySelectorAll("[data-quick-view]").forEach((button) => {
    button.addEventListener("click", () =>
      document
        .querySelector(`.nav-item[data-view="${button.dataset.quickView}"]`)
        ?.click(),
    );
  });

  const boxProssima = document.getElementById("dashProssimaTappa");
  if (prossima) {
    boxProssima.innerHTML = `
      <h3 style="margin-bottom:10px;">Prossima tappa</h3>
      <p class="testo-soft" style="margin-bottom:12px;">
        Tappa ${prossima.numero_tappa} — ${prossima.partenza} → ${prossima.arrivo}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="badge badge-${prossima.stato}">${iconaValore(prossima.stato)}${prossima.stato.replace("_", " ")}</span>
        <span class="badge badge-numero">${formattaDataIt(prossima.data)}</span>
        ${prossima.tipo ? `<span class="badge badge-${prossima.tipo}">${iconaValore(prossima.tipo)}${prossima.tipo}</span>` : ""}
      </div>
    `;
  } else {
    boxProssima.innerHTML = `
      <h3 style="margin-bottom:10px;">Prossima tappa</h3>
      <p class="testo-soft">Nessuna tappa in programma al momento.</p>
    `;
  }

  const boxSquadre = document.getElementById("dashSquadre");
  const topSquadre = [...cache.squadre]
    .sort((a, b) => (b.numero_corridori ?? 0) - (a.numero_corridori ?? 0))
    .slice(0, 5);
  boxSquadre.innerHTML = `
    <h3 style="margin-bottom:10px;">Squadre più numerose</h3>
    ${
      topSquadre.length
        ? topSquadre
            .map(
              (s) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bordo,#eee);">
        <span><span class="dot-colore" style="background:${s.colore || "#e6197f"}"></span>${s.nome}${s.nazione_codice ? ` ${bandiera(s.nazione_codice, 15)}` : ""}</span>
        <span class="testo-soft">${s.numero_corridori ?? 0} corridori</span>
      </div>`,
            )
            .join("")
        : `<p class="testo-soft">Nessuna squadra inserita.</p>`
    }
    ${controlliAttesa ? `<p class="testo-soft" style="margin-top:12px;">${controlliAttesa} controllo/i antidoping in attesa di esito.</p>` : ""}
  `;

  const kmTot = cache.tappe.reduce((a, t) => a + (t.distanza_km || 0), 0);
  const kmFatti = cache.tappe
    .filter((t) => t.stato === "conclusa")
    .reduce((a, t) => a + (t.distanza_km || 0), 0);
  const perc = totaleTappe
    ? Math.round((tappeConcluse / totaleTappe) * 100)
    : 0;
  const set = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  set("dashPodio", podio(classifiche.tempo));
  set(
    "dashAvanzamento",
    `<div class="avanz">${anello(perc, "tappe")}<div><b>${tappeConcluse}</b> / ${totaleTappe} tappe<br><b>${fmt(Math.round(kmFatti))}</b> / ${fmt(Math.round(kmTot))} km<br><span class="testo-soft">${inCorso ? "Tappa in corso" : prossima ? "Prossima: tappa " + prossima.numero_tappa : "Stagione conclusa"}</span></div></div>`,
  );
  set("dashProfilo", profiloStagione(cache.tappe));
  set("dashPunti", miniClassifica(classifiche.punti, "punti_totali", "pt"));
  set(
    "dashMontagna",
    miniClassifica(classifiche.montagna, "punti_totali", "pt"),
  );
  const conta = (e) => controlliCache.filter((c) => c.esito === e).length;
  set(
    "dashDoping",
    donut([
      { l: "negativi", v: conta("negativo"), c: "#10b981" },
      { l: "in attesa", v: conta("in_attesa"), c: "#f59e0b" },
      { l: "positivi", v: conta("positivo"), c: "#ef4444" },
    ]),
  );
}

async function ricaricaClassifiche() {
  const prendi = (u) => apiGet(u).catch(() => []);
  const [tempo, punti, montagna] = await Promise.all([
    prendi("/api/risultati/classifica-tempo"),
    prendi("/api/risultati/classifica-generale"),
    prendi("/api/risultati/classifica-montagna"),
  ]);
  classifiche = { tempo, punti, montagna };
  render();
}

async function ricaricaControlli() {
  try {
    controlliCache = await apiGet("/api/controlli-antidoping");
  } catch {
    controlliCache = [];
  }
  render();
}

export function init(cont) {
  container = cont;
  render();

  Promise.all([
    caricaTappe(),
    caricaCorridori(),
    caricaSquadre(),
    caricaNazioni(),
    garantisciSponsor(),
  ])
    .then(render)
    .catch(() => {});
  ricaricaControlli();
  ricaricaClassifiche();

  socket.on("tappe:aggiornate", render);
  socket.on("risultati:aggiornati", ricaricaClassifiche);
  socket.on("corridori:aggiornati", render);
  socket.on("squadre:aggiornate", render);
  socket.on("nazioni:aggiornate", render);
  socket.on("controlli-antidoping:aggiornati", ricaricaControlli);
}
