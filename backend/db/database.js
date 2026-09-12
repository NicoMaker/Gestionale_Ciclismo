const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "gestionale.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("Errore apertura database:", err.message);
  else console.log("✓ Connesso al database SQLite:", DB_PATH);
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  // 1. Nazioni (anagrafica per la ricerca con bandiera)
  db.run(`
    CREATE TABLE IF NOT EXISTS nazioni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      codice_iso2 TEXT NOT NULL UNIQUE
    )
  `);

  // 2. Squadre
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

  // 3. Corridori
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

  // 4. Staff tecnico
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_tecnico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      ruolo TEXT DEFAULT 'direttore_sportivo' CHECK(ruolo IN ('direttore_sportivo','meccanico','medico','massaggiatore','preparatore_atletico')),
      squadra_id INTEGER,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (squadra_id) REFERENCES squadre(id) ON DELETE CASCADE
    )
  `);

  // 5. Tappe
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

  // 6. Punti intermedi di tappa (sprint / GPM)
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

  // 7. Risultati di tappa
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

  // 8. Tipi di classifica (generale, punti, scalatori, giovani, squadre...)
  db.run(`
    CREATE TABLE IF NOT EXISTS classifiche_tipo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      descrizione TEXT
    )
  `);

  // 9. Traguardi volanti (risultati sprint intermedi)
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

  // 10. Risultati GPM (gran premi della montagna)
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

  // 11. Penalità
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

  // 12. Controlli antidoping
  db.run(`
    CREATE TABLE IF NOT EXISTS controlli_antidoping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      corridore_id INTEGER NOT NULL,
      tappa_id INTEGER,
      data DATE,
      esito TEXT DEFAULT 'in_attesa' CHECK(esito IN ('negativo','positivo','in_attesa')),
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE CASCADE,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE SET NULL
    )
  `);

  // 13. Biciclette
  db.run(`
    CREATE TABLE IF NOT EXISTS biciclette (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      corridore_id INTEGER,
      marca TEXT,
      modello TEXT,
      telaio TEXT,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (corridore_id) REFERENCES corridori(id) ON DELETE SET NULL
    )
  `);

  // 14. Sponsor
  db.run(`
    CREATE TABLE IF NOT EXISTS sponsor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      settore TEXT,
      sito_web TEXT,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 15. Sponsor <-> Squadre (relazione molti-a-molti)
  db.run(`
    CREATE TABLE IF NOT EXISTS squadra_sponsor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squadra_id INTEGER NOT NULL,
      sponsor_id INTEGER NOT NULL,
      tipo TEXT DEFAULT 'co_sponsor' CHECK(tipo IN ('main_sponsor','co_sponsor','fornitore_tecnico')),
      FOREIGN KEY (squadra_id) REFERENCES squadre(id) ON DELETE CASCADE,
      FOREIGN KEY (sponsor_id) REFERENCES sponsor(id) ON DELETE CASCADE,
      UNIQUE(squadra_id, sponsor_id)
    )
  `);

  // 16. Veicoli squadra
  db.run(`
    CREATE TABLE IF NOT EXISTS veicoli_squadra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squadra_id INTEGER NOT NULL,
      tipo TEXT DEFAULT 'ammiraglia' CHECK(tipo IN ('ammiraglia','furgone','bus','camper')),
      targa TEXT,
      modello TEXT,
      FOREIGN KEY (squadra_id) REFERENCES squadre(id) ON DELETE CASCADE
    )
  `);

  // 17. Hotel (alloggio squadra per tappa)
  db.run(`
    CREATE TABLE IF NOT EXISTS hotel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER,
      squadra_id INTEGER,
      nome TEXT NOT NULL,
      citta TEXT,
      indirizzo TEXT,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE SET NULL,
      FOREIGN KEY (squadra_id) REFERENCES squadre(id) ON DELETE SET NULL
    )
  `);

  // 18. Meteo di tappa
  db.run(`
    CREATE TABLE IF NOT EXISTS meteo_tappa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tappa_id INTEGER NOT NULL UNIQUE,
      temperatura REAL,
      condizione TEXT DEFAULT 'sereno' CHECK(condizione IN ('sereno','nuvoloso','pioggia','vento_forte','neve')),
      vento_kmh REAL,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE CASCADE
    )
  `);

  // 19. Media accreditati
  db.run(`
    CREATE TABLE IF NOT EXISTS media_accreditati (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      testata TEXT,
      tipo TEXT DEFAULT 'stampa' CHECK(tipo IN ('stampa','tv','radio','foto','online')),
      tappa_id INTEGER,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE SET NULL
    )
  `);

  // 20. Comunicati stampa
  db.run(`
    CREATE TABLE IF NOT EXISTS comunicati_stampa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titolo TEXT NOT NULL,
      contenuto TEXT,
      data DATE,
      tappa_id INTEGER,
      creato_il DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tappa_id) REFERENCES tappe(id) ON DELETE SET NULL
    )
  `);

  // 21. Cestino (soft-delete): conserva una copia JSON della riga eliminata
  // così da poterla ripristinare entro il periodo di ritenzione, oppure
  // farla scadere ed eliminarla definitivamente in automatico (cron).
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

  console.log("✓ Schema database verificato/creato (21 tabelle)");
});

module.exports = db;
