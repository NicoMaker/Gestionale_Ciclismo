const express = require("express");
const router = express.Router();
const db = require("../db/database");

module.exports = (io) => {
  router.get("/", (req, res) => {
    db.all("SELECT * FROM tappe ORDER BY numero_tappa", [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  router.get("/:id", (req, res) => {
    db.get("SELECT * FROM tappe WHERE id = ?", [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ errore: err.message });
      if (!row) return res.status(404).json({ errore: "Tappa non trovata" });
      res.json(row);
    });
  });

  router.post("/", (req, res) => {
    const {
      numero_tappa,
      nome,
      partenza,
      arrivo,
      distanza_km,
      dislivello_m,
      tipo,
      data,
      stato,
    } = req.body;
    if (!numero_tappa || !nome || !partenza || !arrivo) {
      return res.status(400).json({
        errore: "numero_tappa, nome, partenza e arrivo sono obbligatori",
      });
    }
    db.run(
      `INSERT INTO tappe (numero_tappa, nome, partenza, arrivo, distanza_km, dislivello_m, tipo, data, stato)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_tappa,
        nome,
        partenza,
        arrivo,
        distanza_km || null,
        dislivello_m || null,
        tipo || "pianura",
        data || null,
        stato || "programmata",
      ],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuova = {
          id: this.lastID,
          numero_tappa,
          nome,
          partenza,
          arrivo,
          distanza_km,
          dislivello_m,
          tipo,
          data,
          stato,
        };
        io.emit("tappe:aggiornate", { tipo: "creata", dato: nuova });
        res.status(201).json(nuova);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const {
      numero_tappa,
      nome,
      partenza,
      arrivo,
      distanza_km,
      dislivello_m,
      tipo,
      data,
      stato,
    } = req.body;
    db.run(
      `UPDATE tappe SET numero_tappa=?, nome=?, partenza=?, arrivo=?, distanza_km=?, dislivello_m=?, tipo=?, data=?, stato=?
       WHERE id=?`,
      [
        numero_tappa,
        nome,
        partenza,
        arrivo,
        distanza_km,
        dislivello_m,
        tipo,
        data,
        stato,
        req.params.id,
      ],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Tappa non trovata" });
        io.emit("tappe:aggiornate", { tipo: "modificata", id: req.params.id });
        res.json({
          id: req.params.id,
          numero_tappa,
          nome,
          partenza,
          arrivo,
          distanza_km,
          dislivello_m,
          tipo,
          data,
          stato,
        });
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run("DELETE FROM tappe WHERE id = ?", [req.params.id], function (err) {
      if (err) return res.status(400).json({ errore: err.message });
      if (this.changes === 0)
        return res.status(404).json({ errore: "Tappa non trovata" });
      io.emit("tappe:aggiornate", { tipo: "eliminata", id: req.params.id });
      res.json({ ok: true });
    });
  });

  return router;
};
