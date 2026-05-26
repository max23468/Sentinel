# Indice documentazione Sentinel

Questo è l'indice documentale unico di Sentinel.

Sentinel usa la root per ingresso operativo, configurazione e codice. Usa
`docs/` per governance, roadmap, backlog, contesto, toolchain e decisioni.

## Ingresso

- `README.md`: introduzione, comandi base, configurazione email e output.
- `AGENTS.md`: regole operative per Codex e agenti.
- `sentinel.config.yml`: configurazione dei monitor, storage, email e crawling.

## Stato e lavoro

- `docs/ROADMAP.md`: direzione, priorità e prossimi passi.
- `docs/BACKLOG.md`: idee, debiti, bug e attività non ancora promosse.
- `docs/CONTEXT.md`: handoff per nuove chat e lavoro continuativo.
- `docs/TOOLCHAIN.md`: runtime, package manager, workflow e verifiche.

## Decisioni

- `docs/decisions/`: ADR e decisioni stabili.
- `docs/DECISIONS.md`: indice delle decisioni.
- `docs/DECISIONS_PENDING.md`: decisioni strutturali non ancora approvate.
- `docs/decisions/template.md`: template ADR.
- `docs/decisions/0001-github-actions-runtime-operativo.md`: GitHub Actions come runtime operativo MVP.
- `docs/decisions/0002-dashboard-vercel-dinamica.md`: dashboard online dinamica su Vercel.

## Pubblicazione e operatività

- `.github/workflows/sentinel.yml`: workflow operativo schedulato e manuale.
- `.github/workflows/codex-pr-comments.yml`: sincronizzazione della Codex feedback inbox.
- `.github/workflows/pr-title.yml`: controllo titolo PR.
- `.github/PULL_REQUEST_TEMPLATE.md`: template PR.
- `.github/ISSUE_TEMPLATE/`: template issue.
- `.github/dependabot.yml`: manutenzione dipendenze npm e GitHub Actions.
- `data/`, `snapshots/`, `reports/`: output applicativi tracciabili.

## Regole di manutenzione

Non creare un secondo documento con lo stesso titolo o lo stesso scopo di uno già
indicato qui.

Se un documento viene migrato o sostituito, aggiornare questo indice e lasciare
un rinvio temporaneo quando serve preservare tracciabilità.

Prima di rimuovere un documento o un output applicativo, verificare che il
contenuto utile sia stato migrato, collegato o dichiarato superato.
