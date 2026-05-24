# Toolchain Sentinel

Questa pagina descrive runtime, comandi e guardrail effettivi di Sentinel.

## Runtime

| Area | Versione/canale | Fonte |
| --- | --- | --- |
| Node.js locale | compatibile con TypeScript/Vitest correnti | `package.json`, `package-lock.json` |
| Node.js GitHub Actions | `22` | `.github/workflows/sentinel.yml` |
| npm | lockfile npm | `package-lock.json` |
| TypeScript | `^5.9.3` | `package.json` |
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
| GitHub Actions | `ubuntu-latest`, Node `22` | runtime operativo schedulato/manuale |
| SMTP Gmail | secret GitHub o env locale | invio email operativo |
| Portachiavi macOS | servizi `sentinel-gmail` e `sentinel-icloud` | fallback locale per password email |

## Comandi

- install/setup: `npm install` o `npm ci`.
- build: `npm run build`.
- test: `npm test`.
- scan: `npm run sentinel -- scan`.
- dry-run scan: `npm run sentinel -- scan --dry-run`.
- report: `npm run sentinel -- report`.
- test email Gmail: `npm run sentinel -- test-email --profile gmail`.
- test email iCloud: `npm run sentinel -- test-email --profile icloud`.

## Pubblicazione, release e deploy

- La pubblicazione codice passa da commit, push e PR/merge su GitHub.
- Il deploy operativo MVP passa da GitHub Actions su `main`.
- Non esiste VPS.
- Non esiste ancora una policy di tag o GitHub Release.
- Il workflow può committare `data/`, `snapshots/` e `reports/`.
- Il workflow deve fallire se c'è un errore tecnico o se un'email necessaria non
  parte.

## Eccezioni e guardrail

- Non salvare HTML completo.
- Non committare `.env`, password SMTP, token o cache locali.
- Non modificare schedule, provider email o siti monitorati senza verificare
  impatto su rumore, privacy e `robots.txt`.
- Non trattare `data/`, `snapshots/` e `reports/` come file temporanei da
  cancellare automaticamente.
