const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "gestionale.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("Errore apertura database:", err.message);
  else console.log("✓ Connesso al database SQLite:", DB_PATH);
});

const TABELLE_OBSOLETE = [
  "comunicati_stampa",
  "media_accreditati",
  "meteo_tappa",
  "hotel",
  "veicoli_squadra",
  "squadra_sponsor",
  "sponsor",
  "biciclette",
  "controlli_antidoping",
  "classifiche_tipo",
  "staff_tecnico",
];

db.serialize(() => {
  db.run("PRAGMA foreign_keys = OFF");
  for (const tabella of TABELLE_OBSOLETE) {
    db.run(`DROP TABLE IF EXISTS ${tabella}`);
  }
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS nazioni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      codice_iso2 TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS squadre (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      nazione_id INTEGER,
      colore TEXT DEFAULT '#e6197f',
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nazione_id) REFERENCES nazioni(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS corridori (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      numero_pettorale INTEGER UNIQUE,
      nazione_id INTEGER,
      squadra_id INTEGER,
      data_nascita DATE,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nazione_id) REFERENCES nazioni(id) ON DELETE SET NULL,
      FOREIGN KEY (squadra_id) REFERENCES squadre(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tappe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_tappa INTEGER NOT NULL,
      nome TEXT NOT NULL,
      partenza TEXT NOT NULL,
      arrivo TEXT NOT NULL,
      distanza_km REAL,
      dislivello_m INTEGER,
      tipo TEXT DEFAULT 'pianura' CHECK(tipo IN ('pianura','collina','montagna','cronometro')),
      data DATE,
      stato TEXT DEFAULT 'programmata' CHECK(stato IN ('programmata','in_corso','conclusa')),
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tappe_percorso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER NOT NULL,
      km REAL,
      tipo TEXT DEFAULT 'sprint' CHECK(tipo IN ('sprint','gpm')),
      nome_luogo TEXT,
      categoria TEXT,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS risultati (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER NOT NULL,
      corridore_id INTEGER NOT NULL,
      posizione INTEGER,
      tempo TEXT,
      distacco TEXT DEFAULT '00:00:00',
      punti INTEGER DEFAULT 0,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE CASCADE,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE CASCADE,
      UNIQUE(tappa_id, corridore_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS traguardi_volanti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER NOT NULL,
      corridore_id INTEGER NOT NULL,
      posizione INTEGER,
      punti INTEGER DEFAULT 0,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE CASCADE,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gpm_risultati (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER NOT NULL,
      corridore_id INTEGER NOT NULL,
      posizione INTEGER,
      punti INTEGER DEFAULT 0,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE CASCADE,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS penalita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      corridore_id INTEGER NOT NULL,
      tappa_id INTEGER,
      motivo TEXT NOT NULL,
      secondi INTEGER DEFAULT 0,
      punti INTEGER DEFAULT 0,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE CASCADE,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ritiri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER NOT NULL,
      corridore_id INTEGER NOT NULL UNIQUE,
      motivo TEXT NOT NULL CHECK(motivo IN ('infortunio','non_partecipa')),
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE CASCADE,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cestino (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entita TEXT NOT NULL,
      entita_id INTEGER NOT NULL,
      dati TEXT NOT NULL,
      eliminato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      scade_il DATETIME NOT NULL
    )
  `);

  db.run("DELETE FROM cestino WHERE entita = 'sponsor'");

  console.log("✓ Schema database: 11 tabelle di gara (anagrafica, tappe, risultati, ritiri, cestino)");
});

module.exports = db;
