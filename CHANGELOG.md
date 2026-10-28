# Changelog

## Sin publicar

- Manual permite usar texto fijo como origen de un campo.
- Automatizaciones unifica `Fill` y la generación directa en el nodo visible `Campo`, manteniendo compatibilidad con `Generate Value` en flujos anteriores.
- Manual y Automatizaciones comparten editores estructurados para query params, headers, cookies, storage y request overrides.
- Guardar, Ver JSON y Exportar automatizaciones aceptan borradores con nodos incompletos; Run e Importar mantienen validación estricta.
- Las ejecuciones abren automáticamente Output; Manual registra el inicio y resultado de sus acciones y muestra Output ante fallos.

All notable changes to Browser Control Center are documented here.

## 0.4.0

- Added Manual profiles, reusable Formulas and Arrays.
- Added managed Chromium and isolated system Chrome providers.
- Added the visual Automations editor and execution engine.
- Added versioned import/export and editable JSON documents.
- Centralized application persistence through a typed DAO.
- Added progressive document-size protection, consistent dirty-state transitions and credential redaction.
- Hardened browser cleanup, CSP, keyboard canvas controls and High Contrast behavior.
