const express = require("express");
const router = express.Router();
const db = require("../db/database");

/* ---------------------------------------------------------------------
 * Helper per convertire i tempi "HH:MM:SS" (colonna risultati.tempo,
 * usata anche per i totali > 24h delle classifiche a tempo) da/verso i
 * secondi, così da poterli sommare correttamente.
 * ------------------------------------------------------------------- */
function tempoInSecondi(tempo) {
  if (!tempo) return 0;
  const parti = String(tempo)
    .trim()
    .replace(/^\+/, "")
    .split(":")
    .map((p) => parseInt(p, 10));
  if (parti.length === 0 || parti.some((n) => Number.isNaN(n))) return 0;
  while (parti.length < 3) parti.unshift(0);
  const [h, m, s] = parti.slice(-3);
  return h * 3600 + m * 60 + s;
}

function secondiInTempo(totaleSecondi) {
  const s = Math.max(0, Math.round(totaleSecondi));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return [h, m, r].map((v) => String(v).padStart(2, "0")).join(":");
}

module.exports = (io) => {
  /* ---------------------------------------------------------------------
   * Somma, per ogni corridore, tutti i tempi di tappa disputati (colonna
   * risultati.tempo) più le eventuali penalità in secondi. È la base
   * comune per: classifica generale a tempo, classifica giovani e
   * classifica a squadre (che è la somma dei tempi dei suoi corridori).
   * ------------------------------------------------------------------- */
  function ottieniTempiCorridori(callback) {
    const sqlRisultati = `
      SELECT c.id, c.nome, c.cognome, c.numero_pettorale, c.data_nascita,
             s.id AS squadra_id, s.nome AS squadra_nome, s.colore AS squadra_colore,
             n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice,
             r.tempo
      FROM corridori c
      LEFT JOIN squadre s ON c.squadra_id = s.id
      LEFT JOIN nazioni n ON c.nazione_id = n.id
      LEFT JOIN risultati r ON r.corridore_id = c.id
    `;
    db.all(sqlRisultati, [], (err, righe) => {
      if (err) return callback(err);
      db.all(
        "SELECT corridore_id, SUM(secondi) AS secondi FROM penalita GROUP BY corridore_id",
        [],
        (err2, penalita) => {
          if (err2) return callback(err2);
          const secondiPenalita = new Map(
            penalita.map((p) => [p.corridore_id, p.secondi || 0]),
          );
          const mappa = new Map();
          for (const r of righe) {
            if (!mappa.has(r.id)) {
              mappa.set(r.id, {
                id: r.id,
                nome: r.nome,
                cognome: r.cognome,
                numero_pettorale: r.numero_pettorale,
                data_nascita: r.data_nascita,
                squadra_id: r.squadra_id,
                squadra_nome: r.squadra_nome,
                squadra_colore: r.squadra_colore,
                nazione_nome: r.nazione_nome,
                nazione_codice: r.nazione_codice,
                tappe_disputate: 0,
                secondi_totali: 0,
              });
            }
            if (r.tempo) {
              const voce = mappa.get(r.id);
              voce.tappe_disputate += 1;
              voce.secondi_totali += tempoInSecondi(r.tempo);
            }
          }
          for (const voce of mappa.values()) {
            voce.secondi_totali += secondiPenalita.get(voce.id) || 0;
          }
          callback(null, Array.from(mappa.values()));
        },
      );
    });
  }

  // aggiunge tempo_totale/distacco formattati, ordinando per secondi_totali crescenti
  function conDistacco(elenco) {
    const ordinato = [...elenco].sort(
      (a, b) => a.secondi_totali - b.secondi_totali,
    );
    const secondiLeader = ordinato[0]?.secondi_totali ?? 0;
    return ordinato.map((v) => ({
      ...v,
      tempo_totale: secondiInTempo(v.secondi_totali),
      distacco:
        v.secondi_totali === secondiLeader
          ? "00:00:00"
          : "+" + secondiInTempo(v.secondi_totali - secondiLeader),
    }));
  }

  // Risultati di una tappa
  router.get("/tappa/:tappaId", (req, res) => {
    const sql = `
      SELECT r.*, c.nome, c.cognome, c.numero_pettorale, s.nome AS squadra_nome
      FROM risultati r
      JOIN corridori c ON r.corridore_id = c.id
      LEFT JOIN squadre s ON c.squadra_id = s.id
      WHERE r.tappa_id = ?
      ORDER BY r.posizione ASC
    `;
    db.all(sql, [req.params.tappaId], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  // Classifica generale a punti (maglia ciclamino), penalità in punti incluse
  router.get("/classifica-generale", (req, res) => {
    const sql = `
      SELECT c.id, c.nome, c.cognome, c.numero_pettorale, s.nome AS squadra_nome,
             n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice,
             COALESCE((SELECT SUM(r.punti) FROM risultati r WHERE r.corridore_id = c.id), 0)
               - COALESCE((SELECT SUM(p.punti) FROM penalita p WHERE p.corridore_id = c.id), 0)
               AS punti_totali,
             (SELECT COUNT(*) FROM risultati r WHERE r.corridore_id = c.id) AS tappe_disputate
      FROM corridori c
      LEFT JOIN squadre s ON c.squadra_id = s.id
      LEFT JOIN nazioni n ON c.nazione_id = n.id
      GROUP BY c.id
      ORDER BY punti_totali DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows.filter((r) => r.tappe_disputate > 0));
    });
  });

  // Classifica generale a tempo (maglia rosa): somma dei tempi di tutte le
  // tappe disputate da ciascun corridore (+ eventuali penalità in secondi).
  // Vince chi ha il tempo totale più basso.
  router.get("/classifica-tempo", (req, res) => {
    ottieniTempiCorridori((err, corridori) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(conDistacco(corridori.filter((c) => c.tappe_disputate > 0)));
    });
  });

  // Classifica giovani (maglia bianca): come la generale a tempo, ma solo
  // per i corridori che nell'anno della corsa hanno 25 anni o meno.
  router.get("/classifica-giovani", (req, res) => {
    db.get(
      "SELECT MAX(CAST(strftime('%Y', data) AS INTEGER)) AS anno FROM tappe WHERE data IS NOT NULL",
      [],
      (errAnno, rigaAnno) => {
        if (errAnno) return res.status(500).json({ errore: errAnno.message });
        const annoRiferimento = rigaAnno?.anno || new Date().getFullYear();
        const annoLimite = annoRiferimento - 25;
        ottieniTempiCorridori((err, corridori) => {
          if (err) return res.status(500).json({ errore: err.message });
          const giovani = corridori
            .filter((c) => c.tappe_disputate > 0 && c.data_nascita)
            .filter(
              (c) => new Date(c.data_nascita).getFullYear() >= annoLimite,
            )
            .map((c) => ({
              ...c,
              eta: annoRiferimento - new Date(c.data_nascita).getFullYear(),
            }));
          res.json(conDistacco(giovani));
        });
      },
    );
  });

  // Classifica scalatori / GPM (maglia verde): somma dei punti GPM
  // conquistati sui gran premi della montagna. Vince chi ne ha di più.
  router.get("/classifica-montagna", (req, res) => {
    const sql = `
      SELECT c.id, c.nome, c.cognome, c.numero_pettorale,
             s.nome AS squadra_nome, s.colore AS squadra_colore,
             n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice,
             SUM(g.punti) AS punti_totali,
             COUNT(g.id) AS gpm_disputati
      FROM gpm_risultati g
      JOIN corridori c ON g.corridore_id = c.id
      LEFT JOIN squadre s ON c.squadra_id = s.id
      LEFT JOIN nazioni n ON c.nazione_id = n.id
      GROUP BY c.id
      ORDER BY punti_totali DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ errore: err.message });
      res.json(rows);
    });
  });

  // Classifica a squadre: somma di tutti i tempi di tutti i corridori di
  // ogni squadra. La squadra con il totale più basso è quella in testa.
  router.get("/classifica-squadre", (req, res) => {
    ottieniTempiCorridori((err, corridori) => {
      if (err) return res.status(500).json({ errore: err.message });
      db.all(
        `SELECT s.id, s.nome, s.colore, n.nome AS nazione_nome, n.codice_iso2 AS nazione_codice
         FROM squadre s LEFT JOIN nazioni n ON s.nazione_id = n.id`,
        [],
        (err2, squadre) => {
          if (err2) return res.status(500).json({ errore: err2.message });
          const infoSquadra = new Map(squadre.map((s) => [s.id, s]));
          const aggregati = new Map();
          for (const c of corridori) {
            if (!c.squadra_id || c.tappe_disputate === 0) continue;
            if (!aggregati.has(c.squadra_id)) {
              aggregati.set(c.squadra_id, {
                corridori_contati: 0,
                secondi_totali: 0,
              });
            }
            const voce = aggregati.get(c.squadra_id);
            voce.corridori_contati += 1;
            voce.secondi_totali += c.secondi_totali;
          }
          const classifica = Array.from(aggregati.entries()).map(
            ([squadraId, voce]) => {
              const s = infoSquadra.get(squadraId) || {};
              return {
                squadra_id: squadraId,
                squadra_nome: s.nome ?? "—",
                squadra_colore: s.colore ?? "#e6197f",
                nazione_nome: s.nazione_nome ?? null,
                nazione_codice: s.nazione_codice ?? null,
                corridori_contati: voce.corridori_contati,
                secondi_totali: voce.secondi_totali,
              };
            },
          );
          res.json(conDistacco(classifica));
        },
      );
    });
  });

  // Inserisci/aggiorna risultato (upsert)
  router.post("/", (req, res) => {
    const { tappa_id, corridore_id, posizione, tempo, distacco, punti } =
      req.body;
    if (!tappa_id || !corridore_id) {
      return res
        .status(400)
        .json({ errore: "tappa_id e corridore_id sono obbligatori" });
    }
    const sql = `
      INSERT INTO risultati (tappa_id, corridore_id, posizione, tempo, distacco, punti)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tappa_id, corridore_id) DO UPDATE SET
        posizione = excluded.posizione,
        tempo = excluded.tempo,
        distacco = excluded.distacco,
        punti = excluded.punti
    `;
    db.run(
      sql,
      [
        tappa_id,
        corridore_id,
        posizione || null,
        tempo || null,
        distacco || "00:00:00",
        punti || 0,
      ],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        const risultato = {
          tappa_id,
          corridore_id,
          posizione,
          tempo,
          distacco,
          punti,
        };
        io.emit("risultati:aggiornati", { tipo: "salvato", dato: risultato });
        res.status(201).json(risultato);
      },
    );
  });

  router.delete("/:id", (req, res) => {
    db.run(
      "DELETE FROM risultati WHERE id = ?",
      [req.params.id],
      function (err) {
        if (err) return res.status(400).json({ errore: err.message });
        if (this.changes === 0)
          return res.status(404).json({ errore: "Risultato non trovato" });
        io.emit("risultati:aggiornati", {
          tipo: "eliminato",
          id: req.params.id,
        });
        res.json({ ok: true });
      },
    );
  });

  return router;
};
