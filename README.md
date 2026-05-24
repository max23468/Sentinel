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
npm run sentinel -- test-email --profile gmail
```

## Configurazione

La configurazione principale è [sentinel.config.yml](/Users/Matteo/Progetti/Sentinel/sentinel.config.yml).
Gli output applicativi sono:

- `data/state.json`
- `snapshots/`
- `reports/`

Per policy, la CLI non salva HTML completo: per le pagine salva hash, metadati e testo normalizzato; per i file pubblici salva hash binario e metadati.

## Email

Le password SMTP non vanno committate. Usa variabili d'ambiente, GitHub Secrets o Portachiavi macOS.

Variabili previste:

```bash
SENTINEL_EMAIL_TO=
SENTINEL_EMAIL_FROM=
SENTINEL_GMAIL_USER=
SENTINEL_GMAIL_APP_PASSWORD=
SENTINEL_ICLOUD_USER=
SENTINEL_ICLOUD_APP_PASSWORD=
```

Per il workflow GitHub Actions attuale, che usa il profilo `gmail`, sono obbligatori questi repository secrets prima di avviare una scansione:

```bash
SENTINEL_EMAIL_TO
SENTINEL_EMAIL_FROM
SENTINEL_GMAIL_USER
SENTINEL_GMAIL_APP_PASSWORD
```

Se uno di questi secrets manca, il workflow fallisce subito prima di installare dipendenze, eseguire test, build o scan.

Su macOS, se la password non è in env, Sentinel prova a leggere dal Portachiavi i servizi `sentinel-gmail` o `sentinel-icloud`.

## Documentazione

- [docs/INDEX.md](/Users/Matteo/Progetti/Sentinel/docs/INDEX.md): indice documentale unico.
- [docs/ROADMAP.md](/Users/Matteo/Progetti/Sentinel/docs/ROADMAP.md): priorità e prossimi passi.
- [docs/BACKLOG.md](/Users/Matteo/Progetti/Sentinel/docs/BACKLOG.md): idee, debiti e decisioni non ancora promosse.
- [docs/CONTEXT.md](/Users/Matteo/Progetti/Sentinel/docs/CONTEXT.md): handoff operativo.
- [docs/TOOLCHAIN.md](/Users/Matteo/Progetti/Sentinel/docs/TOOLCHAIN.md): runtime, workflow e verifiche.
- [docs/decisions/README.md](/Users/Matteo/Progetti/Sentinel/docs/decisions/README.md): decisioni stabili.

## Pubblicazione

La pubblicazione codice passa da GitHub. Il deploy operativo MVP passa dal
workflow GitHub Actions su `main`: test, build, scan, commit degli output e
fallimento solo per errori tecnici o email necessarie non inviate.
