// Popola il database con dati di esempio realistici. Esegui con: node seed.js
const db = require('./db/database');

// Elenco nazioni (nome, codice ISO2 — la bandiera è calcolata dal codice lato frontend)
const nazioni = [
  ['Italia','IT'],['Francia','FR'],['Belgio','BE'],['Spagna','ES'],['Paesi Bassi','NL'],
  ['Germania','DE'],['Svizzera','CH'],['Slovenia','SI'],['Norvegia','NO'],['Danimarca','DK'],
  ['Regno Unito','GB'],['Irlanda','IE'],['Portogallo','PT'],['Polonia','PL'],['Austria','AT'],
  ['Colombia','CO'],['Stati Uniti','US'],['Australia','AU'],['Canada','CA'],['Ecuador','EC'],
  ['Slovacchia','SK'],['Repubblica Ceca','CZ'],['Kazakhstan','KZ'],['Ucraina','UA'],['Lettonia','LV'],
  ['Estonia','EE'],['Lituania','LT'],['Svezia','SE'],['Finlandia','FI'],['Ungheria','HU'],
  ['Croazia','HR'],['Eritrea','ER'],['Sudafrica','ZA'],['Ruanda','RW'],['Giappone','JP'],
  ['Nuova Zelanda','NZ'],['Brasile','BR'],['Argentina','AR'],['Venezuela','VE'],['Messico','MX']
];

const squadre = [
  ['Team Asfalto Rosa', 'IT', '#e6197f'],
  ['Montagna Verde Cycling', 'FR', '#2e7d46'],
  ['Vento del Nord', 'BE', '#1565c0'],
];

const corridori = [
  ['Marco', 'Rossi', 1, 'IT'],
  ['Luca', 'Bianchi', 2, 'IT'],
  ['Julien', 'Moreau', 11, 'FR'],
  ['Thomas', 'Dubois', 12, 'FR'],
  ['Wout', 'Peeters', 21, 'BE'],
];

const tappe = [
  [1, 'Roma – Frascati', 'Roma', 'Frascati', 45.2, 620, 'collina', '2026-05-10'],
  [2, 'Frascati – Terracina', 'Frascati', 'Terracina', 168.5, 340, 'pianura', '2026-05-11'],
  [3, 'Cronometro Terracina', 'Terracina', 'Terracina', 22.0, 90, 'cronometro', '2026-05-12'],
  [4, 'Terracina – Gran Sasso', 'Terracina', 'Gran Sasso', 201.3, 3800, 'montagna', '2026-05-13'],
];

const classificheTipo = [
  ['Generale', 'Classifica a tempo cumulato'],
  ['Punti (maglia ciclamino)', 'Classifica a punti per volate e piazzamenti'],
  ['Scalatori (GPM)', 'Classifica a punti sui gran premi della montagna'],
  ['Giovani', 'Migliore classificato under 25'],
  ['Squadre', 'Somma dei migliori tempi di squadra'],
];

const sponsor = [
  ['VelocItalia Assicurazioni', 'assicurazioni', 'https://example.com'],
  ['MontagnaBike Componenti', 'componentistica', 'https://example.com'],
];

setTimeout(() => {
  db.serialize(() => {
    const stmtNazione = db.prepare('INSERT OR IGNORE INTO nazioni (nome, codice_iso2) VALUES (?, ?)');
    nazioni.forEach(n => stmtNazione.run(n));
    stmtNazione.finalize();

    setTimeout(() => {
      db.all('SELECT id, codice_iso2 FROM nazioni', [], (err, righeNazioni) => {
        const idNazione = {};
        righeNazioni.forEach(r => idNazione[r.codice_iso2] = r.id);

        const stmtSquadra = db.prepare('INSERT INTO squadre (nome, nazione_id, colore) VALUES (?, ?, ?)');
        squadre.forEach(s => stmtSquadra.run([s[0], idNazione[s[1]], s[2]]));
        stmtSquadra.finalize();

        const stmtCorridore = db.prepare(
          'INSERT INTO corridori (nome, cognome, numero_pettorale, nazione_id, squadra_id) VALUES (?, ?, ?, ?, ?)'
        );
        corridori.forEach((c, i) => {
          const squadraId = i < 2 ? 1 : (i < 4 ? 2 : 3);
          stmtCorridore.run([c[0], c[1], c[2], idNazione[c[3]], squadraId]);
        });
        stmtCorridore.finalize();

        const stmtTappa = db.prepare(
          'INSERT INTO tappe (numero_tappa, nome, partenza, arrivo, distanza_km, dislivello_m, tipo, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        tappe.forEach(t => stmtTappa.run(t));
        stmtTappa.finalize();

        const stmtClassifica = db.prepare('INSERT INTO classifiche_tipo (nome, descrizione) VALUES (?, ?)');
        classificheTipo.forEach(c => stmtClassifica.run(c));
        stmtClassifica.finalize();

        const stmtSponsor = db.prepare('INSERT INTO sponsor (nome, settore, sito_web) VALUES (?, ?, ?)');
        sponsor.forEach(s => stmtSponsor.run(s));
        stmtSponsor.finalize();

        db.run('INSERT INTO staff_tecnico (nome, cognome, ruolo, squadra_id) VALUES (?, ?, ?, ?)',
          ['Paolo', 'Ferri', 'direttore_sportivo', 1]);
        db.run('INSERT INTO veicoli_squadra (squadra_id, tipo, targa, modello) VALUES (?, ?, ?, ?)',
          [1, 'ammiraglia', 'AB123CD', 'Skoda Superb']);
        db.run('INSERT INTO tappe_percorso (tappa_id, km, tipo, nome_luogo, categoria) VALUES (?, ?, ?, ?, ?)',
          [1, 30.5, 'gpm', 'Monte Cavo', '2']);
        db.run('INSERT INTO meteo_tappa (tappa_id, temperatura, condizione, vento_kmh) VALUES (?, ?, ?, ?)',
          [1, 22.5, 'sereno', 12], () => {
            console.log('✓ Dati di esempio inseriti: 40 nazioni, 3 squadre, 5 corridori, 4 tappe + tabelle secondarie');
            process.exit(0);
          });
      });
    }, 300);
  });
}, 300);
