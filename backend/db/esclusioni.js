const db = require("./database");

function messaggioEsclusione(motivo) {
  if (motivo === "infortunio") {
    return "Il corridore si è infortunato e non può più partecipare da questa tappa.";
  }
  return "Il corridore non partecipa più dalla tappa successiva a quella del ritiro.";
}

function trovaEsclusione(corridoreId, tappaId, cb) {
  const sql = `
    SELECT r.id, r.motivo, r.tappa_id AS tappa_ritiro_id,
           t.numero_tappa AS numero_ritiro,
           tc.numero_tappa AS numero_corrente
    FROM ritiri r
    JOIN tappe t ON t.id = r.tappa_id
    JOIN tappe tc ON tc.id = ?
    WHERE r.corridore_id = ?
  `;
  db.get(sql, [tappaId, corridoreId], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(null, null);
    const escluso =
      row.motivo === "infortunio"
        ? row.numero_ritiro <= row.numero_corrente
        : row.numero_ritiro < row.numero_corrente;
    cb(null, escluso ? row : null);
  });
}

function validaPartecipazione(body, cb) {
  const corridoreId = body.corridore_id;
  const tappaId = body.tappa_id;
  if (!corridoreId || !tappaId) return cb(null, null);
  trovaEsclusione(corridoreId, tappaId, (err, esclusione) => {
    if (err) return cb(err);
    if (!esclusione) return cb(null, null);
    cb(null, messaggioEsclusione(esclusione.motivo));
  });
}

function idsRitirati(cb) {
  db.all("SELECT corridore_id FROM ritiri", [], (err, rows) => {
    if (err) return cb(err);
    cb(null, new Set((rows || []).map((r) => r.corridore_id)));
  });
}

module.exports = {
  trovaEsclusione,
  validaPartecipazione,
  idsRitirati,
  messaggioEsclusione,
};
