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

app.disable("x-powered-by");
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// Header di sicurezza di base (senza dipendenze extra)
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
});

// Statici: revalidazione sempre (così gli aggiornamenti si vedono subito), ETag attivo
app.use(
  express.static(path.join(__dirname, "..", "frontend"), {
    etag: true,
    setHeaders: (res) => res.set("Cache-Control", "no-cache"),
  }),
);

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
// Indirizzi di rete locali (tutte le interfacce IPv4 non interne)
// ---------------------------------------------------------------------
function ottieniIpLocali() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

// IP pubblico: richiede un servizio esterno, quindi è solo su richiesta
// (SHOW_PUBLIC_IP=1) e non rallenta mai l'avvio.
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
            resolve(null);
          }
        });
      },
    );
    richiesta.on("timeout", () => richiesta.destroy());
    richiesta.on("error", () => resolve(null));
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n✗ La porta ${PORT} è già in uso. Chiudi l'altro processo oppure avvia con PORT=<altra porta> npm start`,
    );
  } else {
    console.error("\n✗ Errore del server:", err.message);
  }
  process.exit(1);
});

function avviaServer() {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server avviato con successo!`);
    console.log(`📍 Localhost:  http://localhost:${PORT}`);
    ottieniIpLocali().forEach((ip) =>
      console.log(`🏠 Rete locale: http://${ip}:${PORT}`),
    );
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    console.log(`\n--------------------------------------`);
    console.log(
      `⏰ Cron cestino attivo: eliminazione automatica ogni notte alle 00:00`,
    );

    if (process.env.SHOW_PUBLIC_IP === "1") {
      ottieniIpPubblico().then((ip) =>
        console.log(
          ip
            ? `🌐 IP pubblico: ${ip} (raggiungibile solo con port forwarding)`
            : "🌐 IP pubblico non disponibile",
        ),
      );
    }
  });
}

avviaServer();

// Chiusura pulita: smette di accettare connessioni e chiude il database
function chiudi(segnale) {
  console.log(`\n${segnale} ricevuto: chiusura in corso…`);
  io.close();
  server.close(() => {
    db.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => chiudi(sig)));
