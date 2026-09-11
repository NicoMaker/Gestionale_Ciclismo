# 🚴 Giro — Gestionale Tappe Ciclistiche

Gestionale completo per una corsa a tappe, **20 tabelle** relazionali,
frontend organizzato **a componenti** e sezioni pensate per funzione
(non un pannello generico di amministrazione tabelle) — con creazione,
**modifica** ed eliminazione ovunque, e aggiornamenti in tempo reale via
Socket.IO.

## Stack

- **Backend:** Node.js + Express
- **Database:** SQLite3, 20 tabelle con foreign key (schema in `schema.mmd`)
- **Realtime:** Socket.IO
- **Dev tool:** nodemon
- **Frontend:** HTML + CSS + JS vanilla a **moduli ES6** (nessun bundler, nessun framework) — un componente per file

## Struttura del progetto

```
gestionale-tappe/
├── backend/
│   ├── server.js                  # entry point Express + Socket.IO, monta tutte le route
│   ├── db/
│   │   └── database.js            # schema completo delle 20 tabelle
│   ├── routes/
│   │   ├── nazioni.js             # CRUD nazioni + ricerca (usato dall'autocomplete)
│   │   ├── squadre.js             # CRUD squadre (join su nazioni)
│   │   ├── corridori.js           # CRUD corridori (join su squadre e nazioni)
│   │   ├── tappe.js               # CRUD tappe
│   │   ├── risultati.js           # risultati di tappa (upsert) + classifica generale
│   │   └── generic.js             # factory CRUD riusata dalle 15 tabelle collegate
│   ├── seed.js                     # dati di esempio per tutte le tabelle
│   ├── package.json
│   └── nodemon.json
├── frontend/
│   ├── index.html                  # scheletro: sidebar + un <section> vuoto per sezione
│   ├── style.css
│   └── js/
│       ├── main.js                 # wiring navigazione + avvio
│       ├── api.js                  # helper fetch (GET/POST/PUT/DELETE)
│       ├── state.js                # cache condivise (squadre, corridori, tappe, nazioni, sponsor)
│       ├── socket.js               # istanza Socket.IO condivisa
│       ├── utils.js                # bandiera(), toast, modale, sotto-schede
│       └── components/
│           ├── tappe.js            # Elenco · Percorso (sprint/GPM) · Meteo
│           ├── corridori.js        # Elenco · Biciclette
│           ├── squadre.js          # Elenco · Staff tecnico · Veicoli · Sponsor · Alloggi
│           ├── risultati.js        # Arrivo di tappa · Traguardi volanti · GPM
│           ├── classifiche.js      # Classifica generale · Tipi di classifica
│           ├── regolamento.js      # Penalità · Controlli antidoping
│           ├── stampa.js           # Media accreditati · Comunicati stampa
│           ├── nazioni.js          # Anagrafica nazioni (usata dall'autocomplete)
│           ├── nazione-autocomplete.js  # campo di ricerca con bandiera, riusabile nei form
│           └── tabella-dati.js     # blocco riusabile "elenco + form" con crea/modifica/elimina
├── schema.mmd                       # diagramma ER completo (Mermaid)
├── .gitignore
└── README.md
```

## Le sezioni (organizzate per funzione, non per tabella)

Ogni voce del menu è un dominio reale della corsa; le tabelle collegate
compaiono come sotto-schede dentro la sezione a cui appartengono
logicamente — non in un elenco piatto di "tabelle extra":

| Sezione | Sotto-schede | Tabelle coinvolte |
|---|---|---|
| **Tappe** | Elenco · Percorso · Meteo | `tappe`, `tappe_percorso`, `meteo_tappa` |
| **Corridori** | Elenco · Biciclette | `corridori`, `biciclette` |
| **Squadre** | Elenco · Staff tecnico · Veicoli · Sponsor · Alloggi | `squadre`, `staff_tecnico`, `veicoli_squadra`, `sponsor`, `squadra_sponsor`, `hotel` |
| **Risultati** | Arrivo di tappa · Traguardi volanti · GPM | `risultati`, `traguardi_volanti`, `gpm_risultati` |
| **Classifiche** | Generale · Tipi di classifica | `classifiche_tipo` (+ calcolo su `risultati`) |
| **Regolamento** | Penalità · Antidoping | `penalita`, `controlli_antidoping` |
| **Stampa** | Media accreditati · Comunicati | `media_accreditati`, `comunicati_stampa` |
| **Nazioni** | Anagrafica | `nazioni` (alimenta l'autocomplete di Corridori/Squadre) |

Tutte le 20 tabelle hanno **creazione, modifica ed eliminazione** —
compresi corridori, squadre, tappe e nazioni, che hanno una scheda di
modifica dedicata, e le tabelle collegate, che condividono un blocco
riusabile (`tabella-dati.js`) con lo stesso set completo di azioni.

## Nazionalità con bandiera

Le nazionalità (di corridori e squadre) si scelgono tramite un campo di
ricerca con autocomplete tra le nazioni già presenti in `nazioni` (40
precaricate col seed). La bandiera è calcolata dal codice ISO2 a runtime
nel frontend (nessuna immagine, funziona offline).

## Come avviare il progetto

```bash
cd backend
npm install
node seed.js        # opzionale: popola tutte le tabelle con dati di esempio
npm run dev          # sviluppo, con nodemon
# oppure: npm start   per produzione
```

L'app sarà disponibile su **http://localhost:3000**

## Come funziona il realtime

Ogni scrittura (creazione, modifica o eliminazione), su qualsiasi delle
20 tabelle, emette un evento Socket.IO che tutti i client connessi
ricevono immediatamente, ricaricando solo la sotto-scheda interessata.
C'è inoltre uno stato "diretta" tenuto in memoria sul server: quando si
preme "📡 diretta" su una tappa, tutti i client vedono l'indicatore live
accendersi e il conteggio di quanti dispositivi sono connessi.

## Pubblicare su GitHub

Dalla cartella principale del progetto (`gestionale-tappe/`):

```bash
git init
git add .
git commit -m "Gestionale tappe ciclistiche: 20 tabelle, frontend a componenti"
git remote add origin https://github.com/TUO-USERNAME/gestionale-tappe.git
git branch -M main
git push -u origin main
```

(sostituisci `TUO-USERNAME` con il tuo nome utente GitHub — crea prima il
repository vuoto su github.com/new)
