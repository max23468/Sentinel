# 0007 - Gate CI obbligatorio su main

Data: 2026-08-06

Stato: Superata da 0008

## Contesto

> ADR 0008 sostituisce il canale di commit degli output e amplia il Ruleset con
> `codex-review`; questa ADR resta come traccia della configurazione precedente.

React Doctor deve bloccare warning ed errori sia nel workflow dedicato sia nel
gate generale. ADR 0005 aveva rimosso i required check perché il `GITHUB_TOKEN`
del workflow Sentinel non può bypassare un ruleset su una repository personale:
il push diretto degli output applicativi restava quindi senza un canale valido.

## Decisione

Applicare a `main` il ruleset attivo `main governance`, con strict checking e i
contesti obbligatori exact-name `react-doctor` e `verify` prodotti da GitHub
Actions. Il ruleset non richiede una PR, così il runtime di ADR 0001 resta
autonomo.

Il workflow Sentinel esegue `npm run check` prima dello scan. Se genera un
commit limitato a `data/`, `snapshots/` e `reports/`, pubblica temporaneamente
quello stesso SHA su `sentinel-output-check`, registra su quello SHA i due status
verdi tramite il proprio `GITHUB_TOKEN`, esegue il push fast-forward su `main` e
rimuove il branch temporaneo. Gli status attestano il gate già eseguito sullo
stesso albero di codice; non servono PAT, bypass o nuovi segreti.

Il workflow React Doctor usa la versione npm esatta dichiarata nel lockfile,
scope `changed` sulle PR, scope `full` sui push e blocking `warning`. Il workflow
mensile `Governance` verifica che ruleset e workflow restino attivi e coerenti.

## Alternative considerate

- Bypass per GitHub Actions: non configurabile sulla repository personale.
- PR automatica degli output: i workflow avviati da una PR creata con
  `GITHUB_TOKEN` richiedono approvazione manuale.
- PAT o deploy key: scartati perché introdurrebbero un segreto persistente solo
  per aggirare il ruleset.

## Impatti

- Merge: `react-doctor` e `verify` devono essere verdi e aggiornati rispetto a
  `main`.
- Runtime: lo scan conserva il commit diretto degli output dopo aver attestato
  i gate sullo SHA esatto.
- Sicurezza: i required check accettano solo l'integrazione GitHub Actions; il
  workflow operativo può attestare soltanto commit che ha appena creato dai tre
  path applicativi dichiarati.
- Deploy/release: invariati.

## Verifiche

- `npm run doctor`: 100/100, 0 errori, 0 warning.
- `npm run check` e `npm run test:coverage`.
- Test statico di workflow, versione, blocking e inclusione nel gate generale.
- Readback API del ruleset e dei check prodotti sulla HEAD della PR.

## Collegamenti

- [0001 - GitHub Actions come runtime operativo MVP](0001-github-actions-runtime-operativo.md)
- [0005 - Niente ruleset CI obbligatoria su main](0005-niente-ruleset-ci-su-main.md)
- [0006 - Gate Codex review exact-HEAD](0006-gate-codex-review-exact-head.md)
- Toolchain: `../TOOLCHAIN.md`
