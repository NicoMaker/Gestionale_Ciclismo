const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { verificaEliminabile, spostaInCestino } = require("../db/cestino");

module.exports = (io) => {
  router.get("/", (req, res) => {
    const sql = `
      SELECT c.*, s.nome AS squadra_nome, s.colore AS squadra_colore,
             n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice,
             ns.codice_iso2 AS squadra_nazione_codice
      FROM corridori c
      LEFT JOIN squadre s ON c.squadra_id = s.id
      LEFT JOIN nazioni n ON c.nazione_id = n.id
      LEFT JOIN nazioni ns ON s.nazione_id = ns.id
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

  // Eliminazione (soft-delete): il corridore finisce nel cestino solo se
  // non è iscritto/collegato a gare, penalità, controlli o biciclette.
  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM corridori WHERE id = ?", [id], (err, riga) => {
      if (err) return res.status(500).json({ errore: err.message });
      if (!riga)
        return res.status(404).json({ errore: "Corridore non trovato" });

      verificaEliminabile(
        [
          {
            sql: "SELECT COUNT(*) AS n FROM risultati WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore è iscritto a uno o più risultati di tappa.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM traguardi_volanti WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore ha traguardi volanti registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM gpm_risultati WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore ha risultati GPM registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM penalita WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore ha penalità registrate.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM controlli_antidoping WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore ha controlli antidoping registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM biciclette WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore ha biciclette collegate.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM ritiri WHERE corridore_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: il corridore è registrato tra i ritiri.",
          },
        ],
        (errVerifica, motivoBlocco) => {
          if (errVerifica)
            return res.status(500).json({ errore: errVerifica.message });
          if (motivoBlocco)
            return res.status(409).json({ errore: motivoBlocco });

          spostaInCestino("corridori", riga, (errCestino) => {
            if (errCestino)
              return res.status(500).json({ errore: errCestino.message });
            db.run(
              "DELETE FROM corridori WHERE id = ?",
              [id],
              function (errDel) {
                if (errDel)
                  return res.status(400).json({ errore: errDel.message });
                io.emit("corridori:aggiornati", { tipo: "eliminato", id });
                io.emit("cestino:aggiornato", { tipo: "creato" });
                res.json({ ok: true, cestino: true });
              },
            );
          });
        },
      );
    });
  });

  return router;
};
