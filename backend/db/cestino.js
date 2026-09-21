const db = require("./database");

// Giorni di ritenzione prima dell'eliminazione automatica e definitiva
const GIORNI_RITENZIONE = 15;

function contaRighe(sql, parametri, cb) {
  db.get(sql, parametri, (err, riga) => {
    if (err) return cb(err);
    cb(null, riga ? riga.n : 0);
  });
}

/**
 * Verifica in sequenza una lista di controlli di dipendenza.
 * Ogni controllo: { sql, parametri, messaggio }
 * Il primo controllo con conteggio > 0 blocca l'operazione: cb(null, messaggioBlocco)
 * Se nessun controllo blocca: cb(null, null)
 */
function verificaEliminabile(controlli, cb) {
  let i = 0;
  function prossimo() {
    if (i >= controlli.length) return cb(null, null);
    const c = controlli[i++];
    contaRighe(c.sql, c.parametri, (err, n) => {
      if (err) return cb(err);
      if (n > 0) return cb(null, c.messaggio);
      prossimo();
    });
  }
  prossimo();
}

/** Sposta una riga (già letta) nel cestino con scadenza a GIORNI_RITENZIONE giorni. */
function spostaInCestino(entita, riga, cb) {
  const scadeIl = new Date(
    Date.now() + GIORNI_RITENZIONE * 24 * 60 * 60 * 1000,
  ).toISOString();
  db.run(
    `INSERT INTO cestino (entita, entita_id, dati, scade_il) VALUES (?, ?, ?, ?)`,
    [entita, riga.id, JSON.stringify(riga), scadeIl],
    function (err) {
      if (err) return cb(err);
      cb(null, this.lastID);
    },
  );
}

/** Elimina in modo permanente e definitivo tutte le voci di cestino scadute (usato dal cron). */
function eliminaScaduti(cb) {
  db.run(
    "DELETE FROM cestino WHERE scade_il <= datetime('now')",
    [],
    function (err) {
      if (err) return cb(err);
      cb(null, this.changes);
    },
  );
}

module.exports = {
  GIORNI_RITENZIONE,
  contaRighe,
  verificaEliminabile,
  spostaInCestino,
  eliminaScaduti,
};
