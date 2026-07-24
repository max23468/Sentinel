# Backlog Sentinel

Il backlog raccoglie possibilità, debiti, bug e attività non ancora promosse in
roadmap. Una voce nel backlog non è scope approvato.

## Idee prodotto

- Aggiungere nuovi siti monitorati solo con decisione dedicata su utilità,
  frequenza, destinatari email, rumore atteso e rispetto di `robots.txt`.
- Migliorare la leggibilità dei report se i cambiamenti reali diventano difficili
  da valutare manualmente.

## Backlog tecnico

- Definire una policy più esplicita di retention se `snapshots/` o `reports/`
  crescono troppo.
- Valutare un controllo automatico di dimensione repository se gli output
  applicativi crescono oltre una soglia pratica.
- Completare la coverage di `src/dashboard.ts` sui rami residui a basso rischio
  ma ancora non esercitati in test, in particolare fallback I/O (`reports/`
  assente), path output espliciti e alcuni empty state/render path secondari.

## Bug

- Nessun bug operativo aperto in questo documento.

## Debiti

- La policy release resta minimale: `package.json` indica `0.1.0`; tag e GitHub
  Release sono definiti da ADR 0003 solo per release del tool o della dashboard.
- Non esiste ancora un runbook esteso per diagnosi SMTP oltre ai secret GitHub e
  al Portachiavi macOS.

## Decisioni sospese

- Se mantenere solo Gmail come profilo operativo del workflow o promuovere iCloud
  a fallback documentato.
- Se continuare a committare snapshot in chiaro ora che il repository è pubblico.
  La policy dati ammette testo pubblico normalizzato inclusi i contatti
  pubblicati dai siti monitorati: era una scelta a basso rischio con repo
  privata, mentre ora quei contatti sono ripubblicati e indicizzabili. Opzioni:
  lasciare com'è, filtrare i contatti dal testo normalizzato prima del salvataggio,
  o tornare privati. Tocca il runtime, quindi va decisa prima di implementarla.

## Attività operative ricorrenti

- Controllare i run GitHub Actions dopo modifiche a configurazione, crawling,
  email o workflow.
- Verificare periodicamente che i secret email restino configurati e validi.
- Leggere i report generati prima di classificare cambiamenti come rumore o
  segnale reale.

## Regole

- Quando una voce diventa prioritaria, promuoverla in `docs/ROADMAP.md`.
- Quando una voce diventa decisione stabile, collegarla o spostarla in
  `docs/decisions/`.
- Non usare il backlog come storico dei lavori completati.
