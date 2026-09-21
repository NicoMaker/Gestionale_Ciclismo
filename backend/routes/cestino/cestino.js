const express = require("express");
const router = express.Router();
const db = require("../../db/database");
const { GIORNI_RITENZIONE } = require("../../db/cestino");

// Etichette leggibili per il frontend
const ETICHETTE = {
  squadre: "Squadra",
  corridori: "Corridore",
  tappe: "Tappa",
  nazioni: "Nazione",
  sponsor: "Sponsor",
};

// Estrae una descrizione leggibile dai dati salvati, per entità
function descrizione(entita, dati) {
  switch (entita) {
    case "squadre":
      return dati.nome;
    case "corridori":
      return `${dati.nome} ${dati.cognome}`;
    case "tappe":
      return `Tappa ${dati.numero_tappa} — ${dati.nome}`;
    case "nazioni":
      return `${dati.nome} (${dati.codice_iso2})`;
    case "sponsor":
      return dati.nome;
    default:
      return `#${dati.id}`;
  }
}

/* ---------------------------------------------------------------------
 * Validatori di ripristino: verificano che il ripristino non generi
 * conflitti (unicità) o riferimenti a entità collegate ormai inesistenti.
 * cb(err, motivoBlocco) — motivoBlocco null/undefined => si può ripristinare
 * ------------------------------------------------------------------- */
function validaRipristino(entita, dati, cb) {
  if (entita === "squadre") {
    db.get(
      "SELECT id FROM squadre WHERE nome = ? AND id != ?",
      [dati.nome, dati.id],
      (err, conflitto) => {
        if (err) return cb(err);
        if (conflitto)
          return cb(
            null,
            `Esiste già un'altra squadra chiamata "${dati.nome}".`,
          );
        if (!dati.nazione_id) return cb(null, null);
        db.get(
          "SELECT id FROM nazioni WHERE id = ?",
          [dati.nazione_id],
          (err2, naz) => {
            if (err2) return cb(err2);
            if (!naz)
              return cb(
                null,
                "La nazione originaria di questa squadra non esiste più: modifica prima i dati o ricrea la nazione.",
              );
            cb(null, null);
          },
        );
      },
    );
    return;
  }

  if (entita === "corridori") {
    const controllaSquadra = (next) => {
      if (!dati.squadra_id) return next();
      db.get(
        "SELECT id FROM squadre WHERE id = ?",
        [dati.squadra_id],
        (err, s) => {
          if (err) return cb(err);
          if (!s)
            return cb(
              null,
              "La squadra originaria di questo corridore non esiste più.",
            );
          next();
        },
      );
    };
    const controllaNazione = (next) => {
      if (!dati.nazione_id) return next();
      db.get(
        "SELECT id FROM nazioni WHERE id = ?",
        [dati.nazione_id],
        (err, n) => {
          if (err) return cb(err);
          if (!n)
            return cb(
              null,
              "La nazione originaria di questo corridore non esiste più.",
            );
          next();
        },
      );
    };
    const controllaPettorale = (next) => {
      if (!dati.numero_pettorale) return next();
      db.get(
        "SELECT id FROM corridori WHERE numero_pettorale = ? AND id != ?",
        [dati.numero_pettorale, dati.id],
        (err, conflitto) => {
          if (err) return cb(err);
          if (conflitto)
            return cb(
              null,
              `Il pettorale n. ${dati.numero_pettorale} è già assegnato a un altro corridore.`,
            );
          next();
        },
      );
    };
    controllaSquadra(() =>
      controllaNazione(() => controllaPettorale(() => cb(null, null))),
    );
    return;
  }

  if (entita === "tappe") {
    db.get(
      "SELECT id FROM tappe WHERE numero_tappa = ? AND id != ?",
      [dati.numero_tappa, dati.id],
      (err, conflitto) => {
        if (err) return cb(err);
        if (conflitto)
          return cb(
            null,
            `Esiste già un'altra tappa con il numero ${dati.numero_tappa}.`,
          );
        cb(null, null);
      },
    );
    return;
  }

  if (entita === "nazioni") {
    db.get(
      "SELECT id FROM nazioni WHERE (nome = ? OR codice_iso2 = ?) AND id != ?",
      [dati.nome, dati.codice_iso2, dati.id],
      (err, conflitto) => {
        if (err) return cb(err);
        if (conflitto)
          return cb(
            null,
            `Esiste già una nazione con lo stesso nome o codice ISO2 (${dati.codice_iso2}).`,
          );
        cb(null, null);
      },
    );
    return;
  }

  if (entita === "sponsor") {
    return cb(null, null);
  }

  cb(null, "Tipo di elemento del cestino non riconosciuto.");
}

/* ---------------------------------------------------------------------
 * Inserimenti di ripristino: reinseriscono la riga con lo stesso id
 * originale (se ancora libero) e tutte le colonne salvate.
 * ------------------------------------------------------------------- */
function eseguiRipristino(entita, dati, cb) {
  if (entita === "squadre") {
    return db.run(
      `INSERT INTO squadre (id, nome, nazione_id, colore, creato_il) VALUES (?, ?, ?, ?, ?)`,
      [
        dati.id,
        dati.nome,
        dati.nazione_id || null,
        dati.colore || "#e6197f",
        dati.creato_il || new Date().toISOString(),
      ],
      cb,
    );
  }
  if (entita === "corridori") {
    return db.run(
      `INSERT INTO corridori (id, nome, cognome, numero_pettorale, nazione_id, squadra_id, data_nascita, creato_il)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dati.id,
        dati.nome,
        dati.cognome,
        dati.numero_pettorale || null,
        dati.nazione_id || null,
        dati.squadra_id || null,
        dati.data_nascita || null,
        dati.creato_il || new Date().toISOString(),
      ],
      cb,
    );
  }
  if (entita === "tappe") {
    return db.run(
      `INSERT INTO tappe (id, numero_tappa, nome, partenza, arrivo, distanza_km, dislivello_m, tipo, data, stato, creato_il)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dati.id,
        dati.numero_tappa,
        dati.nome,
        dati.partenza,
        dati.arrivo,
        dati.distanza_km ?? null,
        dati.dislivello_m ?? null,
        dati.tipo || "pianura",
        dati.data || null,
        dati.stato || "programmata",
        dati.creato_il || new Date().toISOString(),
      ],
      cb,
    );
  }
  if (entita === "nazioni") {
    return db.run(
      `INSERT INTO nazioni (id, nome, codice_iso2) VALUES (?, ?, ?)`,
      [dati.id, dati.nome, dati.codice_iso2],
      cb,
    );
  }
  if (entita === "sponsor") {
    return db.run(
      `INSERT INTO sponsor (id, nome, settore, sito_web, creato_il) VALUES (?, ?, ?, ?, ?)`,
      [
        dati.id,
        dati.nome,
        dati.settore || null,
        dati.sito_web || null,
        dati.creato_il || new Date().toISOString(),
      ],
      cb,
    );
  }
  cb(new Error("Tipo di elemento non riconosciuto"));
}

module.exports = (io) => {
  // Elenco cestino, con giorni rimanenti prima della scadenza automatica
  router.get("/", (req, res) => {
    db.all(
      "SELECT * FROM cestino ORDER BY eliminato_il DESC",
      [],
      (err, righe) => {
        if (err) return res.status(500).json({ errore: err.message });
        const risultato = righe.map((r) => {
          const dati = JSON.parse(r.dati);
          const msRimanenti = new Date(r.scade_il).getTime() - Date.now();
          return {
            id: r.id,
            entita: r.entita,
            etichetta: ETICHETTE[r.entita] || r.entita,
            entita_id: r.entita_id,
            descrizione: descrizione(r.entita, dati),
            dati,
            eliminato_il: r.eliminato_il,
            scade_il: r.scade_il,
            giorni_rimanenti: Math.max(
              0,
              Math.ceil(msRimanenti / (24 * 60 * 60 * 1000)),
            ),
          };
        });
        res.json(risultato);
      },
    );
  });

  router.get("/config", (req, res) => {
    res.json({ giorni_ritenzione: GIORNI_RITENZIONE });
  });

  // Ripristina un elemento, solo se non genera conflitti/riferimenti rotti
  router.post("/:id/ripristina", (req, res) => {
    db.get(
      "SELECT * FROM cestino WHERE id = ?",
      [req.params.id],
      (err, riga) => {
        if (err) return res.status(500).json({ errore: err.message });
        if (!riga)
          return res
            .status(404)
            .json({ errore: "Elemento del cestino non trovato" });

        const dati = JSON.parse(riga.dati);

        validaRipristino(riga.entita, dati, (errValida, motivoBlocco) => {
          if (errValida)
            return res.status(500).json({ errore: errValida.message });
          if (motivoBlocco)
            return res.status(409).json({ errore: motivoBlocco });

          eseguiRipristino(riga.entita, dati, function (errIns) {
            if (errIns)
              return res.status(409).json({
                errore:
                  "Impossibile ripristinare: " +
                  errIns.message +
                  ". Probabilmente esiste già un elemento con lo stesso identificativo.",
              });

            db.run("DELETE FROM cestino WHERE id = ?", [riga.id], (errDel) => {
              if (errDel)
                return res.status(500).json({ errore: errDel.message });
              io.emit(`${riga.entita}:aggiornate`, { tipo: "creata" });
              io.emit(`${riga.entita}:aggiornati`, { tipo: "creata" });
              io.emit("cestino:aggiornato", { tipo: "ripristinato" });
              res.json({ ok: true, entita: riga.entita, dati });
            });
          });
        });
      },
    );
  });

  // Elimina definitivamente e in modo permanente un singolo elemento del cestino
  router.delete("/:id", (req, res) => {
    db.run("DELETE FROM cestino WHERE id = ?", [req.params.id], function (err) {
      if (err) return res.status(400).json({ errore: err.message });
      if (this.changes === 0)
        return res
          .status(404)
          .json({ errore: "Elemento del cestino non trovato" });
      io.emit("cestino:aggiornato", { tipo: "eliminato_definitivo" });
      res.json({ ok: true });
    });
  });

  // Svuota completamente e definitivamente il cestino
  router.delete("/", (req, res) => {
    db.run("DELETE FROM cestino", [], function (err) {
      if (err) return res.status(500).json({ errore: err.message });
      io.emit("cestino:aggiornato", { tipo: "svuotato" });
      res.json({ ok: true, eliminati: this.changes });
    });
  });

  return router;
};
