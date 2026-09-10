# 🚴 Giro — Gestionale Tappe Ciclistiche

Gestionale completo per una corsa a tappe, con **20 tabelle** relazionali:
tappe, corridori, squadre, risultati, classifica generale, staff tecnico,
sponsor, veicoli, hotel, meteo, controlli antidoping, biciclette, media e
comunicati stampa — con aggiornamenti in tempo reale via Socket.IO.

## Stack

- **Backend:** Node.js + Express
- **Database:** SQLite3, 20 tabelle collegate da foreign key (schema completo in `schema.mmd`)
- **Realtime:** Socket.IO (ogni scrittura su qualsiasi tabella notifica i client connessi)
- **Dev tool:** nodemon
- **Frontend:** HTML + CSS + JS vanilla, cartella separata `frontend/`

## Nazionalità con bandiera

Le nazionalità (di corridori e squadre) si scelgono tramite un campo di
**ricerca con autocomplete** tra le nazioni già presenti in tabella
`nazioni` (40 precaricate col seed, ma se ne possono aggiungere altre via
API). La bandiera **non è un'immagine**: viene calcolata a runtime nel
frontend a partire dal codice ISO2 della nazione (funzione `bandiera()` in
`app.js`, converte le lettere in emoji "regional indicator") — zero
dipendenze esterne, funziona offline.

## Struttura del progetto

```
gestionale-tappe/
├── backend/
│   ├── server.js              # entry point Express + Socket.IO, monta tutte le route
│   ├── db/
│   │   └── database.js        # schema completo delle 20 tabelle
│   ├── routes/
│   │   ├── nazioni.js         # CRUD nazioni + endpoint di ricerca (/ricerca?q=)
│   │   ├── squadre.js         # CRUD squadre (con join su nazioni)
│   │   ├── corridori.js       # CRUD corridori (con join su squadre e nazioni)
│   │   ├── tappe.js           # CRUD tappe
│   │   ├── risultati.js       # risultati per tappa + classifica generale
│   │   └── generic.js         # factory di route CRUD riusata per le 15 tabelle secondarie
│   ├── seed.js                 # dati di esempio (40 nazioni + dati per tutte le tabelle)
│   ├── package.json
│   └── nodemon.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js                  # include il pannello generico "Tabelle extra"
├── schema.mmd                   # diagramma ER completo (Mermaid)
├── .gitignore
└── README.md
```

## Le 20 tabelle

**Gestite con interfaccia dedicata:**
1. `nazioni` — anagrafica nazioni (nome + codice ISO2)
2. `squadre`
3. `corridori`
4. `tappe`
5. `risultati` — risultati di tappa + classifica generale calcolata

**Gestite dal pannello generico "Tabelle extra"** (stessa interfaccia CRUD,
un selettore in alto per passare da una tabella all'altra):

6. `staff_tecnico` — direttori sportivi, meccanici, medici per squadra
7. `tappe_percorso` — punti intermedi di tappa (sprint / GPM)
8. `classifiche_tipo` — tipi di classifica (generale, punti, scalatori, giovani, squadre)
9. `traguardi_volanti` — risultati agli sprint intermedi
10. `gpm_risultati` — risultati ai gran premi della montagna
11. `penalita` — penalità in tempo o punti
12. `controlli_antidoping`
13. `biciclette` — bici assegnata a ogni corridore
14. `sponsor`
15. `squadra_sponsor` — relazione molti-a-molti squadre/sponsor
16. `veicoli_squadra` — ammiraglie, furgoni, bus
17. `hotel` — alloggio squadra per tappa
18. `meteo_tappa`
19. `media_accreditati`
20. `comunicati_stampa`

Il pannello "Tabelle extra" usa un'unica factory di route generiche sul
backend (`routes/generic.js`) e un'unica configurazione dichiarativa sul
frontend (`extraConfig` in `app.js`), invece di duplicare 15 volte lo stesso
codice CRUD — ogni tabella nuova richiede solo poche righe di configurazione.

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

Ogni operazione di scrittura, su qualsiasi delle 20 tabelle, emette un
evento Socket.IO (`<tabella>:aggiornati`) che tutti i client connessi
ricevono immediatamente, ricaricando la vista interessata — utile se più
persone (es. più addetti al cronometraggio, allo staff, alla stampa) usano
il gestionale contemporaneamente da postazioni diverse.

C'è inoltre uno **stato "diretta"** tenuto in memoria sul server (non su
database): quando si preme "📡 diretta" su una tappa, tutti i client vedono
l'indicatore live accendersi e il conteggio di quanti dispositivi sono
connessi in quel momento.

## Pubblicare su GitHub

Dalla cartella principale del progetto (`gestionale-tappe/`):

```bash
git init
git add .
git commit -m "Primo commit: gestionale tappe ciclistiche, 20 tabelle"
git remote add origin https://github.com/TUO-USERNAME/gestionale-tappe.git
git branch -M main
git push -u origin main
```

(sostituisci `TUO-USERNAME` con il tuo nome utente GitHub — crea prima il
repository vuoto su github.com/new)
