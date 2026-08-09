Rispondi sempre in italiano, in modo pratico, diretto e operativo.

# Sentinel

Sentinel è una CLI Node.js/TypeScript che monitora cambiamenti su siti web
pubblici e produce output tracciabili in `data/`, `snapshots/` e `reports/`.
La prima scansione di un monitor è una baseline silenziosa: il report esce
sempre, l'email solo se ci sono cambiamenti o problemi.

Non è una piattaforma di crawling generalista, non è un archivio integrale di
siti terzi e non diventa un servizio multi-user senza decisione esplicita.

Fase: runtime MVP con scan schedulato su GitHub Actions e dashboard React/Vite
su Vercel. Runtime operativo, release del tool e deploy dashboard sono canali
distinti.

## Dove sta il resto

Qui stanno i vincoli. I dettagli vivono altrove e vanno letti quando il lavoro
li tocca, non prima:

- `sentinel.config.yml` è la fonte autoritativa su monitor, limiti di crawling,
  estensioni e profili email: leggila invece di fidarti di una spec a mano.
- `docs/TOOLCHAIN.md`: versioni, comandi reali, verifiche per scope, guardrail.
- `docs/INDEX.md`: catalogo documentale canonico, con il resto della governance.
- `docs/DECISIONS.md` e `docs/decisions/`: un ADR vince su un'abitudine.

`reports/` e `snapshots/` sono evidenze prodotte dal monitor, non governance:
non spostarli in `docs/` e non usarli come source of truth.

## Guardrail

Non negoziabili senza una nuova decisione esplicita:

- Rispetta `robots.txt`.
- Segreti — password SMTP, token Blob, credenziali dashboard — solo da variabili
  d'ambiente, GitHub Secrets o Portachiavi. Mai in repo, nei log o nei riepiloghi.
- Snapshot: solo hash, metadati e testo pubblico normalizzato, al massimo 3 per
  URL. Mai HTML completo, contenuti dietro autenticazione, risposte di form o
  dati raccolti fuori dal crawling pubblico dichiarato.
- `data/`, `snapshots/` e `reports/` sono output applicativi committabili dal
  workflow sul branch `sentinel-outputs`, non cache da ripulire.
- Niente nuovi workflow, bot, release automation o branch protection senza
  decisione esplicita: ADR 0008 documenta la configurazione corrente del
  Ruleset e del branch operativo.
- Su siti pubblici, provider email, prezzi, limiti o policy variabili verifica
  la fonte ufficiale corrente e distingui fatto, fonte e assunzione.

## Autonomia

Procedi senza chiedere: leggere e modificare codice e documentazione, eseguire
test e build, `scan --dry-run`, creare branch, commit e PR.

Chiedi prima per comandi distruttivi, scan reali fuori dallo schedule, invio
email, cambio di schedule o provider e aggiunta o rimozione di monitor. Per
deploy, tag e release la richiesta di pubblicazione vale come autorizzazione;
ogni altra scrittura fuori dalla repo richiede una richiesta separata.

Se il worktree contiene modifiche non tue, non sovrascriverle: usa un branch
separato o lavora solo su file non sovrapposti, dichiarandolo.

Delega a un subagent solo per indagini ampie e davvero parallelizzabili, non per
lavoro che chiudi in pochi tool call e non per ricontrollare te stesso.

## Flusso di lavoro

- Lavori non banali: branch `codex/<tema>` e PR verso `main`. Commit diretto su
  `main` solo per micro docs-only a basso rischio.
- Conventional Commit coerenti con l'impatto reale, titolo PR incluso: il
  workflow `pr-title.yml` lo controlla e un nome di branch non è un titolo
  valido (`gh pr create --title "docs: ..."`).
- Dopo il merge pulisci branch e worktree creati per il flusso, o dichiara cosa
  resta aperto.

## Verifiche

`npm test` e `npm run build` prima di chiudere modifiche al codice. La tabella
verifiche-per-scope in `docs/TOOLCHAIN.md` calibra il resto, dalla sola review
documentale per i docs-only al gate completo per runtime schedulato, dati,
provider email, deploy e release.

Toccando `index.html`, `web/`, `api/`, `middleware.ts` o altre superfici UI
aggiungi `npm run doctor` e controlli proporzionati su route,
viewport e stati vuoto/errore/loading. React Doctor serve anche prima di
chiudere una release major/minor.

Se un controllo fallisce o non è eseguibile, dichiaralo con impatto e prossimo
passo invece di lasciarlo implicito.

## Significato di `Pubblica`

Quando il proprietario, riferendosi alla repository o alla modifica corrente,
dice `Pubblica` o chiede in modo affermativo e inequivocabile di pubblicare,
autorizza l'intero ciclo tecnico applicabile. Domande, ipotesi, pianificazioni e
negazioni non costituiscono autorizzazione. L'agente non si ferma a stati
intermedi e completa tutti i passaggi applicabili: preparazione e verifiche,
branch e commit, versione e changelog quando richiesti, push, PR, soli gate
bloccanti, merge, tag e GitHub Release quando previsti, deploy o promozione
tecnica e verifica live. La sequenza concreta, in particolare tra versionamento,
merge, deploy e release, è quella definita dalla policy della repository.

La pulizia finale rimuove soltanto branch e worktree temporanei creati nel ciclo
corrente e già assorbiti; controlla stash e altri residui senza alterare elementi
preesistenti o estranei alla pubblicazione. Se un passaggio non è applicabile, lo
dichiara e prosegue con gli altri. La richiesta affermativa di pubblicazione
vale come autorizzazione a PR, merge, deploy tecnico e release previsti dal
ciclo, senza una seconda conferma. Non autorizza pubblicazione di temi Shopify
live, submission Shopify App Store, billing o nuove attivazioni produttive,
TestFlight o App Store, invii Aruba, email o scansioni reali, né aggiornamenti
Notion: queste azioni richiedono una richiesta esplicita separata. Una richiesta
riferita soltanto a una di queste azioni non avvia la pubblicazione della
repository. Non dichiarare `pubblicato` finché il ciclo applicabile e la
rilettura finale di PR, check, deploy, release e stato Git non sono completi.

## Publish, release e deploy

Non c'è VPS e non ci sono domini a pagamento.

Il deploy operativo è lo scan schedulato su GitHub Actions (ADR 0001), che
committa gli output e fallisce solo su errore tecnico o email necessaria non
partita. Il deploy della dashboard passa da Vercel CLI ed è indipendente.

Tag `vX.Y.Z` e GitHub Release solo per release del tool o della dashboard, mai
per scan, report, snapshot o aggiornamenti data-only (ADR 0003). Release Please
non è adottato.

## Tono e output

Dashboard, report ed email restano in italiano operativo, con stato chiaro e
prossimo passo evidente. Il lessico stabile è `monitor`, `scan`, `avviso`,
`problema`, `cambiamento`, `Avvisi noti`, `output applicativi`; un monitor si
chiama come il sito reale. Evita copy che prometta archivio integrale,
sorveglianza generalista o partnership con i siti monitorati.

Adatta la lunghezza dei documenti che scrivi su disco a quello che il lavoro
richiede, senza sezioni di riempimento né riepiloghi ridondanti. Se una
decisione cambia naming, tono o posizionamento, aggiorna `docs/CONTEXT.md` o
scrivi un ADR invece di lasciarla solo in chat.

## Chiusura

Chiudi con cosa è cambiato, verifiche eseguite o saltate con motivo, stato di
publish/release/deploy (anche solo `N/A` con la ragione), branch coinvolti e
prossimo passo reale. Un lavoro è completo quando chiude la richiesta al suo
scope senza lasciare in sospeso verifiche, output applicativi, cleanup o rischi
non dichiarati.
