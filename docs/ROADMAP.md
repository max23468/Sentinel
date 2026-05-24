# Roadmap Sentinel

La roadmap descrive direzione, priorità e prossimi passi di Sentinel. Le idee
non ancora scelte stanno in `docs/BACKLOG.md`.

## Ora

- Mantenere Sentinel come monitor operativo GitHub Actions per Ortix e San Carlo
  Sviluppo.
- Usare i run GitHub Actions come segnale primario di salute: test, build, scan,
  commit output e invio email quando necessario.
- Preservare `data/`, `snapshots/` e `reports/` come output applicativi
  tracciabili, non come cache generica.

## Prossimo

- Osservare il prossimo run schedulato del sabato alle 09:00 Europe/Rome e
  distinguere errori tecnici, cambiamenti reali dei siti e rumore di crawling.
- Raffinare soglie, report o filtri solo dopo evidenza nei report generati.
- Creare una Codex feedback inbox solo se iniziano commenti PR ricorrenti o
  review automatizzate da tracciare.

## Più avanti

- Valutare nuovi siti monitorati solo con una decisione esplicita su utilità,
  frequenza, privacy, email e rumore atteso.
- Valutare una policy più formale di retention degli output se `snapshots/` o
  `reports/` crescono oltre il necessario.
- Valutare health report periodici separati se i monitor diventano più di pochi
  profili manualmente controllabili.

## Bloccato

- Nessun blocco operativo noto: gli ultimi run manuali GitHub Actions risultano
  verdi al 2026-05-24.

## Fatto recente

- Configurato workflow GitHub Actions schedulato e manuale.
- Configurati i monitor Ortix e San Carlo Sviluppo.
- Pubblicati output applicativi in `data/`, `snapshots/` e `reports/`.
- Risolto il run rosso iniziale legato ai secret email mancanti; i run manuali
  successivi sono verdi.
- Aggiunta baseline documentale Atlas e baseline GitHub minima.

## Regole

- La roadmap non è un changelog.
- La roadmap non è un dump di idee.
- Le idee non ancora scelte stanno in `docs/BACKLOG.md`.
- Le decisioni stabili stanno in `docs/decisions/`.
- Ogni voce deve indicare un prossimo passo operativo reale.
