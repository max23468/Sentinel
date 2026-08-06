# 0008 - Output operativi su branch dedicato

Data: 2026-08-06

Stato: Accettata

## Contesto

Lo scan Sentinel deve conservare `data/`, `snapshots/` e `reports/`, ma il gate
exact-HEAD `codex-review` può validare soltanto commit appartenenti a una PR. Se
fosse richiesto su `main`, il commit diretto degli output descritto dalle ADR
0001 e 0007 verrebbe bloccato oppure richiederebbe un bypass o uno status finto.

## Decisione

Conservare gli output applicativi sul branch operativo `sentinel-outputs`, che
contiene esclusivamente `data/`, `snapshots/` e `reports/`. Il workflow Sentinel
continua a partire dal codice fidato di `main`, ripristina gli output dal branch
operativo prima dello scan e pubblica sullo stesso branch un commit costruito da
un indice Git separato. Non esegue codice proveniente da `sentinel-outputs`.

Il comando `dashboard` salva anche `reports/dashboard.json`. Quando Vercel Blob
o i file locali non sono disponibili, le API autenticate della dashboard usano
quel modello e i singoli report dal branch pubblico `sentinel-outputs`.

Il Ruleset `main governance` richiede senza bypass `codex-review`,
`react-doctor` e `verify`, tutti prodotti dall'integrazione GitHub Actions. Il
workflow Governance controlla mensilmente i tre contesti e i relativi workflow.

## Alternative considerate

- Falso status `codex-review` sui commit automatici: scartato perché non
  rappresenterebbe una review prodotta da `chatgpt-codex-connector[bot]`.
- Bypass per GitHub Actions: scartato perché viola il modello di protezione.
- PR automatica degli output: scartata perché richiederebbe intervento manuale o
  una credenziale persistente per riattivare workflow e review.

## Impatti

- `main` contiene codice e governance, non lo stato operativo mutabile.
- Lo scan resta autonomo e conserva la baseline tra le esecuzioni.
- Il branch operativo non è eseguibile e ogni suo commit contiene soltanto i tre
  alberi di output dichiarati.
- Deploy dashboard, schedule, provider email, tag e release restano invariati.

## Verifiche

- Test statico del restore e del commit con indice Git separato.
- Readback del tree del branch `sentinel-outputs`.
- `npm run check`.
- Readback API del Ruleset e dispatch dei workflow Governance e Codex.

## Collegamenti

- [0001 - GitHub Actions come runtime operativo MVP](0001-github-actions-runtime-operativo.md)
- [0006 - Gate Codex review exact-HEAD](0006-gate-codex-review-exact-head.md)
- [0007 - Gate CI obbligatorio su main](0007-gate-ci-obbligatorio-su-main.md)
- Toolchain: `../TOOLCHAIN.md`
