const express = require("express");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const { Server } = require("socket.io");

const db = require("./db/database"); // inizializza lo schema al boot
const { eliminaScaduti } = require("./db/cestino");
const creaRouterGenerico = require("./routes/generic/generic");

// Validazione condivisa: un corridore ritirato/squalificato non può avere
// una riga (risultato, traguardo volante, GPM...) per le tappe successive
// a quella del ritiro; la tappa del ritiro stessa resta ammessa (es.
// abbandono in corsa: va comunque registrato il risultato di quella
// tappa), così come quelle precedenti, per poter correggere dati storici
// già disputati prima del ritiro.
function validaCorridoreAmmessoPerTappa(body, callback) {
  const { corridore_id, tappa_id } = body;
  if (!corridore_id || !tappa_id) return callback(null, null);
  db.get(
    `SELECT c.ritirato, c.ritirato_tappa_numero, t.numero_tappa
     FROM corridori c, tappe t
     WHERE c.id = ? AND t.id = ?`,
    [corridore_id, tappa_id],
    (err, riga) => {
      if (err) return callback(err);
      if (!riga || !riga.ritirato) return callback(null, null);
      const ammesso =
        riga.ritirato_tappa_numero != null &&
        riga.numero_tappa <= riga.ritirato_tappa_numero;
      callback(
        null,
        ammesso
          ? null
          : "Il corridore è ritirato/squalificato e non può avere risultati da quella tappa in poi",
      );
    },
  );
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Stato live in memoria (es. tappa attualmente "in diretta")
const statoLive = {
  tappaInCorsoId: null,
  spettatoriConnessi: 0,
};

// ---- Route con logica dedicata (join, validazioni specifiche) ----
app.use("/api/nazioni", require("./routes/nazioni/nazioni")(io));
app.use("/api/squadre", require("./routes/squadre/squadre")(io));
app.use("/api/corridori", require("./routes/corridori/corridori")(io));
app.use("/api/tappe", require("./routes/tappe/tappe")(io));
app.use("/api/risultati", require("./routes/risultati/risultati")(io));
app.use("/api/sponsor", require("./routes/sponsor/sponsor")(io));
app.use("/api/cestino", require("./routes/cestino/cestino")(io));

// ---- Route generiche CRUD per le tabelle secondarie (14 tabelle) ----
app.use(
  "/api/staff-tecnico",
  creaRouterGenerico(
    "staff_tecnico",
    ["nome", "cognome", "ruolo", "squadra_id"],
    io,
    "staff-tecnico",
    "cognome",
  ),
);
app.use(
  "/api/tappe-percorso",
  creaRouterGenerico(
    "tappe_percorso",
    ["tappa_id", "km", "tipo", "nome_luogo", "categoria"],
    io,
    "tappe-percorso",
    "km",
  ),
);
app.use(
  "/api/classifiche-tipo",
  creaRouterGenerico(
    "classifiche_tipo",
    ["nome", "descrizione"],
    io,
    "classifiche-tipo",
    "nome",
  ),
);
app.use(
  "/api/traguardi-volanti",
  creaRouterGenerico(
    "traguardi_volanti",
    ["tappa_id", "corridore_id", "posizione", "punti"],
    io,
    "traguardi-volanti",
    "posizione",
    validaCorridoreAmmessoPerTappa,
  ),
);
app.use(
  "/api/gpm-risultati",
  creaRouterGenerico(
    "gpm_risultati",
    ["tappa_id", "corridore_id", "posizione", "punti"],
    io,
    "gpm-risultati",
    "posizione",
    validaCorridoreAmmessoPerTappa,
  ),
);
app.use(
  "/api/abbuoni",
  creaRouterGenerico(
    "abbuoni_classifica",
    ["posizione", "secondi"],
    io,
    "abbuoni",
    "posizione",
  ),
);
app.use(
  "/api/penalita",
  creaRouterGenerico(
    "penalita",
    ["corridore_id", "tappa_id", "motivo", "secondi", "punti"],
    io,
    "penalita",
    "id",
  ),
);
// Route dedicata (non generica): un esito "positivo" squalifica in
// automatico il corridore e lo esclude dalle tappe successive.
app.use(
  "/api/controlli-antidoping",
  require("./routes/controlli-antidoping/controlli-antidoping")(io),
);
app.use(
  "/api/biciclette",
  creaRouterGenerico(
    "biciclette",
    ["corridore_id", "marca", "modello", "telaio"],
    io,
    "biciclette",
    "marca",
  ),
);
app.use(
  "/api/squadra-sponsor",
  creaRouterGenerico(
    "squadra_sponsor",
    ["squadra_id", "sponsor_id", "tipo"],
    io,
    "squadra-sponsor",
    "id",
  ),
);
app.use(
  "/api/veicoli-squadra",
  creaRouterGenerico(
    "veicoli_squadra",
    ["squadra_id", "tipo", "targa", "modello"],
    io,
    "veicoli-squadra",
    "id",
  ),
);
app.use(
  "/api/hotel",
  creaRouterGenerico(
    "hotel",
    ["tappa_id", "squadra_id", "nome", "citta", "indirizzo"],
    io,
    "hotel",
    "citta",
  ),
);
app.use(
  "/api/meteo-tappa",
  creaRouterGenerico(
    "meteo_tappa",
    ["tappa_id", "temperatura", "condizione", "vento_kmh"],
    io,
    "meteo-tappa",
    "id",
  ),
);
app.use(
  "/api/media-accreditati",
  creaRouterGenerico(
    "media_accreditati",
    ["nome", "testata", "tipo", "tappa_id"],
    io,
    "media-accreditati",
    "nome",
  ),
);
app.use(
  "/api/comunicati-stampa",
  creaRouterGenerico(
    "comunicati_stampa",
    ["titolo", "contenuto", "data", "tappa_id"],
    io,
    "comunicati-stampa",
    "data",
  ),
);

app.get("/api/stato-live", (req, res) => res.json(statoLive));
app.get("/api/health", (req, res) =>
  res.json({ ok: true, timestamp: new Date().toISOString() }),
);

// Socket.IO - dati realtime in memoria
io.on("connection", (socket) => {
  statoLive.spettatoriConnessi++;
  io.emit("stato-live:aggiornato", statoLive);
  console.log(
    `⚡ Client connesso (${socket.id}) - totale: ${statoLive.spettatoriConnessi}`,
  );

  socket.on("tappa:avvia-diretta", (tappaId) => {
    statoLive.tappaInCorsoId = tappaId;
    io.emit("stato-live:aggiornato", statoLive);
  });

  socket.on("tappa:chiudi-diretta", () => {
    statoLive.tappaInCorsoId = null;
    io.emit("stato-live:aggiornato", statoLive);
  });

  socket.on("disconnect", () => {
    statoLive.spettatoriConnessi = Math.max(
      0,
      statoLive.spettatoriConnessi - 1,
    );
    io.emit("stato-live:aggiornato", statoLive);
    console.log(
      `✗ Client disconnesso (${socket.id}) - totale: ${statoLive.spettatoriConnessi}`,
    );
  });
});

// ---------------------------------------------------------------------
// Cron cestino: ogni notte alle 00:00 elimina in modo permanente e
// definitivo tutte le voci del cestino la cui ritenzione (15 giorni) è
// scaduta.
// ---------------------------------------------------------------------
cron.schedule("0 0 * * *", () => {
  eliminaScaduti((err, eliminati) => {
    if (err) {
      console.error("✗ Cron cestino — errore:", err.message);
      return;
    }
    console.log(
      `🗑️  Cron cestino: ${eliminati} elemento/i scaduto/i eliminato/i definitivamente`,
    );
  });
});

// ---------------------------------------------------------------------
// Individua l'IP locale (rete privata) tra le interfacce di rete
// ---------------------------------------------------------------------
function ottieniIpLocale() {
  const interfacce = os.networkInterfaces();
  for (const nome of Object.keys(interfacce)) {
    for (const dettaglio of interfacce[nome] || []) {
      if (dettaglio.family === "IPv4" && !dettaglio.internal) {
        return dettaglio.address;
      }
    }
  }
  return "127.0.0.1";
}

// Recupera l'IP pubblico tramite un servizio esterno (best-effort: se non
// c'è connessione a internet, si limita a segnalarlo senza bloccare l'avvio)
function ottieniIpPubblico() {
  return new Promise((resolve) => {
    const richiesta = https.get(
      "https://api.ipify.org?format=json",
      { timeout: 3000 },
      (res) => {
        let corpo = "";
        res.on("data", (chunk) => (corpo += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(corpo).ip);
          } catch {
            resolve("non disponibile");
          }
        });
      },
    );
    richiesta.on("timeout", () => {
      richiesta.destroy();
      resolve("non disponibile");
    });
    richiesta.on("error", () => resolve("non disponibile"));
  });
}

async function avviaServer() {
  const localIP = ottieniIpLocale();
  const publicIP = await ottieniIpPubblico();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server avviato con successo!`);
    console.log(`🌐 IP Pubblico: http://${publicIP}:${PORT}`);
    console.log(`🏠 IP Locale: http://${localIP}:${PORT}`);
    console.log(`📍 Localhost: http://localhost:${PORT}`);
    console.log(`\n--------------------------------------`);
    console.log(
      `⏰ Cron cestino attivo: eliminazione automatica ogni notte alle 00:00`,
    );
  });
}

avviaServer();
