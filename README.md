# Gestionale Ciclismo — note di intervento

Questo documento riassume gli interventi fatti sul progetto
[Gestionale_Ciclismo](https://github.com/NicoMaker/Gestionale_Ciclismo):
la correzione della sezione **Percorso / Sprint / GPM**, l'errore
`404` su `/api/sponsor`, i **selettori di ricerca** ovunque ci sia una
scelta di squadra/corridore/tappa/sponsor, la nuova gestione dei
**corridori infortunati/ritirati** e le **bandiere delle squadre**
mostrate ovunque compaia il nome di una squadra.

---

## 1. Come avviare il progetto (per evitare l'errore 404 visto in console)

L'errore che si vedeva in console:

```
GET http://localhost:3000/api/sponsor 404 (Not Found)
Uncaught (in promise) SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**non è un bug nel codice**: la rotta `/api/sponsor` esiste ed è
registrata correttamente in `backend/server.js`. Il 404 con una
risposta HTML (`<!DOCTYPE ...`) capita quando il **backend Node non è
avviato** (o è stato aperto solo `frontend/index.html` come file,
oppure un server statico diverso sta rispondendo sulla porta 3000).
Il frontend, infatti, chiama sempre percorsi relativi come
`/api/sponsor`: se non è il server Express ad ascoltare su quella
porta, ottieni la pagina di errore del server sbagliato invece del
JSON.

Per avviare correttamente tutto:

```bash
cd backend
npm install          # la prima volta
npm run dati         # crea/popola il database SQLite con dati di esempio (facoltativo)
npm start             # avvia il server Express + Socket.IO sulla porta 3000
```

Poi apri **http://localhost:3000** nel browser (il backend serve
anche i file del frontend da `/frontend`, quindi non serve nessun
altro server). Da questo momento **non deve più comparire l'errore
404**, perché il backend risponde davvero alle chiamate `/api/...`.

In più, ora il frontend **non si rompe più in silenzio** se il
backend non è raggiungibile: `frontend/js/api.js` distingue una
risposta non-JSON/non-OK e mostra un messaggio chiaro ("Endpoint non
trovato... il server è avviato?") invece del criptico `Unexpected
token '<'`.

---

## 2. La sezione "Percorso (sprint / GPM)" — cosa non andava

Il tab **Tappe → Percorso (sprint / GPM)** gestisce solo i *punti del
percorso* (dove si trova lo sprint o il GPM, a che km, di che
categoria). I *risultati* di chi vince quegli sprint/GPM si inseriscono
altrove, in **Risultati → Traguardi volanti** e **Risultati → Gran
Premi Montagna**: erano già presenti come tab, ma avevano due problemi
reali che li rendevano di fatto "rotti":

1. **I punti dei traguardi volanti non contavano in nessuna
   classifica.** La classifica a punti (maglia ciclamino) sommava solo
   i punti di arrivo tappa, ignorando del tutto la tabella
   `traguardi_volanti`. Corretto in
   `backend/routes/risultati.js` (`/classifica-generale`): ora somma
   anche i punti degli sprint intermedi.
2. **I `<select>` per scegliere tappa/corridore in questi form erano
   liste semplici senza ricerca.** Con molti corridori (nel seed di
   esempio sono 60) diventava scomodissimo trovare il nome giusto —
   vedi punto 3 qui sotto.

## 3. Selettori di ricerca ovunque (squadra / corridore / tappa / sponsor)

Prima solo il campo "Nazionalità" aveva un campo di ricerca con
autocompletamento (`nazione-autocomplete.js`). Tutti gli altri campi
di scelta (Squadra, Corridore, Tappa, Sponsor) erano `<select>`
lunghissime. È stato creato un componente generico riutilizzabile:

- **`frontend/js/components/entita-autocomplete.js`** — stesso
  comportamento del campo nazione (si digita, appare una lista
  filtrata, si sceglie), ma parametrico per `squadra`, `corridore`,
  `tappa`, `sponsor`. Mostra la bandiera quando disponibile.

È collegato:

- a **tutte** le tabelle generiche che usano `montaListaConForm`
  (`tabella-dati.js`): Percorso tappa, Meteo, Staff tecnico, Veicoli,
  Sponsor per squadra, Alloggi, Biciclette, Traguardi volanti, GPM,
  Media accreditati, Comunicati stampa;
- al campo **Squadra** nel form "Nuovo/Modifica corridore";
- al campo **Corridore** nel form "Aggiungi risultato" di tappa (in
  modifica resta comunque bloccato, come già prima, perché la riga è
  già associata a un corridore preciso).

I corridori **ritirati** (vedi sotto) vengono esclusi automaticamente
dalle nuove selezioni, ma restano visibili se erano già il valore
salvato in una riga esistente (così lo storico non si rompe).

---

## 4. Corridori infortunati / ritirati

Nuova funzionalità: un corridore che si infortuna in tappa, o dichiara
di non voler più partecipare, può essere **segnato come ritirato**.
Da quel momento:

- **non è più selezionabile** in nessun nuovo risultato di tappa,
  traguardo volante, GPM, ecc. (form "aggiungi", non nelle righe
  storiche già esistenti);
- **sparisce da tutte le classifiche** (generale a tempo, punti,
  giovani, scalatori/GPM, squadre) — resta comunque nell'anagrafica
  corridori con lo storico di quanto già disputato.

### Dove si usa

Nella tab **Corridori → Elenco corridori** ogni riga ha:

- una nuova colonna **Stato**: "in gara" oppure un badge rosso col
  motivo del ritiro (infortunio / abbandono / squalifica / altro) e,
  se indicata, la tappa da cui non partecipa più;
- un pulsante **"segna infortunio / ritiro"** (icona a croce medica)
  che apre un piccolo form: tappa da cui non corre più, motivo, note
  libere;
- se già ritirato, un pulsante **"riammetti in gara"** per annullare
  l'operazione (es. inserita per errore).

### Lato dati

- `backend/db/database.js`: nuove colonne su `corridori` —
  `ritirato`, `ritirato_tappa_numero`, `motivo_ritiro`, `note_ritiro`,
  `ritirato_il`. Se esisteva già un `gestionale.db` da prima, viene
  fatta una migrazione automatica e "morbida" (le colonne mancanti
  vengono aggiunte senza toccare i dati esistenti).
- `backend/routes/corridori.js`: nuovi endpoint
  `POST /api/corridori/:id/ritira` e `POST /api/corridori/:id/riammetti`.
- `backend/routes/risultati.js`: tutte le query di classifica
  escludono `WHERE ritirato = 0`.

---

## 5. Bandiera della nazione ovunque sia nominata una squadra

Oltre a dove già comparivano (elenco squadre, classifiche), la
bandiera della nazione di riferimento della squadra ora compare anche:

- nella colonna "Squadra" dell'elenco corridori;
- nella tabella "Arrivo di tappa" (Risultati), accanto al nome della
  squadra;
- in tutte le tabelle generiche che mostrano una colonna "Squadra"
  (Staff tecnico, Veicoli, Sponsor per squadra, Alloggi) — già
  presente nel componente `tabella-dati.js`, verificato e lasciato
  invariato.

Per farlo, le query backend di `corridori.js` e `risultati.js` ora
fanno un join aggiuntivo `squadre → nazioni` (alias
`squadra_nazione_codice`), distinto dalla nazionalità personale del
corridore.

---

## 6. Riepilogo file modificati

```
backend/
  db/database.js            + colonne ritiro corridori, migrazione automatica
  routes/corridori.js       + squadra_nazione_codice, endpoint ritira/riammetti
  routes/risultati.js       + punti sprint in classifica punti, esclusione ritirati, bandiera squadra

frontend/
  js/api.js                 errori leggibili invece di crash su risposte non-JSON
  js/main.js                caricamento iniziale con messaggio d'errore chiaro
  js/components/
    entita-autocomplete.js  NUOVO — select con ricerca generico
    tabella-dati.js         usa il nuovo autocomplete per squadra/corridore/tappa/sponsor
    corridori.js            stato "ritirato", pulsanti ritira/riammetti, autocomplete squadra
    risultati.js            autocomplete corridore, bandiera squadra in tabella arrivo
  style.css                 badge stato "in gara"/"ritirato", riga attenuata per ritirati
  js/icone.js                nuova icona "infortunio"
```

## 7. Test effettuati

- Avvio reale del backend (`npm install`, `npm run dati`, `npm start`)
  e verifica che `GET /api/sponsor` risponda `200` con JSON valido.
- `POST /api/corridori/:id/ritira` → il corridore sparisce subito da
  `GET /api/risultati/classifica-tempo`.
- `POST /api/corridori/:id/riammetti` → il corridore ricompare.
- `GET /api/risultati/classifica-generale` → i punti dei traguardi
  volanti risultano sommati ai punti totali.
- Controllo sintattico di tutti i file JS modificati (`node --check`).
