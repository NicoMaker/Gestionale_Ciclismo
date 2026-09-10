const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');

require('./db/database'); // inizializza lo schema al boot
const creaRouterGenerico = require('./routes/generic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Stato live in memoria (es. tappa attualmente "in diretta")
const statoLive = {
  tappaInCorsoId: null,
  spettatoriConnessi: 0
};

// ---- Route con logica dedicata (join, validazioni specifiche) ----
app.use('/api/nazioni', require('./routes/nazioni')(io));
app.use('/api/squadre', require('./routes/squadre')(io));
app.use('/api/corridori', require('./routes/corridori')(io));
app.use('/api/tappe', require('./routes/tappe')(io));
app.use('/api/risultati', require('./routes/risultati')(io));

// ---- Route generiche CRUD per le tabelle secondarie (15 tabelle) ----
app.use('/api/staff-tecnico', creaRouterGenerico('staff_tecnico', ['nome','cognome','ruolo','squadra_id'], io, 'staff-tecnico', 'cognome'));
app.use('/api/tappe-percorso', creaRouterGenerico('tappe_percorso', ['tappa_id','km','tipo','nome_luogo','categoria'], io, 'tappe-percorso', 'km'));
app.use('/api/classifiche-tipo', creaRouterGenerico('classifiche_tipo', ['nome','descrizione'], io, 'classifiche-tipo', 'nome'));
app.use('/api/traguardi-volanti', creaRouterGenerico('traguardi_volanti', ['tappa_id','corridore_id','posizione','punti'], io, 'traguardi-volanti', 'posizione'));
app.use('/api/gpm-risultati', creaRouterGenerico('gpm_risultati', ['tappa_id','corridore_id','posizione','punti'], io, 'gpm-risultati', 'posizione'));
app.use('/api/penalita', creaRouterGenerico('penalita', ['corridore_id','tappa_id','motivo','secondi','punti'], io, 'penalita', 'id'));
app.use('/api/controlli-antidoping', creaRouterGenerico('controlli_antidoping', ['corridore_id','tappa_id','data','esito'], io, 'controlli-antidoping', 'data'));
app.use('/api/biciclette', creaRouterGenerico('biciclette', ['corridore_id','marca','modello','telaio'], io, 'biciclette', 'marca'));
app.use('/api/sponsor', creaRouterGenerico('sponsor', ['nome','settore','sito_web'], io, 'sponsor', 'nome'));
app.use('/api/squadra-sponsor', creaRouterGenerico('squadra_sponsor', ['squadra_id','sponsor_id','tipo'], io, 'squadra-sponsor', 'id'));
app.use('/api/veicoli-squadra', creaRouterGenerico('veicoli_squadra', ['squadra_id','tipo','targa','modello'], io, 'veicoli-squadra', 'id'));
app.use('/api/hotel', creaRouterGenerico('hotel', ['tappa_id','squadra_id','nome','citta','indirizzo'], io, 'hotel', 'citta'));
app.use('/api/meteo-tappa', creaRouterGenerico('meteo_tappa', ['tappa_id','temperatura','condizione','vento_kmh'], io, 'meteo-tappa', 'id'));
app.use('/api/media-accreditati', creaRouterGenerico('media_accreditati', ['nome','testata','tipo','tappa_id'], io, 'media-accreditati', 'nome'));
app.use('/api/comunicati-stampa', creaRouterGenerico('comunicati_stampa', ['titolo','contenuto','data','tappa_id'], io, 'comunicati-stampa', 'data'));

app.get('/api/stato-live', (req, res) => res.json(statoLive));
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Socket.IO - dati realtime in memoria
io.on('connection', (socket) => {
  statoLive.spettatoriConnessi++;
  io.emit('stato-live:aggiornato', statoLive);
  console.log(`⚡ Client connesso (${socket.id}) - totale: ${statoLive.spettatoriConnessi}`);

  socket.on('tappa:avvia-diretta', (tappaId) => {
    statoLive.tappaInCorsoId = tappaId;
    io.emit('stato-live:aggiornato', statoLive);
  });

  socket.on('tappa:chiudi-diretta', () => {
    statoLive.tappaInCorsoId = null;
    io.emit('stato-live:aggiornato', statoLive);
  });

  socket.on('disconnect', () => {
    statoLive.spettatoriConnessi = Math.max(0, statoLive.spettatoriConnessi - 1);
    io.emit('stato-live:aggiornato', statoLive);
    console.log(`✗ Client disconnesso (${socket.id}) - totale: ${statoLive.spettatoriConnessi}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚴  Gestionale Tappe Ciclistiche`);
  console.log(`   Server avviato su http://localhost:${PORT}\n`);
});
