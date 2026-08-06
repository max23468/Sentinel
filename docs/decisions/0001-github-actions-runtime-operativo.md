# 0001 - GitHub Actions come runtime operativo MVP

Data: 2026-05-24

Stato: Accettata

## Contesto

Sentinel è una CLI Node.js/TypeScript che monitora siti pubblici e produce output
applicativi in `data/`, `snapshots/` e `reports/`. Non ha VPS, dominio o servizio
runtime dedicato. Il primo uso operativo richiede una scansione schedulata,
invio email quando necessario e commit degli output.

## Decisione

Usare GitHub Actions come runtime operativo MVP.

Il workflow definito su `main` esegue test, build e scan, conserva gli output
applicativi sul branch `sentinel-outputs` secondo ADR 0008 e fallisce solo per
errori tecnici o email necessarie non inviate.

## Alternative considerate

- VPS dedicata: scartata perché introduce gestione server non necessaria per il
  monitor MVP.
- Esecuzione solo locale: scartata perché non garantisce scansione ricorrente.
- Servizio SaaS esterno: scartato finché il tool custom resta sufficiente e
  controllabile.

## Impatti

- Prodotto: Sentinel resta leggero e operativo senza infrastruttura dedicata.
- Tecnico: GitHub Actions diventa il canale di deploy operativo.
- Dati/privacy: non si salvano HTML completi; gli output tracciati restano nel
  repository. Quando questa ADR è stata scritta il repository era privato; al
  controllo del 2026-07-24 risulta pubblico, quindi `data/`, `snapshots/` e
  `reports/` sono leggibili da chiunque. La decisione sul runtime resta valida,
  ma l'assunzione di riservatezza degli output no: vedi la voce aperta in
  `docs/BACKLOG.md`.
- Deploy/release: non servono VPS, tag o release per far girare il monitor;
  eventuali tag/GitHub Release riguardano solo release del tool o della
  dashboard secondo ADR 0003.
- Documentazione: README, AGENTS e `docs/TOOLCHAIN.md` devono descrivere questa
  semantica.

## Conseguenze operative

- Configurare e mantenere i secret email nel repository GitHub.
- Controllare i run GitHub Actions dopo modifiche a config, workflow, email o
  crawling.
- Non cancellare `data/`, `snapshots/` e `reports/` come se fossero cache locali.

## Verifiche

- `npm test`
- `npm run build`
- `gh run list --limit 10`

## Collegamenti

- Roadmap: `docs/ROADMAP.md`
- Toolchain: `docs/TOOLCHAIN.md`
- Workflow: `.github/workflows/sentinel.yml`
