const express = require("express");
const router = express.Router();
const db = require("../../db/database");
const { verificaEliminabile, spostaInCestino } = require("../../db/cestino");

module.exports = (io) => {
  // Lista completa — normalizza sempre il codice ISO2 in maiuscolo
  router.get("/", (req, res) => {
    db.all(
      "SELECT id, nome, UPPER(TRIM(codice_iso2)) AS codice_iso2 FROM nazioni ORDER BY nome",
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
      },
    );
  });

  // Ricerca per autocomplete: /api/nazioni/ricerca?q=ita
  router.get("/ricerca", (req, res) => {
    const q = `%${(req.query.q || "").toLowerCase()}%`;
    db.all(
      `SELECT id, nome, UPPER(TRIM(codice_iso2)) AS codice_iso2
       FROM nazioni
       WHERE lower(nome) LIKE ? OR lower(codice_iso2) LIKE ?
       ORDER BY nome LIMIT 15`,
      [q, q],
      (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
      },
    );
  });

  router.get("/:id", (req, res) => {
    db.get(
      "SELECT id, nome, UPPER(TRIM(codice_iso2)) AS codice_iso2 FROM nazioni WHERE id = ?",
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!row)
          return res.status(404).json({ errore: "Nazione non trovata" });
        res.json(row);
      },
    );
  });

  router.post("/", (req, res) => {
    const { nome, codice_iso2 } = req.body;
    if (!nome || !codice_iso2)
      return res
        .status(400)
        .json({ errore: "nome e codice_iso2 sono obbligatori" });

    const codicePulito = String(codice_iso2).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(codicePulito))
      return res
        .status(400)
        .json({ errore: "codice_iso2 deve essere di 2 lettere (es. IT)" });

    db.run(
      "INSERT INTO nazioni (nome, codice_iso2) VALUES (?, ?)",
      [nome.trim(), codicePulito],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuova = {
          id: this.lastID,
          nome: nome.trim(),
          codice_iso2: codicePulito,
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

    const codicePulito = String(codice_iso2).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(codicePulito))
      return res
        .status(400)
        .json({ errore: "codice_iso2 deve essere di 2 lettere (es. IT)" });

    db.run(
      "UPDATE nazioni SET nome = ?, codice_iso2 = ? WHERE id = ?",
      [nome.trim(), codicePulito, req.params.id],
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
          nome: nome.trim(),
          codice_iso2: codicePulito,
        });
      },
    );
  });

  // Eliminazione (soft-delete): la nazione finisce nel cestino solo se non
  // è usata da nessun corridore o squadra.
  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.get(
      "SELECT id, nome, UPPER(TRIM(codice_iso2)) AS codice_iso2 FROM nazioni WHERE id = ?",
      [id],
      (err, riga) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!riga)
          return res.status(404).json({ errore: "Nazione non trovata" });

        verificaEliminabile(
          [
            {
              sql: "SELECT COUNT(*) AS n FROM corridori WHERE nazione_id = ?",
              parametri: [id],
              messaggio:
                "Impossibile eliminare: ci sono corridori con questa nazionalità.",
            },
            {
              sql: "SELECT COUNT(*) AS n FROM squadre WHERE nazione_id = ?",
              parametri: [id],
              messaggio:
                "Impossibile eliminare: ci sono squadre con questa nazionalità.",
            },
          ],
          (errVerifica, motivoBlocco) => {
            if (errVerifica)
              return res.status(500).json({ errore: errVerifica.message });
            if (motivoBlocco)
              return res.status(409).json({ errore: motivoBlocco });

            spostaInCestino("nazioni", riga, (errCestino) => {
              if (errCestino)
                return res.status(500).json({ errore: errCestino.message });
              db.run(
                "DELETE FROM nazioni WHERE id = ?",
                [id],
                function (errDel) {
                  if (errDel)
                    return res.status(400).json({ errore: errDel.message });
                  io.emit("nazioni:aggiornate", { tipo: "eliminata", id });
                  io.emit("cestino:aggiornato", { tipo: "creato" });
                  res.json({ ok: true, cestino: true });
                },
              );
            });
          },
        );
      },
    );
  });

  return router;
};
