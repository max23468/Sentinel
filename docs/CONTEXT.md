# Contesto operativo Sentinel

## Stato progetto

- Fase: runtime operativo MVP.
- Ultima versione/release: `0.1.0` in `package.json`; nessuna release GitHub
  pubblicata.
- Ultimo deploy operativo: GitHub Actions su branch `main`.
- Dashboard web: app Next.js pubblicabile su Vercel da CLI, con dati dinamici su
  Vercel Blob privato.
- GitHub: repository privata `https://github.com/max23468/Sentinel`.

## Fonte di verità

- Regole operative: `AGENTS.md`.
- Configurazione monitor: `sentinel.config.yml`.
- Roadmap: `docs/ROADMAP.md`.
- Backlog: `docs/BACKLOG.md`.
- Toolchain: `docs/TOOLCHAIN.md`.
- Decisioni: `docs/DECISIONS.md`, `docs/DECISIONS_PENDING.md` e ADR in
  `docs/decisions/`.
- Workflow operativo: `.github/workflows/sentinel.yml`.
- Dashboard online: app Next.js in `app/`, proxy Basic Auth in `proxy.ts`,
  payload Blob pubblicato con `sentinel publish-dashboard`.
- Release versionate: tag `vX.Y.Z` e GitHub Release solo per release del tool o
  della dashboard, secondo ADR `docs/decisions/0003-tag-e-github-release.md`.

## Ultimo contesto utile

Sentinel monitora siti pubblici e salva output applicativi tracciabili. Il primo
profilo era Ortix; ora sono configurati Ortix e San Carlo Sviluppo.

Il run rosso storico del 2026-05-24 era legato a configurazione email incompleta
o scan errors già corretti lato workflow/secrets. Al controllo del 2026-05-24 gli
ultimi run manuali GitHub Actions risultano verdi.

## Vincoli repo-specifici

- Rispettare sempre `robots.txt`.
- Non committare segreti, password SMTP, `.env` o cache locali.
- Non salvare HTML completo: solo hash, metadati e testo normalizzato.
- `data/`, `snapshots/` e `reports/` sono output applicativi tracciabili e
  possono essere committati dal workflow.
- Eccezione repo-specifica: GitHub Actions è runtime operativo MVP di Sentinel.
  È stato riavviato dopo verifica e monitoraggio nel riequilibrio post-pausa.
- Le password email devono arrivare solo da variabili d'ambiente, GitHub Secrets
  o Portachiavi macOS.
- Le credenziali dashboard e `BLOB_READ_WRITE_TOKEN` devono stare solo in env
  locale/Vercel, mai in repo.

## Verifiche da ricordare

- `git status --short --branch`.
- `npm test`.
- `npm run build`.
- `npm run sentinel -- publish-dashboard` solo con `BLOB_READ_WRITE_TOKEN`
  configurato.
- `gh run list --limit 10`.
- `gh run view <run-id> --log-failed` se un workflow fallisce.

## Handoff per nuova chat

Prima di procedere:

1. leggere `AGENTS.md`;
2. controllare `git status --short --branch`;
3. leggere `README.md`, `sentinel.config.yml` e `docs/INDEX.md`;
4. controllare gli ultimi run GitHub Actions;
5. identificare verifiche proporzionate;
6. non modificare o cancellare output applicativi senza motivo esplicito.
7. se i run GitHub Actions risultano bloccati da errori infrastrutturali,
   verificare priorità di ripristino con il mantenimento operativo e poi riprogrammare
   i run; in alternativa usare strumenti locali solo per attività di diagnosi.

## Rischi aperti

- Confondere output applicativi con cache da ignorare.
- Rompere il workflow operativo introducendo secret, provider email o schedule
  non verificati.
- Aggiungere nuovi siti senza valutare rumore, privacy e rispetto di `robots.txt`.
- Far crescere `snapshots/` e `reports/` senza una policy di retention se il
  numero di monitor aumenta.
- Pubblicare la dashboard online senza Basic Auth o con Blob pubblico.

## Prossimo passo

- Osservare il prossimo run schedulato e promuovere in roadmap solo problemi
  reali emersi dai report o dai log GitHub Actions.
