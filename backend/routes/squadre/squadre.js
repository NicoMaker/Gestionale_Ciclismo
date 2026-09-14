const express = require("express");
const router = express.Router();
const db = require("../../db/database");
const { verificaEliminabile, spostaInCestino } = require("../../db/cestino");

module.exports = (io) => {
  router.get("/", (req, res) => {
    // numero_corridori: quanti corridori ha in rosa la squadra;
    // numero_corridori_in_gara: quanti di questi sono ancora in gara
    // (esclude ritirati/infortunati/squalificati).
    const sql = `
      SELECT s.*, n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice,
             (SELECT COUNT(*) FROM corridori c WHERE c.squadra_id = s.id) AS numero_corridori,
             (SELECT COUNT(*) FROM corridori c WHERE c.squadra_id = s.id AND COALESCE(c.ritirato, 0) = 0) AS numero_corridori_in_gara
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

  // Eliminazione (soft-delete): la squadra finisce nel cestino solo se non
  // ha corridori o veicoli/staff/hotel/sponsor ancora collegati.
  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM squadre WHERE id = ?", [id], (err, riga) => {
      if (err) return res.status(500).json({ errore: err.message });
      if (!riga) return res.status(404).json({ errore: "Squadra non trovata" });

      verificaEliminabile(
        [
          {
            sql: "SELECT COUNT(*) AS n FROM corridori WHERE squadra_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: ci sono corridori collegati a questa squadra. Riassegnali o eliminali prima.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM staff_tecnico WHERE squadra_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: ci sono membri dello staff tecnico collegati a questa squadra.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM veicoli_squadra WHERE squadra_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: ci sono veicoli collegati a questa squadra.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM squadra_sponsor WHERE squadra_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: ci sono sponsor collegati a questa squadra.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM hotel WHERE squadra_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: ci sono alloggi collegati a questa squadra.",
          },
        ],
        (errVerifica, motivoBlocco) => {
          if (errVerifica)
            return res.status(500).json({ errore: errVerifica.message });
          if (motivoBlocco)
            return res.status(409).json({ errore: motivoBlocco });

          spostaInCestino("squadre", riga, (errCestino) => {
            if (errCestino)
              return res.status(500).json({ errore: errCestino.message });
            db.run("DELETE FROM squadre WHERE id = ?", [id], function (errDel) {
              if (errDel)
                return res.status(400).json({ errore: errDel.message });
              io.emit("squadre:aggiornate", { tipo: "eliminata", id });
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
