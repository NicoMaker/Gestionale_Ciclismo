const express = require("express");
const router = express.Router();
const db = require("../db/database");

module.exports = (io) => {
  // Risultati di una tappa
  router.get("/tappa/:tappaId", (req, res) => {
    const sql = `
      SELECT r.*, c.nome, c.cognome, c.numero_pettorale, s.nome AS squadra_nome
      FROM risultati r
      JOIN corridori c ON r.corridore_id = c.id
      LEFT JOIN squadre s ON c.squadra_id = s.id
      WHERE r.tappa_id = ?
      ORDER BY r.posizione ASC
    `;
    db.all(sql, [req.params.tappaId], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  // Classifica generale (somma punti / tempo totale) per tutti i corridori
  router.get("/classifica-generale", (req, res) => {
    const sql = `
      SELECT c.id, c.nome, c.cognome, c.numero_pettorale, s.nome AS squadra_nome,
             SUM(r.punti) AS punti_totali,
             COUNT(r.id) AS tappe_disputate
      FROM corridori c
      LEFT JOIN risultati r ON r.corridore_id = c.id
      LEFT JOIN squadre s ON c.squadra_id = s.id
      GROUP BY c.id
      ORDER BY punti_totali DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  // Inserisci/aggiorna risultato (upsert)
  router.post("/", (req, res) => {
    const { tappa_id, corridore_id, posizione, tempo, distacco, punti } =
      req.body;
    if (!tappa_id || !corridore_id) {
      return res
        .status(400)
        .json({ errore: "tappa_id e corridore_id sono obbligatori" });
    }
    const sql = `
      INSERT INTO risultati (tappa_id, corridore_id, posizione, tempo, distacco, punti)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tappa_id, corridore_id) DO UPDATE SET
        posizione = excluded.posizione,
        tempo = excluded.tempo,
        distacco = excluded.distacco,
        punti = excluded.punti
    `;
    db.run(
      sql,
      [
        tappa_id,
        corridore_id,
        posizione || null,
        tempo || null,
        distacco || "00:00:00",
        punti || 0,
      ],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const risultato = {
          tappa_id,
          corridore_id,
          posizione,
          tempo,
          distacco,
          punti,
        };
        io.emit("risultati:aggiornati", { tipo: "salvato", dato: risultato });
        res.status(201).json(risultato);
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run(
      "DELETE FROM risultati WHERE id = ?",
      [req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Risultato non trovato" });
        io.emit("risultati:aggiornati", {
          tipo: "eliminato",
          id: req.params.id,
        });
        res.json({ ok: true });
      },
    );
  });

  return router;
};
