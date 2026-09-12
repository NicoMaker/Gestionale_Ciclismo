const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { verificaEliminabile, spostaInCestino } = require("../db/cestino");

module.exports = (io) => {
  router.get("/", (req, res) => {
    db.all("SELECT * FROM sponsor ORDER BY nome", [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  router.get("/:id", (req, res) => {
    db.get("SELECT * FROM sponsor WHERE id = ?", [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ errore: err.message });
      if (!row) return res.status(404).json({ errore: "Sponsor non trovato" });
      res.json(row);
    });
  });

  router.post("/", (req, res) => {
    const { nome, settore, sito_web } = req.body;
    if (!nome)
      return res.status(400).json({ errore: "Il nome è obbligatorio" });
    db.run(
      "INSERT INTO sponsor (nome, settore, sito_web) VALUES (?, ?, ?)",
      [nome, settore || null, sito_web || null],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuovo = { id: this.lastID, nome, settore, sito_web };
        io.emit("sponsor:aggiornati", { tipo: "creata", dato: nuovo });
        res.status(201).json(nuovo);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const { nome, settore, sito_web } = req.body;
    db.run(
      "UPDATE sponsor SET nome = ?, settore = ?, sito_web = ? WHERE id = ?",
      [nome, settore || null, sito_web || null, req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Sponsor non trovato" });
        io.emit("sponsor:aggiornati", { tipo: "modificata", id: req.params.id });
        res.json({ id: req.params.id, nome, settore, sito_web });
      },
    );
  });

  // Eliminazione (soft-delete): finisce nel cestino solo se non è collegato
  // a nessuna squadra tramite squadra_sponsor.
  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM sponsor WHERE id = ?", [id], (err, riga) => {
      if (err) return res.status(500).json({ errore: err.message });
      if (!riga) return res.status(404).json({ errore: "Sponsor non trovato" });

      verificaEliminabile(
        [
          {
            sql: "SELECT COUNT(*) AS n FROM squadra_sponsor WHERE sponsor_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: lo sponsor è collegato a una o più squadre.",
          },
        ],
        (errVerifica, motivoBlocco) => {
          if (errVerifica)
            return res.status(500).json({ errore: errVerifica.message });
          if (motivoBlocco) return res.status(409).json({ errore: motivoBlocco });

          spostaInCestino("sponsor", riga, (errCestino) => {
            if (errCestino)
              return res.status(500).json({ errore: errCestino.message });
            db.run("DELETE FROM sponsor WHERE id = ?", [id], function (errDel) {
              if (errDel) return res.status(400).json({ errore: errDel.message });
              io.emit("sponsor:aggiornati", { tipo: "eliminata", id });
              io.emit("cestino:aggiornato", { tipo: "creato" });
              res.json({ ok: true, cestino: true });
            });
          });
        },
      );
    });
  });

  return router;
};
