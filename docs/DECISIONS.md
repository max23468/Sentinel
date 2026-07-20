# Decisioni Sentinel

Questo indice raccoglie le decisioni stabili della repo.

## Decisioni attive

- [0001 - GitHub Actions come runtime operativo MVP](decisions/0001-github-actions-runtime-operativo.md): accettata.
- [0002 - Dashboard dinamica su Vercel](decisions/0002-dashboard-vercel-dinamica.md): accettata (framework web aggiornato da 0004).
- [0003 - Tag e GitHub Release](decisions/0003-tag-e-github-release.md): accettata.
- [0004 - Dashboard su Vite invece di Next.js](decisions/0004-dashboard-vite-invece-di-next.md): accettata.

## Decisioni sostituite o superate

- La scelta di framework di 0002 (Next.js) è superata da 0004 (Vite); il resto di
  0002 resta valido.

## Regole

- Ogni decisione stabile vive in `docs/decisions/`.
- `docs/decisions/template.md` è il template da copiare per nuove ADR.
- Decisioni non ancora approvate stanno in backlog o issue, ma devono essere
  linkate da `docs/INDEX.md`.
- Non duplicare decisioni con lo stesso titolo o lo stesso scopo.
- Quando una decisione sostituisce documentazione precedente, migrare o collegare
  il contenuto utile prima di rimuovere il vecchio documento.
