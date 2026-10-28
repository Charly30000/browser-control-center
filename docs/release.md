# Release

## Requisitos

- Un solo `package.json` y `package-lock.json` en la raíz.
- Sin workspaces ni manifiestos en subcarpetas.
- Node compatible con las versiones declaradas por las herramientas.
- Publisher de Marketplace: `Leviax`.

## Validación

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

`npm run verify` ejecuta todas esas comprobaciones. `npm run package` llama a `vsce package`, que ejecuta automáticamente `vscode:prepublish` y, por tanto, la verificación completa. No debe ejecutarse durante desarrollo normal ni en esta preparación de Fase 5.

Antes de publicar se debe inspeccionar el listado del VSIX y confirmar que contiene `dist`, manifiesto, README, LICENSE, CHANGELOG, avisos, recursos y `playwright-core`; no debe contener `docs`, Chromium, perfiles `.codex-*`, fuentes, tests, mapas, caches, fixtures, reportes o temporales.

La documentación del repositorio permanece en GitHub y no se incluye en el VSIX. Los enlaces relativos del README se convierten en enlaces al repositorio al empaquetar. La página Documentación para IA utiliza su contenido compilado en `dist/aiDocumentation.js`, sin leer archivos de `docs` durante la ejecución.

`vsce ls --tree` permite inspeccionar el contenido sin generar el VSIX. `playwright-core` se conserva completo porque carga recursos internos de forma dinámica; contiene librería y herramientas de soporte, pero no ejecutables de Chromium.

El manifiesto incluye los enlaces de repositorio, homepage y bugs de GitHub y el icono de Marketplace `resources/marketplace-icon.png` (256 × 256). El icono SVG de la barra lateral se conserva por separado.
