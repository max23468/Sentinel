# Toolchain Sentinel

Questa pagina descrive runtime, comandi e guardrail effettivi di Sentinel.

## Runtime

| Area | Versione/canale | Fonte |
| --- | --- | --- |
| Node.js locale | `24.x`; tipi allineati a Node `24` | `.nvmrc`, `package.json`, `package-lock.json` |
| Node.js GitHub Actions | `24` | `.github/workflows/sentinel.yml` |
| npm | `npm@12.0.2` | `package.json`, `package-lock.json` |
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
| SMTP Gmail | secret GitHub o env locale | invio email operativo |
| Portachiavi macOS | servizi `sentinel-gmail` e `sentinel-icloud` | fallback locale per password email |

## Comandi

- bootstrap locale/worktree: `npm install --global npm@12.0.2`.
- install/setup canonico: `npm ci`.
- build: `npm run build`.
- test: `npm test`.
- coverage core: `npm run test:coverage`.
- gate completo locale e CI: `npm run check` (React Doctor, typecheck, build e test).
- Codex review gate: workflow `Codex review gate`, status `codex-review`
  associato all'HEAD esatto della PR; il codice eseguito arriva sempre da `main`.
- scan: `npm run sentinel -- scan`.
- dry-run scan: `npm run sentinel -- scan --dry-run`.
- report: `npm run sentinel -- report`.
- dashboard HTML: `npm run sentinel -- dashboard`.
- dashboard web dinamica: `npm run dev`.
- build CLI: `npm run build:cli`.
- build web: `npm run build:web`.
- React Doctor: `npm run doctor`, versione esatta `0.9.11`, scope full e blocco
  su warning da `doctor.config.json`. Le PR senza finding restano silenziose; un
  falso positivo va notificato nella PR e soppresso nel modo nativo più stretto,
  con motivazione committata e riesecuzione verde, senza bypass.
- build completa: `npm run build`.
- pubblicazione payload dashboard: `npm run sentinel -- publish-dashboard`.
- test email Gmail: `npm run sentinel -- test-email --profile gmail`.
- test email iCloud: `npm run sentinel -- test-email --profile icloud`.

## Coverage core

- La coverage Vitest ufficiale per l'audit gira con `npm run test:coverage`.
- Il perimetro core corrente è dichiarato in `vitest.config.ts`.
- Le soglie minime correnti sul perimetro core sono `75%` linee e `65%` branch.
- La coverage non sostituisce `npm test` e `npm run build`: è un gate aggiuntivo
  quando il lavoro tocca test, quality bar o moduli core.

## Verifiche per scope

| Tipo modifica | Corsia | Verifiche minime |
| --- | --- | --- |
| Sola analisi | veloce | Nessun test applicativo; dichiarare fonti e limiti |
| Docs-only | veloce | Review documentale e `git diff --check` quando utile |
| Workflow/config o documenti operativi critici | standard | `npm run check` e review mirata del file modificato |
| Test-only, CLI o dashboard piccola | standard | `npm test`, `npm run build` o test mirati |
| Audit test/coverage o quality bar moduli core | standard | `npm test`, `npm run test:coverage`, `npm run build` |
| Runtime schedulato, dati/output, provider email, deploy/config, release/versioning o UI sostanziale | completa | Gate completo proporzionato, smoke/manual run quando serve, React Doctor se applicabile |

Per UI sostanziale della dashboard React/Vite usare anche browser locale o deploy
pertinente, includendo Basic Auth, route dashboard, viewport desktop/mobile e
stati vuoti/errore/loading quando il diff li può alterare.

## Pubblicazione, release e deploy

- La pubblicazione codice passa da commit, push e PR/merge su GitHub; su richiesta
  completa di `pubblica` significa anche pulire branch/worktree locali e remoti
  assorbiti al termine.
- Le PR verso `main` girano `CI` con il job obbligatorio `verify` e il workflow
  dedicato con il job obbligatorio `react-doctor`. La ruleset `main governance`
  richiede entrambi e `codex-review` con strict checking; `Governance` ne
  controlla mensilmente la deriva. Non sono configurati bypass.
- Aggiornamenti dipendenze: Dependabot settimanale (npm + github-actions),
  minor/patch raggruppati. Le PR si mergiano a mano dopo aver controllato la CI:
  l'auto-merge richiede almeno un check obbligatorio su `main` e non è più
  disponibile. I major restano manuali; `typescript` e `@types/node` major sono
  ignorati (vincoli TS 7.1 / Node 24).
- Il deploy operativo MVP passa da GitHub Actions su `main`.
- Il deploy della dashboard web passa da Vercel CLI e non richiede GitHub
  Actions.
- Non esiste VPS.
- Tag Git `vX.Y.Z` e GitHub Release sono obbligatori per release del tool o della dashboard
  secondo ADR `docs/decisions/0003-tag-e-github-release.md`.
- Il workflow esegue il gate completo, ripristina dal branch operativo
  `sentinel-outputs`, esegue lo scan, genera `reports/dashboard.html` e committa
  sullo stesso branch esclusivamente `data/`, `snapshots/` e `reports/`. Non
  esegue codice dal branch operativo e non effettua push diretti su `main`.
- Nel workflow operativo i valori email arrivano dai repository secrets `SENTINEL_*`.
- Il workflow deve fallire se c'è un errore tecnico o se un'email necessaria non
  parte.
- Quando GitHub Actions non è disponibile o non è raggiungibile,
  usa `scan` locale e canali operativi alternativi documentati (compreso
  `publish-dashboard` e deploy Vercel da CLI) solo come fallback temporaneo.

## Dashboard Vercel

- Framework: React su Vite (`vite build` in `dist-web`); vedi ADR 0004.
- UI: `index.html` + `web/main.tsx` montano `web/dashboard-client.tsx`.
- Server: Vercel Functions standalone `api/dashboard.ts` e
  `api/reports/[name].ts` (firma web `export function GET(request: Request)`).
- Protezione: Basic Auth applicativa con `SENTINEL_DASHBOARD_USER` e
  `SENTINEL_DASHBOARD_PASSWORD`, applicata a tutto il sito da `middleware.ts`
  (Vercel Edge Middleware) e ricontrollata nelle Functions.
- Storage dinamico: Vercel Blob privato con `BLOB_READ_WRITE_TOKEN`.
- Payload: `sentinel-dashboard/model.json` salvo override con
  `SENTINEL_DASHBOARD_BLOB_PREFIX`.
- Report serviti via Function autenticata `/api/reports/[name]`.
- `vercel.json` usa `framework: "vite"` e `outputDirectory: "dist-web"`; per lo
  sviluppo full-stack locale (UI + Functions + middleware) usare `vercel dev`,
  mentre `npm run dev` (Vite) serve la sola UI. L'`installCommand` esegue
  esplicitamente npm 12 perché l'immagine Node 24 del builder può includere npm 11.

## Eccezioni e guardrail

- Non salvare HTML completo.
- Tutte le richieste del crawler passano dal client outbound condiviso: origine
  e porta devono coincidere con un root configurato, ogni redirect viene
  rivalidato e la connessione usa solo indirizzi DNS pubblici risolti e fissati
  prima del collegamento.
- Limiti runtime per singola risposta: `512 KiB` per `robots.txt`, `5 MiB` per
  HTML e sitemap, `25 MiB` per file; ogni scan ha inoltre un budget aggregato
  di `100 MiB`, massimo 32 sitemap e profondità sitemap 4. L'XML sitemap
  rifiuta `DOCTYPE`, oltre 50.000 tag o profondità strutturale superiore a 32.
- Non committare `.env`, password SMTP, token o cache locali.
- Le sole esclusioni React Doctor ammesse sono `dist-web/**`, bundle Vite
  generato, `.worktrees/**`, checkout Git separati che non appartengono alla
  working tree analizzata, e il matcher `ignoredIssues` in `src/scan.ts`: le
  due regole correnti combinano status, messaggio, sottostringa e regex, quindi non
  rappresentano un lookup sostituibile correttamente con `Set`/`Map`. Rivalutare
  l'indice se il numero di regole cresce materialmente.
- Gli output committabili possono includere solo hash, metadati, report e testo
  normalizzato da pagine pubbliche monitorate; non acquisire contenuti dietro
  autenticazione, risposte di form, input privati o segreti.
- Non modificare schedule, provider email o siti monitorati senza verificare
  impatto su rumore, privacy e `robots.txt`.
- Non trattare `data/`, `snapshots/` e `reports/` come file temporanei da
  cancellare automaticamente.
- Non committare `.vercel/`, token Blob o password dashboard.
