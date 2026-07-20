# 0004 - Dashboard su Vite invece di Next.js

Data: 2026-07-20

Stato: Accettata

## Contesto

La dashboard online decisa in
[0002](0002-dashboard-vercel-dinamica.md) era una piccola app Next.js su Vercel.
Next è stato scelto per comodità (UI + API + auth in un solo framework), ma per
questa superficie — una pagina che mostra un JSON dietro Basic Auth — è
sovradimensionato e introduce l'unico punto di rottura di manutenzione del
progetto: il build worker interno di Next non è compatibile con TypeScript 7 e
fa fallire i deploy dei bump Dependabot, senza che nulla nel nostro codice lo
possa risolvere.

Gli altri progetti dell'autore (GLM, Pratix, SyncBay) usano React + Vite, non
Next. Allineare Sentinel riduce superficie di rottura e attrito cognitivo.

## Decisione

Sostituire Next.js con **Vite + React** per l'UI e **Vercel Functions
standalone** per la parte server. Il merito di 0002 resta invariato: Vercel,
Vercel Blob privato, Basic Auth, dati dinamici a runtime.

Struttura:

- `index.html` + `web/main.tsx` montano l'UI (`web/dashboard-client.tsx`,
  invariata rispetto alla versione Next).
- `api/dashboard.ts` e `api/reports/[name].ts` sono Vercel Functions con firma
  web (`export function GET(request: Request)`), leggono da Vercel Blob privato.
- `middleware.ts` (Vercel Edge Middleware, `@vercel/functions`) applica la
  Basic Auth su tutto il sito, sostituendo `proxy.ts`.
- Build: `vite build` in `dist-web`; `vercel.json` usa `framework: "vite"`.
- La CLI (`build:cli`, motore di scansione) è del tutto invariata.

## Alternative considerate

- Restare su Next e ignorare il major di TypeScript in Dependabot: rimanda il
  problema senza risolverlo e mantiene Sentinel disallineato dagli altri
  progetti.
- SPA statica pura (modello GLM) senza funzioni: scartata perché servono Blob
  privato e Basic Auth lato server, impossibili in una pagina solo statica.

## Impatti

- Prodotto: nessuna variazione funzionale della dashboard.
- Tecnico: rimossa la dipendenza `next` e il suo build worker; stack web
  allineato agli altri progetti.
- Deploy/release: deploy Vercel invariato nel flusso; cambia solo il preset e
  l'output directory (`dist-web`).
- Documentazione: aggiornati `README.md`, `docs/TOOLCHAIN.md`, `docs/CONTEXT.md`
  e i path in `AGENTS.md`.

## Verifiche

- `npm test` (37/37), `npm run build` (cli + web), `tsc --noEmit`.
- `npm run quality:react-doctor` (gate `--fail-on error` verde).
- Deploy preview Vercel: pagina, Basic Auth (401/200) e `/api/dashboard`.

## Collegamenti

- Supera la scelta di framework di [0002](0002-dashboard-vercel-dinamica.md)
  (il resto di 0002 resta valido).
- Toolchain: `docs/TOOLCHAIN.md`
