const express = require("express");
const router = express.Router();
const db = require("../db/database");

module.exports = (io) => {
  router.get("/", (req, res) => {
    const sql = `
      SELECT c.*, s.nome AS squadra_nome, s.colore AS squadra_colore,
             n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice
      FROM corridori c
      LEFT JOIN squadre s ON c.squadra_id = s.id
      LEFT JOIN nazioni n ON c.nazione_id = n.id
      ORDER BY c.cognome, c.nome
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  router.get("/:id", (req, res) => {
    db.get(
      "SELECT * FROM corridori WHERE id = ?",
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!row)
          return res.status(404).json({ errore: "Corridore non trovato" });
        res.json(row);
      },
    );
  });

  router.post("/", (req, res) => {
    const {
      nome,
      cognome,
      numero_pettorale,
      nazione_id,
      squadra_id,
      data_nascita,
    } = req.body;
    if (!nome || !cognome)
      return res
        .status(400)
        .json({ errore: "Nome e cognome sono obbligatori" });
    db.run(
      `INSERT INTO corridori (nome, cognome, numero_pettorale, nazione_id, squadra_id, data_nascita)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nome,
        cognome,
        numero_pettorale || null,
        nazione_id || null,
        squadra_id || null,
        data_nascita || null,
      ],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuovo = {
          id: this.lastID,
          nome,
          cognome,
          numero_pettorale,
          nazione_id,
          squadra_id,
        };
        io.emit("corridori:aggiornati", { tipo: "creato", dato: nuovo });
        res.status(201).json(nuovo);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const {
      nome,
      cognome,
      numero_pettorale,
      nazione_id,
      squadra_id,
      data_nascita,
    } = req.body;
    db.run(
      `UPDATE corridori SET nome=?, cognome=?, numero_pettorale=?, nazione_id=?, squadra_id=?, data_nascita=?
       WHERE id=?`,
      [
        nome,
        cognome,
        numero_pettorale || null,
        nazione_id || null,
        squadra_id || null,
        data_nascita,
        req.params.id,
      ],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Corridore non trovato" });
        io.emit("corridori:aggiornati", {
          tipo: "modificato",
          id: req.params.id,
        });
        res.json({
          id: req.params.id,
          nome,
          cognome,
          numero_pettorale,
          nazione_id,
          squadra_id,
        });
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run(
      "DELETE FROM corridori WHERE id = ?",
      [req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Corridore non trovato" });
        io.emit("corridori:aggiornati", {
          tipo: "eliminato",
          id: req.params.id,
        });
        res.json({ ok: true });
      },
    );
  });

  return router;
};
