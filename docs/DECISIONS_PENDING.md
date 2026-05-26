# Decisioni aperte Sentinel

Questo registro contiene decisioni strutturali non ancora approvate.

Decisioni aperte:

- Runtime operativo dopo la sospensione Actions: dal `2026-06-02` valutare
  riattivazione del workflow Sentinel o alternativa fuori da GitHub Actions.

Decisioni chiuse:

- Release versionate: chiusa con
  `docs/decisions/0003-tag-e-github-release.md`. Sentinel resta runtime
  operativo continuo; tag e GitHub Release valgono solo per release del tool o
  della dashboard, non per scan/report/output data-only.

Quando una decisione viene approvata:

- creare o aggiornare un ADR in `docs/decisions/`;
- collegarlo da `docs/DECISIONS.md`;
- aggiornare `docs/TOOLCHAIN.md`, `docs/CONTEXT.md` o roadmap se cambia il
  comportamento operativo.
