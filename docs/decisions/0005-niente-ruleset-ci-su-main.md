# 0005 - Niente ruleset CI obbligatoria su main

Data: 2026-07-24

Stato: Accettata

## Contesto

La ruleset `main - richiede CI` (creata il 2026-07-20 insieme a CI su PR e
auto-merge Dependabot) richiedeva il check `Typecheck, build e test` su ogni
scrittura verso `main`, con bypass per il solo ruolo admin.

Il `GITHUB_TOKEN` del workflow `Sentinel` non può bypassare la regola: dal
2026-07-20 il commit degli output applicativi falliva con `GH013`. Il problema è
emerso il 2026-07-24 al primo run con output da committare, perché gli scan del
4, 11 e 18 luglio non avevano modifiche da salvare.

Il bypass per l'app GitHub Actions non è configurabile su un repo personale:
l'API risponde `422 Actor GitHub Actions integration must be part of the ruleset
source or owner organization`. Il bypass per il ruolo write non copre il token.

La regola non proteggeva `main` dall'owner, che la bypassa sempre: l'unico
soggetto realmente vincolato era l'automazione.

## Decisione

Rimuovere la ruleset `main - richiede CI` e riportare il workflow `Sentinel` al
push diretto degli output applicativi su `main`.

Il workflow `CI` continua a girare su PR e push: resta segnale, non gate.

## Alternative considerate

- Commit degli output via PR con auto-merge: funzionante ma aggiunge una PR a
  settimana e rende lo scan dipendente dall'API pull request.
- PAT admin come secret del workflow: risolve senza PR, ma introduce un segreto
  di lunga durata da ruotare.
- Branch dati dedicato non protetto: `main` resterebbe solo codice, ma richiede
  un checkout aggiuntivo dello stato precedente prima di ogni scan.

## Impatti

- Prodotto: nessuno.
- Tecnico: lo scan schedulato torna a un solo push, senza dipendenze dall'API
  pull request.
- Dati/privacy: invariati, gli output restano quelli dichiarati in `AGENTS.md`.
- Deploy/release: il runtime GitHub Actions di ADR 0001 resta valido.
- Documentazione: aggiornati `docs/TOOLCHAIN.md` e `docs/ROADMAP.md`.

## Conseguenze operative

- L'auto-merge Dependabot non è più attivabile: senza check obbligatorio la PR è
  già mergiabile e `gh pr merge --auto` non si aggancia. Il workflow
  `Dependabot auto-merge` è stato rimosso e le PR Dependabot si mergiano a mano
  dopo aver controllato la CI.
- Il merge di una PR con CI rossa non è più bloccato da GitHub: controllare i
  check prima di mergiare.
- Per ripristinare la protezione servono ruleset e workflow auto-merge insieme:
  il contenuto rimosso è recuperabile dalla storia git.

## Verifiche

- `gh api repos/max23468/Sentinel/rulesets` non elenca più la ruleset.
- `gh workflow run sentinel.yml` completa incluso lo step di commit.

## Collegamenti

- Roadmap: `docs/ROADMAP.md`
- Backlog: `docs/BACKLOG.md`
- PR/issue: PR #64 (introduzione CI su PR e auto-merge Dependabot)
- Documenti collegati: `docs/decisions/0001-github-actions-runtime-operativo.md`,
  `docs/TOOLCHAIN.md`
