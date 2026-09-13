const express = require("express");
const router = express.Router();
const db = require("../db/database");

/* ---------------------------------------------------------------------
 * Un controllo antidoping con esito "positivo" ha una conseguenza
 * sportiva automatica: il corridore viene squalificato e, da questo
 * momento, non può più essere selezionato per nessuna tappa successiva
 * né comparire in classifica — esattamente come un ritiro manuale, ma
 * innescato in automatico dal risultato del controllo invece che da
 * un'azione esplicita dell'utente in anagrafica corridori.
 * ------------------------------------------------------------------- */
function applicaSqualificaDoping(corridoreId, tappaId, io) {
  const aggiorna = (numeroTappa) => {
    const nota = numeroTappa
      ? `Squalifica automatica: controllo antidoping positivo (tappa ${numeroTappa})`
      : "Squalifica automatica: controllo antidoping positivo";
    db.run(
      `UPDATE corridori SET
         ritirato = 1,
         ritirato_tappa_numero = ?,
         motivo_ritiro = 'squalifica',
         note_ritiro = ?,
         ritirato_il = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [numeroTappa || null, nota, corridoreId],
      (err) => {
        if (err) {
          console.error(
            "Errore nella squalifica automatica per doping:",
            err.message,
          );
          return;
        }
        io.emit("corridori:aggiornati", {
          tipo: "squalificato_doping",
          id: corridoreId,
        });
      },
    );
  };

  if (tappaId) {
    db.get(
      "SELECT numero_tappa FROM tappe WHERE id = ?",
      [tappaId],
      (err, riga) => aggiorna(riga ? riga.numero_tappa : null),
    );
  } else {
    aggiorna(null);
  }
}

module.exports = (io) => {
  router.get("/", (req, res) => {
    db.all(
      "SELECT * FROM controlli_antidoping ORDER BY data DESC",
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
      },
    );
  });

  router.get("/:id", (req, res) => {
    db.get(
      "SELECT * FROM controlli_antidoping WHERE id = ?",
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!row) return res.status(404).json({ errore: "Riga non trovata" });
        res.json(row);
      },
    );
  });

  router.post("/", (req, res) => {
    const { corridore_id, tappa_id, data, esito } = req.body;
    if (!corridore_id) {
      return res.status(400).json({ errore: "Il corridore è obbligatorio" });
    }
    db.run(
      `INSERT INTO controlli_antidoping (corridore_id, tappa_id, data, esito)
       VALUES (?, ?, ?, ?)`,
      [corridore_id, tappa_id || null, data || null, esito || "in_attesa"],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuovo = {
          id: this.lastID,
          corridore_id,
          tappa_id,
          data,
          esito,
        };
        io.emit("controlli-antidoping:aggiornati", {
          tipo: "creata",
          dato: nuovo,
        });
        if (esito === "positivo") {
          applicaSqualificaDoping(corridore_id, tappa_id, io);
        }
        res.status(201).json(nuovo);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const { corridore_id, tappa_id, data, esito } = req.body;
    db.get(
      "SELECT esito FROM controlli_antidoping WHERE id = ?",
      [req.params.id],
      (errPrec, righePrecedenti) => {
        if (errPrec) return res.status(500).json({ errore: errPrec.message });
        const esitoPrecedente = righePrecedenti?.esito;

        db.run(
          `UPDATE controlli_antidoping SET corridore_id = ?, tappa_id = ?, data = ?, esito = ?
           WHERE id = ?`,
          [
            corridore_id,
            tappa_id || null,
            data || null,
            esito || "in_attesa",
            req.params.id,
          ],
          function (err) {
            if (err) return res.status(400).json({ errore: err.message });
            if (this.changes === 0)
              return res.status(404).json({ errore: "Riga non trovata" });
            io.emit("controlli-antidoping:aggiornati", {
              tipo: "modificata",
              id: req.params.id,
            });
            // Innesca la squalifica automatica solo quando l'esito
            // "diventa" positivo ora (non ad ogni salvataggio), per non
            // sovrascrivere ripetutamente una riammissione fatta a mano.
            if (esito === "positivo" && esitoPrecedente !== "positivo") {
              applicaSqualificaDoping(corridore_id, tappa_id, io);
            }
            res.json({ id: req.params.id, corridore_id, tappa_id, data, esito });
          },
        );
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run(
      "DELETE FROM controlli_antidoping WHERE id = ?",
      [req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Riga non trovata" });
        io.emit("controlli-antidoping:aggiornati", {
          tipo: "eliminata",
          id: req.params.id,
        });
        res.json({ ok: true });
      },
    );
  });

  return router;
};
