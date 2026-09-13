// Popola il database con dati di esempio realistici e coerenti per tutte le 20 tabelle.
// Esegui con: node seed.js — è idempotente: ripulisce le tabelle e le reinserisce da zero,
// quindi può essere lanciato più volte senza errori di UNIQUE/duplicati.
const db = require("./db/database");

// ---------------------------------------------------------------------------
// Helper promise-based per sqlite3 + PRNG con seed fisso (dati "casuali" ma riproducibili)
// ---------------------------------------------------------------------------
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
function creaRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rnd = creaRandom(190426);
const scegli = (arr) => arr[Math.floor(rnd() * arr.length)];
const interoTra = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const decimaleTra = (min, max, cifre = 1) =>
  +(min + rnd() * (max - min)).toFixed(cifre);
function mescola(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function secondiInHms(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  return [h, m, r].map((v) => String(v).padStart(2, "0")).join(":");
}
function sommaData(dataBase, giorni) {
  const d = new Date(dataBase);
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1) NAZIONI — anagrafica già presente con bandiera calcolata dal codice ISO2
//    (nessuna immagine: la bandiera è un'emoji derivata a runtime nel frontend)
// ---------------------------------------------------------------------------
const nazioni = [
  ["Italia", "IT"],
  ["Francia", "FR"],
  ["Belgio", "BE"],
  ["Spagna", "ES"],
  ["Paesi Bassi", "NL"],
  ["Germania", "DE"],
  ["Svizzera", "CH"],
  ["Slovenia", "SI"],
  ["Norvegia", "NO"],
  ["Danimarca", "DK"],
  ["Regno Unito", "GB"],
  ["Irlanda", "IE"],
  ["Portogallo", "PT"],
  ["Polonia", "PL"],
  ["Austria", "AT"],
  ["Colombia", "CO"],
  ["Stati Uniti", "US"],
  ["Australia", "AU"],
  ["Canada", "CA"],
  ["Ecuador", "EC"],
  ["Slovacchia", "SK"],
  ["Repubblica Ceca", "CZ"],
  ["Kazakhstan", "KZ"],
  ["Ucraina", "UA"],
  ["Lettonia", "LV"],
  ["Estonia", "EE"],
  ["Lituania", "LT"],
  ["Svezia", "SE"],
  ["Finlandia", "FI"],
  ["Ungheria", "HU"],
  ["Croazia", "HR"],
  ["Eritrea", "ER"],
  ["Sudafrica", "ZA"],
  ["Ruanda", "RW"],
  ["Giappone", "JP"],
  ["Nuova Zelanda", "NZ"],
  ["Brasile", "BR"],
  ["Argentina", "AR"],
  ["Venezuela", "VE"],
  ["Messico", "MX"],
];

// ---------------------------------------------------------------------------
// 2) SQUADRE — 10 formazioni invenzione, ciascuna con nazione e colore sociale
// ---------------------------------------------------------------------------
const squadre = [
  ["Team Asfalto Rosa", "IT", "#e6197f"],
  ["Montagna Verde Cycling", "FR", "#2e7d46"],
  ["Vento del Nord", "BE", "#1565c0"],
  ["Ibérica Pro Team", "ES", "#ff6b00"],
  ["Alpine Riders", "CH", "#c1272d"],
  ["Orange Wheels", "NL", "#e07a00"],
  ["Nordic Bike Team", "NO", "#003087"],
  ["Andes Cycling Colombia", "CO", "#e0b400"],
  ["Stars & Stripes Racing", "US", "#1c3f94"],
  ["Rising Sun Velo", "JP", "#bc002d"],
];

// pool di nomi/cognomi plausibili per nazionalità dei corridori di ogni squadra
const poolNomi = {
  IT: {
    nomi: [
      "Marco",
      "Luca",
      "Matteo",
      "Andrea",
      "Davide",
      "Simone",
      "Alessandro",
      "Giovanni",
    ],
    cognomi: [
      "Rossi",
      "Bianchi",
      "Ferrari",
      "Ricci",
      "Marino",
      "Conti",
      "Esposito",
      "Romano",
    ],
  },
  FR: {
    nomi: [
      "Julien",
      "Thomas",
      "Pierre",
      "Antoine",
      "Nicolas",
      "Hugo",
      "Louis",
      "Maxime",
    ],
    cognomi: [
      "Moreau",
      "Dubois",
      "Lefevre",
      "Girard",
      "Bonnet",
      "Faure",
      "Roux",
      "Blanc",
    ],
  },
  BE: {
    nomi: ["Wout", "Tim", "Jasper", "Dries", "Bram", "Sander", "Niels", "Kobe"],
    cognomi: [
      "Peeters",
      "Claes",
      "Janssens",
      "Willems",
      "Maes",
      "Wouters",
      "De Smet",
      "Goossens",
    ],
  },
  ES: {
    nomi: [
      "Alejandro",
      "Rodrigo",
      "Diego",
      "Pablo",
      "Carlos",
      "Iker",
      "Mikel",
      "Adrian",
    ],
    cognomi: [
      "Vega",
      "Torres",
      "Molina",
      "Serrano",
      "Ortiz",
      "Cabrera",
      "Navarro",
      "Blanco",
    ],
  },
  CH: {
    nomi: [
      "Stefan",
      "Reto",
      "Fabian",
      "Marc",
      "Beat",
      "Silvan",
      "Lukas",
      "Nino",
    ],
    cognomi: [
      "Meier",
      "Keller",
      "Baumann",
      "Frei",
      "Huber",
      "Steiner",
      "Zimmermann",
      "Brunner",
    ],
  },
  NL: {
    nomi: [
      "Jasper",
      "Mathieu",
      "Bram",
      "Daan",
      "Tijs",
      "Wesley",
      "Lars",
      "Nick",
    ],
    cognomi: [
      "de Vries",
      "Bakker",
      "Visser",
      "Smit",
      "Mulder",
      "de Boer",
      "Dekker",
      "Kuipers",
    ],
  },
  NO: {
    nomi: [
      "Erik",
      "Magnus",
      "Sondre",
      "Odin",
      "Henrik",
      "Kristian",
      "Jonas",
      "Vetle",
    ],
    cognomi: [
      "Hansen",
      "Johansen",
      "Berg",
      "Andersen",
      "Solberg",
      "Dahl",
      "Haugen",
      "Nilsen",
    ],
  },
  CO: {
    nomi: [
      "Diego",
      "Camilo",
      "Esteban",
      "Julian",
      "Sergio",
      "Nairo",
      "Rigo",
      "Fernando",
    ],
    cognomi: [
      "Gomez",
      "Ramirez",
      "Cardenas",
      "Rojas",
      "Munoz",
      "Perez",
      "Duarte",
      "Correa",
    ],
  },
  US: {
    nomi: [
      "Ryan",
      "Tyler",
      "Cole",
      "Brandon",
      "Austin",
      "Jordan",
      "Chase",
      "Grant",
    ],
    cognomi: [
      "Smith",
      "Johnson",
      "Carter",
      "Bennett",
      "Foster",
      "Coleman",
      "Parker",
      "Reed",
    ],
  },
  JP: {
    nomi: [
      "Kenji",
      "Hiroshi",
      "Takashi",
      "Yuto",
      "Ryo",
      "Sota",
      "Daiki",
      "Kaito",
    ],
    cognomi: [
      "Sato",
      "Tanaka",
      "Suzuki",
      "Yamamoto",
      "Nakamura",
      "Kobayashi",
      "Watanabe",
      "Ito",
    ],
  },
};

const marcheBici = [
  "Pinarello",
  "Specialized",
  "Trek",
  "Cannondale",
  "Colnago",
  "BMC",
  "Scott",
  "Canyon",
  "Bianchi",
  "Wilier",
];
const modelliBici = [
  "Dogma F",
  "Tarmac SL8",
  "Madone SLR",
  "SuperSix Evo",
  "V4Rs",
  "Teammachine SLR01",
  "Foil RC",
  "Aeroad CFR",
  "Oltre RC",
  "Filante SLR",
];

const sponsor = [
  [
    "VelocItalia Assicurazioni",
    "assicurazioni",
    "https://example.com/velocitalia",
  ],
  [
    "MontagnaBike Componenti",
    "componentistica",
    "https://example.com/montagnabike",
  ],
  ["AquaPura Bevande", "bevande", "https://example.com/aquapura"],
  [
    "EnergiaViva Barrette",
    "nutrizione sportiva",
    "https://example.com/energiaviva",
  ],
  [
    "RotaLibera Pneumatici",
    "componentistica",
    "https://example.com/rotalibera",
  ],
  [
    "BancaSprint Credito",
    "servizi finanziari",
    "https://example.com/bancasprint",
  ],
  [
    "OrologiRapidi Cronometraggio",
    "elettronica sportiva",
    "https://example.com/orologirapidi",
  ],
  ["GreenWatt Energia", "energia", "https://example.com/greenwatt"],
];

const veicoliPerSquadra = [
  ["ammiraglia", "Skoda Superb"],
  ["furgone", "Volkswagen Transporter"],
  ["bus", "Mercedes Sprinter Team Bus"],
];

const cittaHotel = [
  "Roma",
  "Frascati",
  "Terracina",
  "L'Aquila",
  "Perugia",
  "Firenze",
  "Bologna",
  "Modena",
  "Verona",
  "Trento",
  "Bolzano",
  "Milano",
];

const ruoliStaff = [
  "direttore_sportivo",
  "meccanico",
  "medico",
  "massaggiatore",
  "preparatore_atletico",
];

const classificheTipo = [
  ["Generale", "Classifica a tempo cumulato"],
  ["Punti (maglia ciclamino)", "Classifica a punti per volate e piazzamenti"],
  ["Scalatori (GPM)", "Classifica a punti sui gran premi della montagna"],
  ["Giovani", "Migliore classificato under 25"],
  ["Squadre", "Somma dei migliori tempi di squadra"],
];

// ---------------------------------------------------------------------------
// 3) TAPPE — corsa a tappe completa, 12 frazioni tra pianura, collina, montagna e cronometro
// ---------------------------------------------------------------------------
const dataInizio = "2026-05-09";
const percorsoTappe = [
  ["Roma – Frascati", "Roma", "Frascati", "collina"],
  ["Frascati – Terracina", "Frascati", "Terracina", "pianura"],
  ["Cronometro di Terracina", "Terracina", "Terracina", "cronometro"],
  ["Terracina – Gran Sasso", "Terracina", "Gran Sasso", "montagna"],
  ["Gran Sasso – L'Aquila", "Gran Sasso", "L'Aquila", "collina"],
  ["L'Aquila – Perugia", "L'Aquila", "Perugia", "pianura"],
  ["Perugia – Firenze", "Perugia", "Firenze", "collina"],
  ["Firenze – Bologna", "Firenze", "Bologna", "pianura"],
  ["Cronometro di Modena", "Bologna", "Modena", "cronometro"],
  ["Modena – Verona", "Modena", "Verona", "pianura"],
  ["Verona – Passo Pordoi", "Verona", "Passo Pordoi", "montagna"],
  ["Passo Pordoi – Milano", "Passo Pordoi", "Milano", "pianura"],
];
const distanzePerTipo = {
  pianura: [150, 210],
  collina: [140, 190],
  montagna: [180, 230],
  cronometro: [18, 32],
};
const dislivelloPerTipo = {
  pianura: [150, 500],
  collina: [900, 2200],
  montagna: [3200, 4800],
  cronometro: [80, 350],
};

const condizioniMeteo = [
  "sereno",
  "nuvoloso",
  "pioggia",
  "vento_forte",
  "neve",
];

// ---------------------------------------------------------------------------
// Esecuzione seed (async/await, sequenziale e idempotente)
// ---------------------------------------------------------------------------
async function main() {
  await new Promise((r) => setTimeout(r, 300)); // attende la creazione dello schema

  console.log("🧹 Pulizia tabelle esistenti...");
  const tabelleInOrdine = [
    "comunicati_stampa",
    "media_accreditati",
    "meteo_tappa",
    "hotel",
    "veicoli_squadra",
    "squadra_sponsor",
    "sponsor",
    "biciclette",
    "controlli_antidoping",
    "penalita",
    "gpm_risultati",
    "traguardi_volanti",
    "classifiche_tipo",
    "risultati",
    "tappe_percorso",
    "tappe",
    "staff_tecnico",
    "corridori",
    "squadre",
    "nazioni",
  ];
  for (const t of tabelleInOrdine) await run(`DELETE FROM ${t}`);
  await run(
    "DELETE FROM sqlite_sequence WHERE name IN ('comunicati_stampa','media_accreditati','meteo_tappa','hotel','veicoli_squadra','squadra_sponsor','sponsor','biciclette','controlli_antidoping','penalita','gpm_risultati','traguardi_volanti','classifiche_tipo','risultati','tappe_percorso','tappe','staff_tecnico','corridori','squadre','nazioni')",
  );

  // ---- 1) Nazioni --------------------------------------------------------
  console.log("🌍 Nazioni (con bandiera preimpostata dal codice ISO2)...");
  for (const [nome, codice] of nazioni)
    await run("INSERT INTO nazioni (nome, codice_iso2) VALUES (?, ?)", [
      nome,
      codice.toUpperCase().trim(),
    ]);
  const righeNazioni = await all(
    "SELECT id, UPPER(TRIM(codice_iso2)) AS codice_iso2 FROM nazioni",
  );
  const idNazione = {};
  righeNazioni.forEach((r) => (idNazione[r.codice_iso2] = r.id));

  // ---- 2) Squadre ----------------------------------------------------------
  console.log("🚴 Squadre...");
  const idSquadra = [];
  for (const [nome, codice, colore] of squadre) {
    const res = await run(
      "INSERT INTO squadre (nome, nazione_id, colore) VALUES (?, ?, ?)",
      [nome, idNazione[codice], colore],
    );
    idSquadra.push({ id: res.lastID, nome, codice, colore });
  }

  // ---- 3) Corridori (6 per squadra = 60 totali) + biciclette --------------
  console.log("🧑\u200d🚴 Corridori e biciclette...");
  const corridori = []; // { id, squadraId, codiceNazione, livello }
  for (let i = 0; i < idSquadra.length; i++) {
    const sq = idSquadra[i];
    const pool = poolNomi[sq.codice];
    const nomiUsati = mescola(pool.nomi);
    const cognomiUsati = mescola(pool.cognomi);
    for (let p = 0; p < 6; p++) {
      const nome = nomiUsati[p % nomiUsati.length];
      const cognome = cognomiUsati[p % cognomiUsati.length];
      const pettorale = (i + 1) * 10 + p + 1; // es. squadra 1 -> 11..16, squadra 2 -> 21..26...
      const nascita = `${interoTra(1992, 2003)}-${String(interoTra(1, 12)).padStart(2, "0")}-${String(interoTra(1, 28)).padStart(2, "0")}`;
      const res = await run(
        "INSERT INTO corridori (nome, cognome, numero_pettorale, nazione_id, squadra_id, data_nascita) VALUES (?, ?, ?, ?, ?, ?)",
        [nome, cognome, pettorale, idNazione[sq.codice], sq.id, nascita],
      );
      const livello = p === 0 ? interoTra(85, 99) : interoTra(55, 90); // il corridore #1 di ogni squadra è il capitano
      corridori.push({
        id: res.lastID,
        squadraId: sq.id,
        codiceNazione: sq.codice,
        livello,
        nome,
        cognome,
      });

      await run(
        "INSERT INTO biciclette (corridore_id, marca, modello, telaio) VALUES (?, ?, ?, ?)",
        [
          res.lastID,
          scegli(marcheBici),
          scegli(modelliBici),
          "TL" + interoTra(100000, 999999),
        ],
      );
    }
  }

  // ---- 4) Staff tecnico (2 per squadra) e veicoli (3 per squadra) ---------
  console.log("🛠️  Staff tecnico e veicoli...");
  for (const sq of idSquadra) {
    const pool = poolNomi[sq.codice];
    await run(
      "INSERT INTO staff_tecnico (nome, cognome, ruolo, squadra_id) VALUES (?, ?, ?, ?)",
      [scegli(pool.nomi), scegli(pool.cognomi), "direttore_sportivo", sq.id],
    );
    await run(
      "INSERT INTO staff_tecnico (nome, cognome, ruolo, squadra_id) VALUES (?, ?, ?, ?)",
      [
        scegli(pool.nomi),
        scegli(pool.cognomi),
        scegli(ruoliStaff.filter((r) => r !== "direttore_sportivo")),
        sq.id,
      ],
    );

    for (const [tipo, modello] of veicoliPerSquadra) {
      const targa = `${scegli(["AB", "CD", "EF", "GH", "LM"])}${interoTra(100, 999)}${scegli(["XY", "ZK", "QR"])}`;
      await run(
        "INSERT INTO veicoli_squadra (squadra_id, tipo, targa, modello) VALUES (?, ?, ?, ?)",
        [sq.id, tipo, targa, modello],
      );
    }
  }

  // ---- 5) Sponsor + relazione squadra_sponsor ------------------------------
  console.log("🏷️  Sponsor...");
  const idSponsor = [];
  for (const [nome, settore, sito] of sponsor) {
    const res = await run(
      "INSERT INTO sponsor (nome, settore, sito_web) VALUES (?, ?, ?)",
      [nome, settore, sito],
    );
    idSponsor.push(res.lastID);
  }
  for (let i = 0; i < idSquadra.length; i++) {
    const main = idSponsor[i % idSponsor.length];
    const co = idSponsor[(i + 3) % idSponsor.length];
    await run(
      "INSERT INTO squadra_sponsor (squadra_id, sponsor_id, tipo) VALUES (?, ?, ?)",
      [idSquadra[i].id, main, "main_sponsor"],
    );
    if (co !== main)
      await run(
        "INSERT INTO squadra_sponsor (squadra_id, sponsor_id, tipo) VALUES (?, ?, ?)",
        [idSquadra[i].id, co, "co_sponsor"],
      );
  }

  // ---- 6) Tappe, percorso (sprint/GPM) e meteo -----------------------------
  console.log("🗺️  Tappe, percorso e meteo...");
  const idTappa = [];
  for (let i = 0; i < percorsoTappe.length; i++) {
    const [nome, partenza, arrivo, tipo] = percorsoTappe[i];
    const [dMin, dMax] = distanzePerTipo[tipo];
    const [hMin, hMax] = dislivelloPerTipo[tipo];
    const distanza = decimaleTra(dMin, dMax, 1);
    const dislivello = interoTra(hMin, hMax);
    const data = sommaData(dataInizio, i);
    const stato = i < 2 ? "conclusa" : i === 2 ? "in_corso" : "programmata";
    const res = await run(
      "INSERT INTO tappe (numero_tappa, nome, partenza, arrivo, distanza_km, dislivello_m, tipo, data, stato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [i + 1, nome, partenza, arrivo, distanza, dislivello, tipo, data, stato],
    );
    idTappa.push({ id: res.lastID, numero: i + 1, tipo, distanza, nome });

    await run(
      "INSERT INTO meteo_tappa (tappa_id, temperatura, condizione, vento_kmh) VALUES (?, ?, ?, ?)",
      [
        res.lastID,
        decimaleTra(8, 29, 1),
        scegli(condizioniMeteo),
        decimaleTra(3, 42, 1),
      ],
    );

    if (tipo === "collina" || tipo === "montagna") {
      const nPunti = tipo === "montagna" ? 2 : 1;
      for (let g = 0; g < nPunti; g++) {
        await run(
          "INSERT INTO tappe_percorso (tappa_id, km, tipo, nome_luogo, categoria) VALUES (?, ?, ?, ?, ?)",
          [
            res.lastID,
            decimaleTra(20, distanza - 10, 1),
            "gpm",
            scegli([
              "Monte Cavo",
              "Colle San Marco",
              "Passo delle Radici",
              "Forcella di Lares",
              "Colle del Nivolet",
            ]),
            scegli(["1", "2", "3", "HC"]),
          ],
        );
      }
    }
    if (tipo === "pianura" || tipo === "collina") {
      await run(
        "INSERT INTO tappe_percorso (tappa_id, km, tipo, nome_luogo, categoria) VALUES (?, ?, ?, ?, ?)",
        [
          res.lastID,
          decimaleTra(distanza * 0.3, distanza * 0.7, 1),
          "sprint",
          scegli([
            "Piazza del Popolo",
            "Corso Vittorio",
            "Lungomare Centrale",
            "Via Roma",
          ]),
          null,
        ],
      );
    }
  }

  // ---- 7) Risultati, traguardi volanti e GPM per le prime 6 tappe ----------
  console.log("🏁 Risultati di tappa, traguardi volanti e GPM...");
  const puntiPerPosizione = [
    50, 40, 32, 26, 22, 18, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
  ];
  const puntiIntermedi = [8, 5, 2];
  const tappeConRisultati = idTappa.slice(0, 6);

  for (const tappa of tappeConRisultati) {
    // ordina i corridori: chi ha più "livello" + un fattore casuale finisce più avanti
    const classificaTappa = mescola(corridori)
      .map((c) => ({ ...c, punteggioGara: c.livello + rnd() * 30 }))
      .sort((a, b) => b.punteggioGara - a.punteggioGara);

    const baseSecondi = {
      pianura: 16200,
      collina: 17400,
      montagna: 19800,
      cronometro: 2100,
    }[tappa.tipo];
    let secondiAccumulati = 0;
    const risultatiTappa = [];

    for (let pos = 0; pos < classificaTappa.length; pos++) {
      const c = classificaTappa[pos];
      const gapExtra =
        pos === 0 ? 0 : interoTra(2, tappa.tipo === "montagna" ? 45 : 20);
      secondiAccumulati += gapExtra;
      const tempoTotale = baseSecondi + secondiAccumulati;
      const punti = puntiPerPosizione[pos] ?? 0;
      await run(
        `INSERT INTO risultati (tappa_id, corridore_id, posizione, tempo, distacco, punti) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tappa.id,
          c.id,
          pos + 1,
          secondiInHms(tempoTotale),
          pos === 0 ? "00:00:00" : "+" + secondiInHms(secondiAccumulati),
          punti,
        ],
      );
      risultatiTappa.push({ ...c, posizione: pos + 1 });
    }

    if (tappa.tipo === "pianura" || tappa.tipo === "collina") {
      const podioSprint = mescola(risultatiTappa.slice(0, 12)).slice(0, 3);
      for (let k = 0; k < podioSprint.length; k++) {
        await run(
          "INSERT INTO traguardi_volanti (tappa_id, corridore_id, posizione, punti) VALUES (?, ?, ?, ?)",
          [tappa.id, podioSprint[k].id, k + 1, puntiIntermedi[k]],
        );
      }
    }
    if (tappa.tipo === "collina" || tappa.tipo === "montagna") {
      const podioGpm = mescola(risultatiTappa.slice(0, 12)).slice(0, 3);
      for (let k = 0; k < podioGpm.length; k++) {
        await run(
          "INSERT INTO gpm_risultati (tappa_id, corridore_id, posizione, punti) VALUES (?, ?, ?, ?)",
          [tappa.id, podioGpm[k].id, k + 1, puntiIntermedi[k]],
        );
      }
    }
  }

  // ---- 8) Classifiche tipo --------------------------------------------------
  console.log("🏆 Tipi di classifica...");
  for (const c of classificheTipo)
    await run(
      "INSERT INTO classifiche_tipo (nome, descrizione) VALUES (?, ?)",
      c,
    );

  // ---- 9) Penalità e controlli antidoping -----------------------------------
  console.log("⚖️  Penalità e controlli antidoping...");
  const motiviPenalita = [
    "sgancio ritardato in volata",
    "aiuto esterno non autorizzato",
    "deviazione dal percorso",
    "traino irregolare da ammiraglia",
    "ostruzione ad altro corridore",
    "partenza anticipata al via",
  ];
  for (let i = 0; i < 8; i++) {
    const c = scegli(corridori);
    const t = scegli(tappeConRisultati);
    await run(
      "INSERT INTO penalita (corridore_id, tappa_id, motivo, secondi, punti) VALUES (?, ?, ?, ?, ?)",
      [
        c.id,
        t.id,
        scegli(motiviPenalita),
        scegli([0, 0, 10, 20, 30]),
        scegli([0, 0, 0, 5]),
      ],
    );
  }

  // Esiti "di routine": niente "positivo" qui, perché quel caso viene
  // seminato più sotto in modo esplicito e collegato alla squalifica
  // automatica del corridore (così il dato resta sempre coerente: un
  // controllo positivo senza conseguenze sportive sarebbe un errore).
  const esiti = [
    "negativo",
    "negativo",
    "negativo",
    "negativo",
    "in_attesa",
    "in_attesa",
  ];
  for (let i = 0; i < 15; i++) {
    const c = scegli(corridori);
    const t = scegli(idTappa);
    await run(
      "INSERT INTO controlli_antidoping (corridore_id, tappa_id, data, esito) VALUES (?, ?, ?, ?)",
      [c.id, t.id, sommaData(dataInizio, t.numero - 1), scegli(esiti)],
    );
  }

  // ---- 9bis) Ritiri di esempio: tutti i casi possibili -----------------------
  // Copre in modo esplicito ogni motivo di ritiro previsto dallo schema
  // (infortunio, abbandono, squalifica, altro) più il caso "squalifica
  // automatica da doping", per avere sempre nel database dimostrativo
  // almeno un esempio di ciascuna casistica: da questo momento questi
  // corridori non sono più selezionabili per le tappe successive e
  // spariscono da tutte le classifiche, pur mantenendo lo storico dei
  // risultati già ottenuti nelle prime tappe.
  console.log("🚑 Ritiri di esempio (infortunio, abbandono, squalifica, altro)...");
  const candidatiRitiro = mescola(corridori);

  // Caso "abbandono in corsa": il ritiro avviene proprio durante una
  // tappa già disputata (tappa 4), non tra una tappa e l'altra. Il
  // risultato di quella tappa quindi non è un arrivo regolare ma un DNF
  // (nessuna posizione/tempo, come farebbe un utente dall'app segnando
  // il ritiro "dalla tappa 4" e poi inserendo comunque la riga di quella
  // tappa senza posizione); dalla tappa successiva in poi non ha più
  // nessun risultato, perché non è più partito.
  console.log("🚑 Ritiro in corsa durante una tappa già disputata...");
  const corridoreRitiroInCorsa = candidatiRitiro[0];
  const tappaRitiroInCorsa = tappeConRisultati[3]; // tappa 4
  await run(
    `UPDATE risultati SET posizione = NULL, tempo = NULL, distacco = NULL, punti = 0
     WHERE tappa_id = ? AND corridore_id = ?`,
    [tappaRitiroInCorsa.id, corridoreRitiroInCorsa.id],
  );
  for (const tappaSuccessiva of tappeConRisultati.slice(4)) {
    await run(
      "DELETE FROM risultati WHERE tappa_id = ? AND corridore_id = ?",
      [tappaSuccessiva.id, corridoreRitiroInCorsa.id],
    );
    await run(
      "DELETE FROM traguardi_volanti WHERE tappa_id = ? AND corridore_id = ?",
      [tappaSuccessiva.id, corridoreRitiroInCorsa.id],
    );
    await run(
      "DELETE FROM gpm_risultati WHERE tappa_id = ? AND corridore_id = ?",
      [tappaSuccessiva.id, corridoreRitiroInCorsa.id],
    );
  }
  await run(
    `UPDATE corridori SET
       ritirato = 1, ritirato_tappa_numero = ?, motivo_ritiro = 'infortunio',
       note_ritiro = ?, ritirato_il = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      tappaRitiroInCorsa.numero,
      "Caduta a metà tappa, non ha completato la frazione",
      corridoreRitiroInCorsa.id,
    ],
  );

  // Altri motivi di ritiro: decisi "tra una tappa e l'altra" (come farebbe
  // normalmente un utente dall'app), quindi da una tappa futura in poi;
  // le tappe già disputate restano con il loro risultato regolare.
  const ritiriEsempio = [
    {
      corridore: candidatiRitiro[1],
      motivo: "abbandono",
      dallaTappa: 8,
      note: "Non è nelle condizioni per proseguire la corsa",
    },
    {
      corridore: candidatiRitiro[2],
      motivo: "squalifica",
      dallaTappa: 9,
      note: "Squalificato dalla giuria per comportamento antisportivo in volata",
    },
    {
      corridore: candidatiRitiro[3],
      motivo: "altro",
      dallaTappa: 10,
      note: "Motivi personali",
    },
  ];
  for (const r of ritiriEsempio) {
    await run(
      `UPDATE corridori SET
         ritirato = 1, ritirato_tappa_numero = ?, motivo_ritiro = ?,
         note_ritiro = ?, ritirato_il = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [r.dallaTappa, r.motivo, r.note, r.corridore.id],
    );
  }

  // Caso "controllo antidoping positivo" → squalifica automatica: il
  // corridore risulta positivo al controllo dell'ultima tappa già
  // disputata e, di conseguenza, non parte più dalla tappa successiva.
  console.log("🧪 Caso doping positivo, con squalifica automatica collegata...");
  const corridoreDoping = candidatiRitiro[4];
  const tappaControlloDoping = tappeConRisultati[tappeConRisultati.length - 1];
  await run(
    "INSERT INTO controlli_antidoping (corridore_id, tappa_id, data, esito) VALUES (?, ?, ?, ?)",
    [
      corridoreDoping.id,
      tappaControlloDoping.id,
      sommaData(dataInizio, tappaControlloDoping.numero - 1),
      "positivo",
    ],
  );
  await run(
    `UPDATE corridori SET
       ritirato = 1, ritirato_tappa_numero = ?, motivo_ritiro = 'squalifica',
       note_ritiro = ?, ritirato_il = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      tappaControlloDoping.numero + 1,
      `Squalifica automatica: controllo antidoping positivo (tappa ${tappaControlloDoping.numero})`,
      corridoreDoping.id,
    ],
  );

  // ---- 10) Alloggi (hotel per squadra sulle prime tappe) ---------------------
  console.log("🏨 Alloggi...");
  for (const tappa of idTappa.slice(0, 3)) {
    for (const sq of idSquadra) {
      await run(
        "INSERT INTO hotel (tappa_id, squadra_id, nome, citta, indirizzo) VALUES (?, ?, ?, ?, ?)",
        [
          tappa.id,
          sq.id,
          `Hotel ${scegli(["Corona", "Belvedere", "Panorama", "Centrale", "Imperiale", "Stazione"])}`,
          scegli(cittaHotel),
          `Via ${scegli(["Roma", "Garibaldi", "Dante", "Verdi", "Mazzini"])}, ${interoTra(1, 120)}`,
        ],
      );
    }
  }

  // ---- 11) Stampa: media accreditati e comunicati ----------------------------
  console.log("📰 Media accreditati e comunicati stampa...");
  const testate = [
    "Gazzetta del Ciclismo",
    "Radio Corsa Live",
    "CicloTV Nazionale",
    "FotoSprint Agency",
    "PedalaOnline",
    "Corriere delle Due Ruote",
    "EuroCycling News",
    "VeloPress International",
  ];
  const tipiMedia = ["stampa", "tv", "radio", "foto", "online"];
  for (let i = 0; i < 12; i++) {
    const pool = poolNomi[scegli(Object.keys(poolNomi))];
    await run(
      "INSERT INTO media_accreditati (nome, testata, tipo, tappa_id) VALUES (?, ?, ?, ?)",
      [
        `${scegli(pool.nomi)} ${scegli(pool.cognomi)}`,
        scegli(testate),
        scegli(tipiMedia),
        scegli(idTappa).id,
      ],
    );
  }

  const comunicati = [
    [
      "Al via la corsa: presentate le 12 tappe",
      "La corsa scatta da Roma con dodici frazioni che attraverseranno l'intero Paese fino all'arrivo di Milano.",
    ],
    [
      "Grande attesa per la cronometro di Terracina",
      "Gli specialisti si preparano per la prima prova contro il tempo della corsa.",
    ],
    [
      "Maltempo in vista sulle tappe di montagna",
      "Gli organizzatori monitorano le previsioni meteo per le tappe alpine.",
    ],
    [
      "Accrediti stampa: aperte le richieste per la stampa internazionale",
      "Cresce l'interesse dei media esteri per l'edizione di quest'anno.",
    ],
    [
      "Controlli antidoping rafforzati per questa edizione",
      "La commissione ha intensificato i controlli su tutte le tappe in programma.",
    ],
    [
      "Sponsor tecnici confermati per tutte le squadre",
      "Le principali squadre hanno ufficializzato i propri sponsor tecnici e commerciali.",
    ],
  ];
  for (let i = 0; i < comunicati.length; i++) {
    const [titolo, contenuto] = comunicati[i];
    await run(
      "INSERT INTO comunicati_stampa (titolo, contenuto, data, tappa_id) VALUES (?, ?, ?, ?)",
      [
        titolo,
        contenuto,
        sommaData(dataInizio, i),
        idTappa[Math.min(i, idTappa.length - 1)].id,
      ],
    );
  }

  // ---- 12) Normalizzazione finale codici ISO2 ------------------------------
  // Difensivo: assicura che tutti i codici nel DB siano maiuscoli e senza spazi,
  // anche se per qualche motivo fossero stati inseriti diversamente.
  const normalizzazione = await run(
    "UPDATE nazioni SET codice_iso2 = UPPER(TRIM(codice_iso2))",
  );
  if (normalizzazione.changes > 0) {
    console.log(
      `🔤 Normalizzati ${normalizzazione.changes} codici ISO2 in maiuscolo`,
    );
  }

  // Verifica finale: nessun codice ISO2 nullo o malformato
  const codiciInvalidi = await all(
    `SELECT id, nome, codice_iso2 FROM nazioni
     WHERE codice_iso2 IS NULL
        OR LENGTH(TRIM(codice_iso2)) != 2
        OR codice_iso2 != UPPER(codice_iso2)`,
  );
  if (codiciInvalidi.length > 0) {
    console.warn(
      `⚠️  Attenzione: ${codiciInvalidi.length} nazioni con codice ISO2 non valido:`,
    );
    codiciInvalidi.forEach((n) =>
      console.warn(`   • id=${n.id} "${n.nome}" → "${n.codice_iso2}"`),
    );
  } else {
    console.log("✅ Tutti i codici ISO2 sono validi (2 lettere maiuscole)");
  }

  console.log("\n✅ Seed completato:");
  console.log(`   • ${nazioni.length} nazioni (con bandiera preimpostata)`);
  console.log(
    `   • ${idSquadra.length} squadre, ${corridori.length} corridori, ${corridori.length} biciclette`,
  );
  console.log(
    `   • ${idSquadra.length * 2} membri di staff tecnico, ${idSquadra.length * 3} veicoli squadra`,
  );
  console.log(
    `   • ${sponsor.length} sponsor e le relative sponsorizzazioni per squadra`,
  );
  console.log(
    `   • ${idTappa.length} tappe con percorso e meteo, risultati per le prime ${tappeConRisultati.length}`,
  );
  console.log(
    "   • penalità, controlli antidoping, alloggi, media accreditati e comunicati stampa",
  );
  console.log(
    "   • 5 ritiri di esempio: infortunio, abbandono, squalifica, altro + 1 squalifica automatica da doping positivo",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore durante il seed:", err);
  process.exit(1);
});
