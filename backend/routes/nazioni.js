const express = require("express");
const router = express.Router();
const db = require("../db/database");

module.exports = (io) => {
  // Lista completa
  router.get("/", (req, res) => {
    db.all("SELECT * FROM nazioni ORDER BY nome", [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  // Ricerca per autocomplete: /api/nazioni/ricerca?q=ita
  router.get("/ricerca", (req, res) => {
    const q = `%${(req.query.q || "").toLowerCase()}%`;
    db.all(
      "SELECT * FROM nazioni WHERE lower(nome) LIKE ? ORDER BY nome LIMIT 15",
      [q],
      (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
      },
    );
  });

  router.post("/", (req, res) => {
    const { nome, codice_iso2 } = req.body;
    if (!nome || !codice_iso2)
      return res
        .status(400)
        .json({ errore: "nome e codice_iso2 sono obbligatori" });
    db.run(
      "INSERT INTO nazioni (nome, codice_iso2) VALUES (?, ?)",
      [nome, codice_iso2.toUpperCase()],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuova = {
          id: this.lastID,
          nome,
          codice_iso2: codice_iso2.toUpperCase(),
        };
        io.emit("nazioni:aggiornate", { tipo: "creata", dato: nuova });
        res.status(201).json(nuova);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const { nome, codice_iso2 } = req.body;
    if (!nome || !codice_iso2)
      return res
        .status(400)
        .json({ errore: "nome e codice_iso2 sono obbligatori" });
    db.run(
      "UPDATE nazioni SET nome = ?, codice_iso2 = ? WHERE id = ?",
      [nome, codice_iso2.toUpperCase(), req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Nazione non trovata" });
        io.emit("nazioni:aggiornate", {
          tipo: "modificata",
          id: req.params.id,
        });
        res.json({
          id: req.params.id,
          nome,
          codice_iso2: codice_iso2.toUpperCase(),
        });
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run("DELETE FROM nazioni WHERE id = ?", [req.params.id], function (err) {
      if (err) return res.status(400).json({ errore: err.message });
      if (this.changes === 0)
        return res.status(404).json({ errore: "Nazione non trovata" });
      io.emit("nazioni:aggiornate", { tipo: "eliminata", id: req.params.id });
      res.json({ ok: true });
    });
  });

  return router;
};
