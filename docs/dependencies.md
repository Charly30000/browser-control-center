# Dependencias

El proyecto mantiene deliberadamente una superficie pequeña de dependencias. Las versiones exactas resueltas quedan registradas en el único `package-lock.json` de la raíz.

## Runtime

### `lit` — BSD-3-Clause

Motor de Web Components requerido para las webviews. Se incluye dentro de los bundles `manual.js`, `formulas.js`, `arrays.js` y `sidebar.js`, de modo que el Extension Host no lo carga. Web Components nativos serían una alternativa más ligera, pero no cumplirían el requisito tecnológico del proyecto.

## Desarrollo

### `typescript` — Apache-2.0

Compilación estática en modo estricto. No se emite JavaScript mediante `tsc`; esbuild realiza el bundle.

### `esbuild` — MIT

Crea los tres artefactos de ejecución. Rollup o webpack permitirían el mismo resultado, pero añadirían configuración innecesaria para esta fase.

### `@types/vscode` y `@types/node` — MIT

Definen las APIs del Extension Host y Node. No forman parte del VSIX ejecutable.

### `vitest` — MIT

Ejecuta directamente las pruebas TypeScript. `node:test` evitaría esta dependencia, pero obligaría a mantener una compilación separada para pruebas.

### `eslint` y `typescript-eslint` — MIT

Aplican análisis estático al código TypeScript. No se utiliza un plugin de formato y el proyecto no ejecuta comandos automáticos de formateo.

## Dependencias excluidas intencionadamente

- Playwright y Chromium: pertenecen a una fase posterior y Chromium no se incluirá en el VSIX.
- React, React Flow y `@vscode/webview-ui-toolkit`: excluidos por requisitos del proyecto.
- Librerías de IDs, URL, validación o aleatoriedad: las APIs nativas y la lógica de dominio cubren esta fase.
- Gestores de monorepos: existe un único paquete publicable.
