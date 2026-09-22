# Desarrollo

## Requisitos

- Node.js 20.19+, 22.13+ o una versión posterior soportada por las herramientas de desarrollo. Node 22.7 ejecuta actualmente las comprobaciones, pero npm avisa de que una dependencia transitiva de ESLint no declara soporte para ese minor.
- npm.
- Visual Studio Code 1.90 o posterior.

## Preparación

Desde la raíz del proyecto:

```powershell
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

Solo existe un `package.json` y un `package-lock.json`, ambos en la raíz. No se utilizan workspaces ni gestores de monorepos.

## Extension Development Host (F5)

1. Abre la raíz del proyecto en VS Code.
2. Ejecuta `npm install` si todavía no existe `node_modules`.
3. Pulsa `F5` y selecciona **Ejecutar extensión** si VS Code lo solicita.
4. La tarea previa crea los bundles en `dist/`.
5. En la nueva ventana, abre el icono **Browser Control** de la Activity Bar.
6. Pulsa **Manual**, **Fórmulas** o **Arrays** para abrir el panel central correspondiente.

Durante el desarrollo se puede ejecutar `npm run dev`. esbuild observará el bundle de la extensión y las cuatro webviews. Tras un cambio en la extensión hay que recargar el Extension Development Host; los cambios de webview se ven al reabrir o recargar la vista.

## Scripts

- `npm run dev`: observa y reconstruye los cinco puntos de entrada.
- `npm run build`: crea bundles de producción con sourcemaps.
- `npm run typecheck`: valida todo el TypeScript sin emitir archivos.
- `npm test`: ejecuta las pruebas unitarias una vez.
- `npm run lint`: aplica el análisis estático a `src` y `test`.

No se ejecuta ningún navegador en esta fase. Los botones de navegador alcanzan el `StubBrowserBridge` y muestran de forma explícita que Playwright aún no está configurado.

## Datos locales

Los perfiles se guardan bajo `ExtensionContext.globalStorageUri/profiles`, las fórmulas bajo `formulas` y los arrays bajo `arrays`. Los catálogos y recursos seleccionados se guardan en `globalState` bajo claves versionadas. Para probar una instalación limpia, utiliza las herramientas de VS Code destinadas a limpiar el almacenamiento de la extensión; no borres rutas globales de forma manual.

## Publicación

Antes de publicar, sustituye el campo `publisher` de `package.json` si `andres` no coincide exactamente con el identificador de tu publisher en Visual Studio Marketplace. El paquete excluye fuentes, pruebas, sourcemaps y `node_modules` mediante `.vscodeignore`; Chromium no forma parte del artefacto.
