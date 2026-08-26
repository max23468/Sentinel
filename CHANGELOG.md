# Changelog

Le modifiche versionate di Sentinel seguono Keep a Changelog e Semantic
Versioning. Gli output operativi in `data/`, `snapshots/` e `reports/` non sono
release del tool.

## [0.1.1] — 2026-08-26

### Sotto il cofano

- Il typecheck e il build CLI usano TypeScript nativo `7.0.2`; una bridge
  TypeScript 6 limitata al builder delle Vercel Functions mantiene pulito il
  deploy finché il provider non supporta il compilatore nativo.

