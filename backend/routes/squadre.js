const express = require("express");
const router = express.Router();
const db = require("../db/database");

module.exports = (io) => {
  router.get("/", (req, res) => {
    const sql = `
      SELECT s.*, n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice
      FROM squadre s
      LEFT JOIN nazioni n ON s.nazione_id = n.id
      ORDER BY s.nome
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  router.get("/:id", (req, res) => {
    db.get(
      "SELECT * FROM squadre WHERE id = ?",
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!row)
          return res.status(404).json({ errore: "Squadra non trovata" });
        res.json(row);
      },
    );
  });

  router.post("/", (req, res) => {
    const { nome, nazione_id, colore } = req.body;
    if (!nome)
      return res.status(400).json({ errore: "Il nome è obbligatorio" });
    db.run(
      "INSERT INTO squadre (nome, nazione_id, colore) VALUES (?, ?, ?)",
      [nome, nazione_id || null, colore || "#e6197f"],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuova = { id: this.lastID, nome, nazione_id, colore };
        io.emit("squadre:aggiornate", { tipo: "creata", dato: nuova });
        res.status(201).json(nuova);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const { nome, nazione_id, colore } = req.body;
    db.run(
      "UPDATE squadre SET nome = ?, nazione_id = ?, colore = ? WHERE id = ?",
      [nome, nazione_id || null, colore, req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Squadra non trovata" });
        io.emit("squadre:aggiornate", {
          tipo: "modificata",
          id: req.params.id,
        });
        res.json({ id: req.params.id, nome, nazione_id, colore });
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run("DELETE FROM squadre WHERE id = ?", [req.params.id], function (err) {
      if (err) return res.status(400).json({ errore: err.message });
      if (this.changes === 0)
        return res.status(404).json({ errore: "Squadra non trovata" });
      io.emit("squadre:aggiornate", { tipo: "eliminata", id: req.params.id });
      res.json({ ok: true });
    });
  });

  return router;
};
