const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { trovaEsclusione } = require("../db/esclusioni");

const SQL_ELENCO = `
  SELECT r.*, c.nome, c.cognome, c.numero_pettorale,
         s.nome AS squadra_nome, s.colore AS squadra_colore,
         n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice,
         ns.codice_iso2 AS squadra_nazione_codice,
         t.numero_tappa, t.nome AS tappa_nome
  FROM ritiri r
  JOIN corridori c ON r.corridore_id = c.id
  JOIN tappe t ON r.tappa_id = t.id
  LEFT JOIN squadre s ON c.squadra_id = s.id
  LEFT JOIN nazioni n ON c.nazione_id = n.id
  LEFT JOIN nazioni ns ON s.nazione_id = ns.id
`;

function contaPresenzeDallaTappa(corridoreId, numeroTappa, inclusiva, cb) {
  const op = inclusiva ? ">=" : ">";
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM risultati ris
         JOIN tappe tp ON tp.id = ris.tappa_id
         WHERE ris.corridore_id = ? AND tp.numero_tappa ${op} ?) +
      (SELECT COUNT(*) FROM traguardi_volanti tv
         JOIN tappe tp ON tp.id = tv.tappa_id
         WHERE tv.corridore_id = ? AND tp.numero_tappa ${op} ?) +
      (SELECT COUNT(*) FROM gpm_risultati g
         JOIN tappe tp ON tp.id = g.tappa_id
         WHERE g.corridore_id = ? AND tp.numero_tappa ${op} ?)
      AS n
  `;
  db.get(
    sql,
    [
      corridoreId,
      numeroTappa,
      corridoreId,
      numeroTappa,
      corridoreId,
      numeroTappa,
    ],
    (err, riga) => {
      if (err) return cb(err);
      cb(null, riga ? riga.n : 0);
    },
  );
}

module.exports = (io) => {
  router.get("/", (req, res) => {
    db.all(
      `${SQL_ELENCO} ORDER BY t.numero_tappa, c.cognome, c.nome`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
      },
    );
  });

  router.get("/tappa/:tappaId", (req, res) => {
    db.all(
      `${SQL_ELENCO} WHERE r.tappa_id = ? ORDER BY c.cognome, c.nome`,
      [req.params.tappaId],
      (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
      },
    );
  });

  router.get("/esclusi/:tappaId", (req, res) => {
    const sql = `
      SELECT r.corridore_id, r.motivo, r.tappa_id,
             t.numero_tappa AS numero_ritiro,
             tc.numero_tappa AS numero_corrente
      FROM ritiri r
      JOIN tappe t ON t.id = r.tappa_id
      JOIN tappe tc ON tc.id = ?
    `;
    db.all(sql, [req.params.tappaId], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      const esclusi = (rows || []).filter((r) =>
        r.motivo === "infortunio"
          ? r.numero_ritiro <= r.numero_corrente
          : r.numero_ritiro < r.numero_corrente,
      );
      res.json(esclusi);
    });
  });

  router.post("/", (req, res) => {
    const { tappa_id, corridore_id, motivo } = req.body;
    if (!tappa_id || !corridore_id || !motivo) {
      return res.status(400).json({
        errore: "tappa_id, corridore_id e motivo sono obbligatori",
      });
    }
    if (!["infortunio", "non_partecipa"].includes(motivo)) {
      return res.status(400).json({
        errore: "motivo deve essere infortunio o non_partecipa",
      });
    }

    db.get("SELECT * FROM tappe WHERE id = ?", [tappa_id], (errT, tappa) => {
      if (errT) return res.status(500).json({ errore: errT.message });
      if (!tappa)
        return res.status(404).json({ errore: "Tappa non trovata" });

      db.get(
        "SELECT id FROM ritiri WHERE corridore_id = ?",
        [corridore_id],
        (errR, esistente) => {
          if (errR) return res.status(500).json({ errore: errR.message });
          if (esistente) {
            return res.status(400).json({
              errore: "Questo corridore è già stato inserito tra i ritirati",
            });
          }

          trovaEsclusione(corridore_id, tappa_id, (errE, giaFuori) => {
            if (errE) return res.status(500).json({ errore: errE.message });
            if (giaFuori) {
              return res.status(400).json({
                errore:
                  "Il corridore è già fuori dalla corsa e non può essere registrato di nuovo",
              });
            }

            const inclusiva = motivo === "infortunio";
            contaPresenzeDallaTappa(
              corridore_id,
              tappa.numero_tappa,
              inclusiva,
              (errC, n) => {
                if (errC)
                  return res.status(500).json({ errore: errC.message });
                if (n > 0) {
                  return res.status(400).json({
                    errore: inclusiva
                      ? "Rimuovi prima il risultato (o GPM/traguardi) di questa tappa: un infortunato non ha un arrivo."
                      : "Il corridore ha già risultati nelle tappe successive: non può essere ritirato da qui.",
                  });
                }

                db.run(
                  `INSERT INTO ritiri (tappa_id, corridore_id, motivo) VALUES (?, ?, ?)`,
                  [tappa_id, corridore_id, motivo],
                  function (errIns) {
                    if (errIns)
                      return res.status(400).json({ errore: errIns.message });
                    const dato = {
                      id: this.lastID,
                      tappa_id,
                      corridore_id,
                      motivo,
                    };
                    io.emit("ritiri:aggiornati", { tipo: "salvato", dato });
                    io.emit("risultati:aggiornati", {
                      tipo: "ritiro",
                      dato,
                    });
                    res.status(201).json(dato);
                  },
                );
              },
            );
          });
        },
      );
    });
  });

  router.delete("/:id", (req, res) => {
    db.run(
      "DELETE FROM ritiri WHERE id = ?",
      [req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Ritiro non trovato" });
        io.emit("ritiri:aggiornati", {
          tipo: "eliminato",
          id: req.params.id,
        });
        io.emit("risultati:aggiornati", {
          tipo: "ritiro-eliminato",
          id: req.params.id,
        });
        res.json({ ok: true });
      },
    );
  });

  return router;
};
