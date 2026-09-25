# Dependencias

Existe un único `package.json` y un único lockfile en la raíz.

## Runtime

### `lit` — BSD-3-Clause

Motor de Web Components de las webviews. Se integra en cada bundle web.

### `playwright-core@1.62.1` — Apache-2.0

API y CLI oficial para controlar los navegadores seleccionables. Se fija una versión exacta porque cada versión requiere una revisión concreta de Chromium administrado. `playwright-core` también permite usar el canal estable de Chrome instalado, pero no contiene ejecutables ni descarga nada durante `npm install`.

Se descartaron `playwright` por incluir capacidades de instalación que no necesita el paquete, `puppeteer-core` por apartarse del motor requerido y una implementación CDP propia por su coste de mantenimiento.

## Desarrollo

- `typescript`: comprobación estricta sin emisión.
- `esbuild`: bundles del Extension Host y webviews.
- `@types/vscode` y `@types/node`: tipos del entorno.
- `vitest`: pruebas unitarias con dobles de Playwright.
- `eslint` y `typescript-eslint`: análisis estático sin formateo automático.

Las dependencias de desarrollo no se necesitan en el VSIX.

La Fase 4 no añade dependencias. El Flow Canvas está construido con Lit, SVG y Pointer Events sobre la infraestructura existente.
