# Sentinel

Sentinel è una CLI Node.js/TypeScript per monitorare cambiamenti su siti web pubblici.

Monitor configurati:

- Ortix
- San Carlo Sviluppo

## Comandi

```bash
npm install
npm run build
npm test
npm run sentinel -- scan
npm run sentinel -- scan --dry-run
npm run sentinel -- report
npm run sentinel -- dashboard
npm run sentinel -- publish-dashboard
npm run sentinel -- test-email --profile gmail
```

## Configurazione

La configurazione principale è [sentinel.config.yml](/Users/Matteo/Progetti/Sentinel/sentinel.config.yml).
Gli output applicativi sono:

- `data/state.json`
- `snapshots/`
- `reports/`
- `reports/dashboard.html`

Per policy, la CLI non salva HTML completo: per le pagine salva hash, metadati e testo normalizzato; per i file pubblici salva hash binario e metadati.

La dashboard HTML è una vista locale minimale e interattiva: aggrega stato,
ultimi report, monitor configurati e URL aggiornati di recente. I riquadri di
sintesi aprono il relativo dettaglio, ad esempio problemi, cambiamenti, URL,
pagine HTML o file monitorati. Si genera con:

```bash
npm run sentinel -- dashboard
```

La dashboard web dinamica gira su Vercel come app Next.js protetta da Basic Auth
applicativa. Legge a runtime un payload JSON da Vercel Blob privato, quindi i
dati possono essere aggiornati senza redeploy e senza GitHub Actions:

```bash
npm run sentinel -- publish-dashboard
```

Variabili richieste su Vercel per la dashboard online:

```bash
SENTINEL_DASHBOARD_USER
SENTINEL_DASHBOARD_PASSWORD
BLOB_READ_WRITE_TOKEN
```

`SENTINEL_DASHBOARD_BLOB_PREFIX` è opzionale e di default vale
`sentinel-dashboard`.

I problemi noti e non azionabili possono essere classificati nella
configurazione del sito con `ignoredIssues`. Restano visibili nei report e nella
dashboard come `Avvisi noti`, ma non aumentano il conteggio dei problemi attivi:

```yaml
ignoredIssues:
  - status: 404
    urlPattern: "^https://www\\.ortix\\.it/wp-content/uploads/2021/"
    reason: "Asset WordPress storici non rilevanti per il monitor operativo"
```

## Email

Le password SMTP non vanno committate. Usa variabili d'ambiente, Doppler,
GitHub Secrets o Portachiavi macOS.

Variabili previste:

```bash
SENTINEL_EMAIL_TO=
SENTINEL_EMAIL_FROM=
SENTINEL_GMAIL_USER=
SENTINEL_GMAIL_APP_PASSWORD=
SENTINEL_ICLOUD_USER=
SENTINEL_ICLOUD_APP_PASSWORD=
```

Per il workflow GitHub Actions attuale, che usa il profilo `gmail`, queste
variabili devono arrivare da Doppler o, come fallback, da repository secrets:

```bash
SENTINEL_EMAIL_TO
SENTINEL_EMAIL_FROM
SENTINEL_GMAIL_USER
SENTINEL_GMAIL_APP_PASSWORD
```

Se uno di questi valori manca dopo l'iniezione Doppler e il fallback GitHub
Secrets, il workflow fallisce subito prima di installare dipendenze, eseguire
test, build o scan.

Su macOS, se la password non è in env, Sentinel prova a leggere dal Portachiavi i servizi `sentinel-gmail` o `sentinel-icloud`.

## Documentazione

- [docs/INDEX.md](docs/INDEX.md): indice documentale unico.
- [docs/ROADMAP.md](docs/ROADMAP.md): priorità e prossimi passi.
- [docs/BACKLOG.md](docs/BACKLOG.md): idee, debiti e decisioni non ancora promosse.
- [docs/CONTEXT.md](docs/CONTEXT.md): handoff operativo.
- [docs/TOOLCHAIN.md](docs/TOOLCHAIN.md): runtime, workflow e verifiche.
- [docs/DECISIONS.md](docs/DECISIONS.md): decisioni stabili.

## Pubblicazione

La pubblicazione codice passa da GitHub. Il deploy operativo MVP passa dal
workflow GitHub Actions su `main`: test, build, scan, commit degli output e
fallimento solo per errori tecnici o email necessarie non inviate.

La dashboard web online è pubblicabile su Vercel da CLI, senza dipendere
unicamente da GitHub Actions. In questo scenario la scansione resta locale/manuale
o affidata al workflow quando la pipeline è operativa; l'aggiornamento online
dei dati passa da `publish-dashboard`.

La issue GitHub `Codex feedback inbox` raccoglie i commenti Codex sulle PR; il
workflow `Codex PR comments` la mantiene sincronizzata e la marca con la label
`codex-feedback-inbox`.
