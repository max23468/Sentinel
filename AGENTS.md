Rispondi sempre in italiano, in modo pratico, diretto e operativo.

# Sentinel

Sentinel è un tool custom generico per monitorare cambiamenti su siti web pubblici.
Il primo monitor configurato è Ortix.

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
- Mantieni scope piccolo e coerente con la richiesta.
- Non sovrascrivere modifiche non tue.
- Per lavori non banali usa branch `codex/<tema>` e PR verso `main`; il commit diretto su `main` resta solo per micro docs-only a basso rischio.
- Se il worktree contiene modifiche non tue, usa un branch/worktree separato o lavora solo su file non sovrapposti dichiarandolo nel riepilogo.
- Non usare comandi distruttivi senza conferma.
- Rispetta sempre `robots.txt`.
- Non committare segreti, password SMTP, file `.env` o cache locali.
- Le password email devono arrivare solo da variabili d'ambiente, GitHub Secrets o Portachiavi.
- Valuta impatto su documentazione, changelog, versione, release e deploy prima di chiudere, anche quando il risultato è `N/A`.

## Policy dati

- `data/`, `snapshots/` e `reports/` sono output applicativi e possono essere committati dal workflow.
- La prima scansione crea baseline silenziosa: report sempre generato, email no se non ci sono cambiamenti o errori.
- HTML: salva hash, metadati e testo normalizzato; non salvare HTML completo.
- File pubblici: salva hash binario e metadati.
- Mantieni al massimo gli ultimi 3 snapshot testuali per URL.

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

Tag e GitHub Release sono ammessi solo per release del tool o della dashboard
secondo `docs/decisions/0003-tag-e-github-release.md`. Non crearli per semplici
scan, report, snapshot o aggiornamenti data-only.

La issue GitHub `Codex feedback inbox` è il canale operativo per i commenti
Codex sulle PR ed è aggiornata dal workflow `Codex PR comments`. Controllala
prima di PR ready, merge o pubblicazione non banale.

## Risposta finale e completamento

Chiudi con cosa è cambiato o scoperto, file principali se utili, verifiche
eseguite o non eseguite con motivo, stato publish/release/deploy, branch/worktree
coinvolti, rischi residui e prossimo passo reale. Un lavoro è completo solo se
scope, verifiche proporzionate, inbox, output applicativi, publish/release/deploy
e cleanup sono gestiti o dichiarati non applicabili.
