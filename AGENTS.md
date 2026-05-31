Rispondi sempre in italiano, in modo pratico, diretto e operativo.

# Sentinel

Sentinel è un tool custom generico per monitorare cambiamenti su siti web pubblici.
Il primo monitor configurato è Ortix.

Priorità: istruzioni di sistema/developer, eventuali `AGENTS.md` più profondi
che prevalgono per il loro scope, questo `AGENTS.md`, documenti canonici
della repo, richiesta utente, convenzioni reali di codice/test/configurazione e
assunzioni solo marginali.

Sentinel non è una piattaforma di crawling generalista, non è un archivio
integrale di siti terzi e non deve diventare una dashboard o servizio multi-user
senza decisione esplicita.

## Stack

- Runtime: Node.js + TypeScript.
- Package manager: npm.
- CLI: `sentinel`.
- Configurazione: YAML.
- Test: Vitest.

## Regole operative

- Prima di modifiche non banali controlla sempre `git status --short`.
- Prima di modifiche documentali o operative leggi anche `README.md`,
  `docs/INDEX.md`, `docs/CONTEXT.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md`,
  `docs/TOOLCHAIN.md`, `docs/DECISIONS.md`, `docs/DECISIONS_PENDING.md` e
  `docs/decisions/`.
- Il catalogo documentale canonico è `docs/INDEX.md`: la root resta per
  ingresso, configurazione, codice e output applicativi dichiarati; `docs/`
  conserva governance, roadmap, backlog, contesto, toolchain, decisioni e guide.
- `docs/ROADMAP.md` resta per direzione, priorità e prossimi passi correnti:
  aggiornarla quando cambiano monitor, frequenza, output, canali email,
  runtime o backlog; non usarla come changelog o archivio di run completati.
- Mantieni scope piccolo e coerente con la richiesta.
- Non sovrascrivere modifiche non tue.
- Per lavori non banali usa branch `codex/<tema>` e PR verso `main`; il commit diretto su `main` resta solo per micro docs-only a basso rischio.
- Se il worktree contiene modifiche non tue, usa un branch/worktree separato o lavora solo su file non sovrapposti dichiarandolo nel riepilogo.
- Non usare comandi distruttivi senza conferma.
- Rispetta sempre `robots.txt`.
- Non committare segreti, password SMTP, file `.env` o cache locali.
- Le password email devono arrivare solo da variabili d'ambiente, GitHub Secrets o Portachiavi.
- Valuta impatto su documentazione, changelog, versione, release e deploy prima di chiudere, anche quando il risultato è `N/A`.
- Usa Conventional Commit coerenti con l'impatto reale. Non aggiungere workflow,
  bot, release flow, deploy automation o branch protection senza decisione
  esplicita. Usa PR template, issue template, PR title check o controllo
  equivalente quando lavori via GitHub.
- Dopo merge/pubblicazione controlla `git branch -vv` e `git worktree list`, poi
  pulisci branch/worktree non più necessari o dichiara cosa resta aperto.

## Policy dati

- `data/`, `snapshots/` e `reports/` sono output applicativi e possono essere committati dal workflow.
- I report Markdown in `reports/` e gli snapshot non sono governance di
  progetto: sono evidenze/output del monitor. Non spostarli in `docs/` e non
  usarli come source of truth se contraddicono `AGENTS.md`, `docs/INDEX.md` o
  le decisioni.
- La prima scansione crea baseline silenziosa: report sempre generato, email no se non ci sono cambiamenti o errori.
- HTML: salva hash, metadati e testo normalizzato; non salvare HTML completo.
- File pubblici: salva hash binario e metadati.
- Mantieni al massimo gli ultimi 3 snapshot testuali per URL.
- Gli snapshot possono contenere testo pubblico normalizzato, inclusi contatti
  pubblicati dal sito monitorato; non devono includere input privati, contenuti
  dietro autenticazione, risposte di form, segreti o dati acquisiti fuori dal
  crawling pubblico dichiarato.
- Non committare cache, log, dump, export, screenshot sensibili, `.DS_Store` o
  altri file temporanei non previsti. Durante migrazioni, rinomini o merge
  documentali non perdere contenuti utili: aggiorna link e indici, preserva ciò
  che resta valido e dichiara nel riepilogo ciò che viene rimosso perché superato.
- Per siti pubblici, provider email, API, prezzi, limiti o policy variabili,
  verifica fonti ufficiali correnti e distingui fatto, fonte, assunzione e
  decisione interna.

## Ortix MVP

- URL iniziale: `https://www.ortix.it/sitemap_index.xml`.
- Scansione settimanale: sabato 09:00 Europe/Rome.
- Discovery: sitemap + crawling link interni.
- Crawling: stesso dominio, profondità 3, massimo 500 URL.
- URL: rimuovi parametri tracking, considera equivalente lo slash finale, segui redirect e salva URL finale canonica.
- File monitorati: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `zip`, immagini comuni.

## Comandi previsti

```bash
sentinel scan
sentinel scan --dry-run
sentinel report
sentinel test-email --profile gmail
sentinel test-email --profile icloud
```

## Verifiche

Prima di chiudere modifiche al codice esegui, se pertinenti:

```bash
npm test
npm run build
```

Usa la corsia `veloce` per docs/governance a basso rischio, `standard` per codice/config ordinari e `completa` per runtime schedulato, dati/output, sicurezza, release o deploy.

Mappa il rischio prima dei comandi:

- sola analisi o nessuna modifica: nessun test applicativo, dichiarare fonti e
  limiti;
- docs-only: review documentale e `git diff --check` quando utile;
- documenti operativi critici, workflow o config: review mirata del runbook o
  workflow modificato;
- test-only, runtime piccolo o UI localizzata: `npm test`, `npm run build` o
  check mirati in base al diff;
- runtime schedulato condiviso, dati/output, provider email, deploy/config,
  release/versioning o UI dashboard sostanziale: gate completo proporzionato,
  smoke/manual run quando serve e React Doctor nei casi previsti.

Se un controllo fallisce o non è eseguibile, dichiaralo esplicitamente con impatto e prossimo passo.

## Release e deploy

Non c'è VPS e non ci sono domini a pagamento.
La pubblicazione codice passa da commit, push e PR/merge su GitHub; la chiusura operativa richiede anche cleanup del checkout (branch/worktree locali e remoti) quando creati per il flusso.
Quando dici `pubblica`, il flusso completo include PR/merge o flusso equivalente su `main`, verifica finale, controllo inbox e cleanup. Release e deploy vanno valutati insieme quando entrambi sono applicabili; se non servono, dichiarali `N/A`.
Il deploy operativo MVP passa da GitHub Actions:

- `schedule` + `workflow_dispatch`;
- commit di `data/`, `snapshots/` e `reports/`;
- successo anche se vengono trovati cambiamenti;
- fallimento se c'è un errore tecnico o se un'email necessaria non parte.

Tag Git `vX.Y.Z` e GitHub Release sono obbligatori per release del tool o della dashboard
secondo `docs/decisions/0003-tag-e-github-release.md`. Non crearli per semplici
scan, report, snapshot o aggiornamenti data-only.

Release Please non è adottato: non delegare changelog, versioni, tag o GitHub
Release a bot automatici senza nuova decisione esplicita.

La issue GitHub `Codex feedback inbox` è il canale operativo per i commenti
Codex sulle PR, è marcata dalla label `codex-feedback-inbox` ed è aggiornata
dal workflow `Codex PR comments`. Controllala prima di PR ready, merge,
pubblicazione, deploy o release non banali.

Sentinel ha una dashboard Next.js/React documentata in
`docs/decisions/0002-dashboard-vercel-dinamica.md`. Se tocchi `app/page.tsx`,
`app/dashboard-client.tsx`, `app/api/dashboard/route.ts` o superfici UI
collegate, esegui `npm run quality:react-doctor` e aggiungi verifiche browser,
responsive, accessibilità e stati vuoti/errore/loading proporzionati prima di
considerarla completa. Per cambi layout/flusso usa `npm run dev` o il deploy
pertinente, controlla la dashboard dietro Basic Auth senza esporre credenziali e
dichiara quali route, viewport e stati hai verificato.

React Doctor è obbligatorio anche prima di considerare chiusa una release
major/minor del tool o della dashboard, cioè quando cambia `X` o `Y` nello
schema `X.Y.Z`; non è richiesto per semplici scan/report o patch senza modifiche
React trasversali.

## Risposta finale e completamento

Chiudi con cosa è cambiato o scoperto, file principali se utili, verifiche
eseguite o non eseguite con motivo, stato publish, release e deploy, branch/worktree
coinvolti, rischi residui e prossimo passo reale. Un lavoro è completo solo se
scope, verifiche proporzionate, inbox, output applicativi, publish/release/deploy
e cleanup sono gestiti o dichiarati non applicabili.
Publish, release e deploy devono essere completati oppure dichiarati non
applicabili con motivo.

Definizione di completamento: un lavoro è completo quando chiude la richiesta
senza allargare inutilmente lo scope e gestisce esplicitamente verifiche,
inbox, output applicativi, publish, release e deploy, cleanup e rischi residui.
