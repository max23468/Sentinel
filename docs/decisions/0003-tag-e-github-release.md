# 0003 - Tag e GitHub Release

Data: 2026-05-26

Stato: Accettata

## Contesto

Sentinel è un monitor operativo continuo: le scansioni, i report e gli output in
`data/`, `snapshots/` e `reports/` non sono release prodotto.

La repo ha una versione in `package.json`, una CLI Node.js/TypeScript e una
dashboard web. Il runtime operativo MVP passa da GitHub Actions quando i minuti
sono disponibili; la dashboard online può essere aggiornata da CLI/Vercel senza
GitHub Actions.

## Decisione

Sentinel mantiene il runtime operativo continuo come comportamento predefinito.

Tag Git e GitHub Release si usano solo quando viene rilasciata una nuova
versione del tool o della dashboard:

- la source of truth della versione è `package.json`;
- il tag Git deve avere formato `vX.Y.Z` e corrispondere esattamente alla
  versione in `package.json`;
- la GitHub Release, se creata, parte da quel tag e descrive cambiamenti del
  tool o della dashboard, non semplici output di scansione;
- scan, report, baseline, snapshot e aggiornamenti di dashboard data-only non
  creano tag e non creano GitHub Release;
- GitHub Actions runtime e deploy Vercel dashboard restano separati dalla
  release versionata.

Se Sentinel avrà un ciclo release ricorrente, introdurre `CHANGELOG.md` prima di
creare la prima serie stabile di GitHub Release.

## Alternative considerate

- Tag a ogni run operativo: scartato perché renderebbe il repository rumoroso e
  confonderebbe output applicativi con release del tool.
- Nessun tag anche per modifiche del tool: scartato perché una release della CLI
  o della dashboard deve essere identificabile.
- Release automatica tramite workflow: scartata finché GitHub Actions resta
  sospeso e il ciclo release è manuale.

## Impatti

- Prodotto: le release riguardano il tool, non i cambiamenti osservati nei siti.
- Tecnico: `package.json` resta il riferimento versione.
- Dati/privacy: gli output applicativi restano gestiti dalle policy esistenti.
- Deploy/release: GitHub Actions e Vercel non creano automaticamente tag o
  GitHub Release.
- Documentazione: `AGENTS.md`, `docs/TOOLCHAIN.md`, `docs/CONTEXT.md` e backlog
  distinguono runtime continuo e release versionata.

## Conseguenze operative

- Non creare tag o GitHub Release per il solo aggiornamento di report/snapshot.
- Prima di una release del tool, aggiornare `package.json` e preparare note di
  rilascio verificabili.
- Mantenere una soglia di monitoraggio sul consumo minuti e usare il runbook
  operativo documentato quando la pipeline GitHub Actions non è disponibile;
  altrimenti il workflow GitHub Actions resta operativo come previsto.

## Verifiche

- Review documentale.
- `git diff --check`.

## Collegamenti

- Runtime Actions: `docs/decisions/0001-github-actions-runtime-operativo.md`
- Dashboard Vercel: `docs/decisions/0002-dashboard-vercel-dinamica.md`
- Toolchain: `docs/TOOLCHAIN.md`
