# Toolchain Sentinel

Questa pagina descrive runtime, comandi e guardrail effettivi di Sentinel.

## Runtime

| Area | Versione/canale | Fonte |
| --- | --- | --- |
| Node.js locale | `24.x`; tipi allineati a Node `24` | `.nvmrc`, `package.json`, `package-lock.json` |
| Node.js GitHub Actions | `24` | `.github/workflows/sentinel.yml` |
| npm | `npm@11.14.1` | `package.json`, `package-lock.json` |
| TypeScript | `^6.0.3` | `package.json` |
| Python | non applicabile | nessun runtime Python |

## Package manager e lockfile

- JavaScript/TypeScript: `npm`.
- Lockfile JS: `package-lock.json`.
- Python: non applicabile.
- Lockfile Python: non applicabile.

## Dipendenze applicative principali

- `commander`: CLI `sentinel`.
- `yaml`: parsing configurazione.
- `fast-xml-parser`: lettura sitemap.
- `cheerio`: estrazione contenuti dalle pagine.
- `robots-parser`: rispetto `robots.txt`.
- `nodemailer`: invio email.

## Tool esterni

| Tool | Versione/canale | Uso |
| --- | --- | --- |
| `gh` | CLI autenticata locale | PR, run GitHub Actions e diagnostica GitHub |
| Vercel CLI | locale/autenticata | deploy dashboard web senza GitHub Actions |
| Vercel Blob | privato | payload dinamico dashboard e ultimi report |
| GitHub Actions | `ubuntu-latest`, Node `24` | runtime operativo schedulato/manuale |
| Dependabot | configurazione GitHub | aggiornamenti dipendenze npm e GitHub Actions |
| SMTP Gmail | Doppler, secret GitHub o env locale | invio email operativo |
| Portachiavi macOS | servizi `sentinel-gmail` e `sentinel-icloud` | fallback locale per password email |

## Comandi

- install/setup: `npm install` o `npm ci`.
- build: `npm run build`.
- test: `npm test`.
- Codex comments dry-run: workflow `Codex PR comments` con input `dry_run=true`.
- scan: `npm run sentinel -- scan`.
- dry-run scan: `npm run sentinel -- scan --dry-run`.
- report: `npm run sentinel -- report`.
- dashboard HTML: `npm run sentinel -- dashboard`.
- dashboard web dinamica: `npm run dev`.
- build CLI: `npm run build:cli`.
- build web: `npm run build:web`.
- React Doctor: `npm run quality:react-doctor`, basato su `npx --yes react-doctor@latest`.
- build completa: `npm run build`.
- pubblicazione payload dashboard: `npm run sentinel -- publish-dashboard`.
- test email Gmail: `npm run sentinel -- test-email --profile gmail`.
- test email iCloud: `npm run sentinel -- test-email --profile icloud`.

## Verifiche per scope

| Tipo modifica | Corsia | Verifiche minime |
| --- | --- | --- |
| Sola analisi | veloce | Nessun test applicativo; dichiarare fonti e limiti |
| Docs-only | veloce | Review documentale e `git diff --check` quando utile |
| Workflow/config o documenti operativi critici | standard | Review mirata e comando collegato al file modificato |
| Test-only, CLI o dashboard piccola | standard | `npm test`, `npm run build` o test mirati |
| Runtime schedulato, dati/output, provider email, deploy/config, release/versioning o UI sostanziale | completa | Gate completo proporzionato, smoke/manual run quando serve, React Doctor se applicabile |

Per UI sostanziale della dashboard Next.js usare anche browser locale o deploy
pertinente, includendo Basic Auth, route dashboard, viewport desktop/mobile e
stati vuoti/errore/loading quando il diff li può alterare.

## Pubblicazione, release e deploy

- La pubblicazione codice passa da commit, push e PR/merge su GitHub; su richiesta
  completa di `pubblica` significa anche pulire branch/worktree locali e remoti
  assorbiti al termine.
- La Codex feedback inbox è gestita dal workflow `Codex PR comments`.
- Il deploy operativo MVP passa da GitHub Actions su `main`.
- Il deploy della dashboard web passa da Vercel CLI e non richiede GitHub
  Actions.
- Non esiste VPS.
- Tag Git `vX.Y.Z` e GitHub Release sono obbligatori per release del tool o della dashboard
  secondo ADR `docs/decisions/0003-tag-e-github-release.md`.
- Il workflow esegue scan, genera `reports/dashboard.html` e può committare
  `data/`, `snapshots/` e `reports/`.
- Nel workflow operativo i valori email arrivano da Doppler quando configurato;
  i repository secrets `SENTINEL_*` restano fallback e non devono sovrascrivere
  variabili già iniettate.
- Il workflow deve fallire se c'è un errore tecnico o se un'email necessaria non
  parte.
- Quando GitHub Actions non è disponibile o non è raggiungibile,
  usa `scan` locale e canali operativi alternativi documentati (compreso
  `publish-dashboard` e deploy Vercel da CLI) solo come fallback temporaneo.

## Dashboard Vercel

- Framework: Next.js App Router.
- Protezione: Basic Auth applicativa con `SENTINEL_DASHBOARD_USER` e
  `SENTINEL_DASHBOARD_PASSWORD`.
- Storage dinamico: Vercel Blob privato con `BLOB_READ_WRITE_TOKEN`.
- Payload: `sentinel-dashboard/model.json` salvo override con
  `SENTINEL_DASHBOARD_BLOB_PREFIX`.
- Report serviti via route autenticata `/api/reports/[name]`.
- Il build web usa `next build --webpack` perché la CLI TypeScript usa import
  ESM con suffisso `.js`, risolti da Webpack tramite `next.config.mjs`.

## Eccezioni e guardrail

- Non salvare HTML completo.
- Non committare `.env`, password SMTP, token o cache locali.
- Non modificare schedule, provider email o siti monitorati senza verificare
  impatto su rumore, privacy e `robots.txt`.
- Non trattare `data/`, `snapshots/` e `reports/` come file temporanei da
  cancellare automaticamente.
- Non committare `.vercel/`, token Blob o password dashboard.
