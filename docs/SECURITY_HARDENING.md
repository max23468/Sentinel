# Hardening tecnico-operativo (2026-05-27)

## Rischio iniziale

- Livello: **medio**.
- Stato in questa ondata: **P1 con rafforzamento runtime**.
- Rotazione segreti: **non inclusa** in questa fase (escludendo ruotazioni preventive).

## Contesto operativo rilevante

- Tool di monitoraggio web con workflow schedulato e gestione report/snapshot.
- Superfici operative: scheduler, credenziali email, reporting e dashboard.

## Piano tecnico (P0/P1/P2)

### P1

- Spostare definitivamente env locali e segreti runtime fuori repo (solo in secret store/provider).
- Proteggere config/output con retention controllata e policy di retention esplicita.
- Verificare integrità credenziali email/webhook.
- Rafforzare scheduler: retry e gestione offline.
- Monitoraggio settimanale runtime su alert e code di esecuzione per ridurre tempo di reazione.

### P2

- Protezione di report/snapshot:
  - retention esplicita;
  - riduzione dati sensibili persistenti;
  - audit trimestrale degli output.
- Verificare periodicamente che output `snapshot/report` non includano token o payload inattesi.

## Piano operativo e di governo

### P1

- Continuare monitoraggio runtime schedulato post-esecuzione:
  - riconoscere differenza tra errore tecnico e variazione sito;
  - verificare stato alert e canale email fallback.
- Creare check operativo periodico su credenziali e integrazioni SMTP.

### P2

- Aggiornare runbook operativo con soglie esplicite di escalation.
- Eseguire review semestrale su webhook, accessi dashboard e retention.
