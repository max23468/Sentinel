# 0006 - Gate Codex review exact-HEAD

Data: 2026-08-06

Stato: Accettata

## Contesto

Le review Codex non erano un gate: la repository manteneva una inbox legacy dei
thread e GitHub poteva riusare segnali appartenenti a commit o tentativi
precedenti. Serve un solo status che rappresenti esclusivamente la review
dell'HEAD corrente della PR.

## Decisione

Adottare un solo workflow `Codex review gate`, allineato a SyncBay, che:

- usa `pull_request_target` e fa checkout esclusivamente del branch predefinito;
- ha permessi `contents`, `issues` e `pull-requests` in lettura e `statuses` in
  scrittura;
- pubblica `codex-review` sull'HEAD esatto e invalida ogni prova al nuovo SHA;
- accetta soltanto segnali di `chatgpt-codex-connector[bot]` legati al tentativo
  corrente; finding P0-P3 correnti prevalgono sempre;
- sostituisce la workflow e la issue legacy `Codex feedback inbox`.

La PR di bootstrap non può eseguire il workflow nuovo perché
`pull_request_target` usa la versione già presente su `main`: il gate va provato
con dispatch solo dopo il merge.

## Interazione con ADR 0005

ADR 0007 supera il divieto generale di ADR 0005 e rende obbligatori i gate CI
compatibili con il commit schedulato degli output. `codex-review` resta escluso
dal ruleset finché il workflow operativo non può produrne un esito automatico
senza indebolire la semantica exact-HEAD.

## Impatti

- Sicurezza: il workflow non esegue codice della PR e usa permessi minimi.
- Merge: lo status è exact-HEAD; senza un Ruleset resta informativo.
- Runtime, deploy e release: invariati.

## Verifiche

- Test dinamici del classificatore e test statico del workflow.
- `npm test`, typecheck e build completa.
- Dispatch reale e controllo dello status sull'HEAD dopo il merge.

## Collegamenti

- [0005 - Niente ruleset CI obbligatoria su main](0005-niente-ruleset-ci-su-main.md)
- [0007 - Gate CI obbligatorio su main](0007-gate-ci-obbligatorio-su-main.md)
- Toolchain: `docs/TOOLCHAIN.md`
