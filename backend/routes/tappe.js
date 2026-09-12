const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { verificaEliminabile, spostaInCestino } = require("../db/cestino");

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

  // Eliminazione (soft-delete): la tappa finisce nel cestino solo se non
  // ha già dati registrati (risultati, percorso, meteo, alloggi, ecc.)
  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM tappe WHERE id = ?", [id], (err, riga) => {
      if (err) return res.status(500).json({ errore: err.message });
      if (!riga) return res.status(404).json({ errore: "Tappa non trovata" });

      verificaEliminabile(
        [
          {
            sql: "SELECT COUNT(*) AS n FROM risultati WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha già risultati di arrivo registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM tappe_percorso WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha punti di percorso (sprint/GPM) registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM traguardi_volanti WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha traguardi volanti registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM gpm_risultati WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha risultati GPM registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM penalita WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha penalità registrate.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM controlli_antidoping WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha controlli antidoping registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM hotel WHERE tappa_id = ?",
            parametri: [id],
            messaggio: "Impossibile eliminare: la tappa ha alloggi registrati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM meteo_tappa WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha un meteo registrato.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM media_accreditati WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha media accreditati collegati.",
          },
          {
            sql: "SELECT COUNT(*) AS n FROM comunicati_stampa WHERE tappa_id = ?",
            parametri: [id],
            messaggio:
              "Impossibile eliminare: la tappa ha comunicati stampa collegati.",
          },
        ],
        (errVerifica, motivoBlocco) => {
          if (errVerifica)
            return res.status(500).json({ errore: errVerifica.message });
          if (motivoBlocco)
            return res.status(409).json({ errore: motivoBlocco });

          spostaInCestino("tappe", riga, (errCestino) => {
            if (errCestino)
              return res.status(500).json({ errore: errCestino.message });
            db.run("DELETE FROM tappe WHERE id = ?", [id], function (errDel) {
              if (errDel)
                return res.status(400).json({ errore: errDel.message });
              io.emit("tappe:aggiornate", { tipo: "eliminata", id });
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
