# 0002 - Dashboard dinamica su Vercel

Data: 2026-05-26

Stato: Accettata

## Contesto

La dashboard locale statica in `reports/dashboard.html` è utile per consultare
gli output, ma non basta per una pubblicazione online protetta e aggiornata senza
rigenerare HTML o usare GitHub Actions.

Inoltre i minuti GitHub Actions possono esaurirsi, quindi la pubblicazione della
dashboard deve poter avvenire da CLI locale.

## Decisione

Usare una piccola app Next.js su Vercel per la dashboard online dinamica.

La pagina legge i dati a runtime da `/api/dashboard`. L'API carica un payload
JSON da Vercel Blob privato, aggiornato dal comando:

```bash
npm run sentinel -- publish-dashboard
```

La dashboard online è protetta con Basic Auth applicativa usando variabili
d'ambiente Vercel:

```bash
SENTINEL_DASHBOARD_USER
SENTINEL_DASHBOARD_PASSWORD
BLOB_READ_WRITE_TOKEN
```

## Alternative considerate

- GitHub Pages: scartata perché la repo è privata e la dashboard deve essere
  dinamica e protetta.
- Solo Vercel Deployment Protection: scartata come unica protezione perché la
  protezione completa del dominio production dipende dal piano/add-on.
- Database relazionale: rimandato perché per lo stato attuale basta un payload
  JSON versionato su Blob privato.

## Impatti

- Prodotto: la dashboard diventa consultabile online e aggiornata a runtime.
- Tecnico: la CLI resta il motore di scansione; Next.js è solo superficie web.
- Dati/privacy: report e payload stanno in Blob privato e sono serviti da route
  autenticate.
- Deploy/release: deploy Vercel da CLI, senza GitHub Actions.
- Documentazione: README e `docs/TOOLCHAIN.md` descrivono i nuovi comandi e le
  variabili richieste.

## Conseguenze operative

- Collegare il progetto a Vercel.
- Creare un Blob store privato collegato al progetto.
- Configurare le variabili dashboard su Vercel.
- Eseguire scan locale e `publish-dashboard` quando si vogliono aggiornare i dati
  online senza avviare GitHub Actions.

## Verifiche

- `npm test`
- `npm run build`
- Browser locale sulla dashboard Next.js.

## Collegamenti

- Toolchain: `docs/TOOLCHAIN.md`
- Dashboard locale: `reports/dashboard.html`
