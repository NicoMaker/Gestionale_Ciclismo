const express = require("express");
const db = require("../db/database");

/**
 * Crea un router CRUD generico per una tabella.
 * @param {string} tabella - nome tabella SQL
 * @param {string[]} colonne - colonne scrivibili (senza id/creato_il)
 * @param {object} io - istanza Socket.IO per notificare i client
 * @param {string} eventoBase - prefisso evento socket (es. 'sponsor')
 * @param {string} [orderBy] - colonna di ordinamento (default: id)
 */
function creaRouterGenerico(tabella, colonne, io, eventoBase, orderBy = "id") {
  const router = express.Router();

  router.get("/", (req, res) => {
    db.all(`SELECT * FROM ${tabella} ORDER BY ${orderBy}`, [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  router.get("/:id", (req, res) => {
    db.get(
      `SELECT * FROM ${tabella} WHERE id = ?`,
      [req.params.id],
      (err, row) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!row) return res.status(404).json({ errore: "Riga non trovata" });
        res.json(row);
      },
    );
  });

  router.post("/", (req, res) => {
    const valori = colonne.map((c) =>
      req.body[c] === undefined || req.body[c] === "" ? null : req.body[c],
    );
    const placeholders = colonne.map(() => "?").join(", ");
    db.run(
      `INSERT INTO ${tabella} (${colonne.join(", ")}) VALUES (${placeholders})`,
      valori,
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const nuovo = { id: this.lastID, ...req.body };
        io.emit(`${eventoBase}:aggiornati`, { tipo: "creata", dato: nuovo });
        res.status(201).json(nuovo);
      },
    );
  });

  router.put("/:id", (req, res) => {
    const valori = colonne.map((c) =>
      req.body[c] === undefined || req.body[c] === "" ? null : req.body[c],
    );
    const setClause = colonne.map((c) => `${c} = ?`).join(", ");
    db.run(
      `UPDATE ${tabella} SET ${setClause} WHERE id = ?`,
      [...valori, req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Riga non trovata" });
        io.emit(`${eventoBase}:aggiornati`, {
          tipo: "modificata",
          id: req.params.id,
        });
        res.json({ id: req.params.id, ...req.body });
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run(
      `DELETE FROM ${tabella} WHERE id = ?`,
      [req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Riga non trovata" });
        io.emit(`${eventoBase}:aggiornati`, {
          tipo: "eliminata",
          id: req.params.id,
        });
        res.json({ ok: true });
      },
    );
  });

  return router;
}

module.exports = creaRouterGenerico;
