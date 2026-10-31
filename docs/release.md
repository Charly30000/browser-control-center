# Release

## Requisitos

- Un solo `package.json` y `package-lock.json` en la raíz.
- Sin workspaces ni manifiestos en subcarpetas.
- Node compatible con las versiones declaradas por las herramientas.
- Publisher de Marketplace: `Leviax`.

La extensión requiere VS Code 1.90 o posterior. Los comandos y la vista lateral declarados en `contributes` activan la extensión automáticamente; no necesitan entradas `onCommand` ni `onView` en `activationEvents`, según la [documentación de VS Code](https://code.visualstudio.com/api/references/activation-events). La vista lateral declara su propio `icon` y reutiliza `resources/activity-bar-icon.svg`.

## Versión centralizada

La única fuente de la versión de la extensión es el campo `version` de `package.json`. Todo el código que necesite ese dato debe importar `CURRENT_EXTENSION_VERSION` desde `src/shared/extensionVersion.ts`, que lo obtiene del manifiesto; no se escriben versiones literales en componentes, servicios ni traducciones.

Este valor se usa en `extensionVersion` de las exportaciones de Manual, Fórmulas, Arrays y Automatizaciones, y en las introducciones y ejemplos JSON de Documentación para IA. VS Code y el empaquetado del VSIX leen el mismo manifiesto. Al compilar, esbuild incorpora el valor en los paquetes de la extensión y de las webviews; tras cambiarlo hay que generar una compilación nueva.

Para preparar una publicación:

1. Ejecuta `npm version patch --no-git-tag-version` para una corrección o `npm version minor --no-git-tag-version` para una versión menor. También puedes indicar una versión exacta en lugar de `patch` o `minor`. El comando actualiza `package.json` y las dos versiones del paquete raíz en `package-lock.json`, sin crear un commit ni una etiqueta. El lockfile es un registro derivado, no otra fuente de configuración.
2. Agrupa los cambios correspondientes bajo `## <versión>` en `CHANGELOG.md`.
3. Ejecuta `npm run verify` y después `npm run package` cuando quieras generar el VSIX. La verificación comprueba la coherencia del manifiesto, el lockfile y el changelog, además de las exportaciones y los ejemplos para IA.

Las versiones de dependencias del lockfile pertenecen a esas dependencias. Las versiones históricas del changelog, las pruebas de compatibilidad y los documentos que haya guardado el usuario se conservan. En particular, importar un archivo no sustituye su `extensionVersion` de origen por la versión actual; una exportación nueva sí indica la versión que la genera.

`schemaVersion`, `bundleVersion` y las versiones de metadatos o preferencias describen sus propios formatos y no se igualan a la versión de la extensión. Un cambio del formato persistido requiere su incremento y migración según [Migraciones](migrations.md); un cambio de publicación por sí solo no modifica los esquemas ni los datos guardados.

## Compatibilidad al actualizar

La identidad publicada es `Leviax.browser-control-center`: conserva `publisher` y `name` al publicar actualizaciones para mantener el almacenamiento asociado. Cambia únicamente la versión cuando prepares un nuevo VSIX. Los ajustes de Manual sobre filas minimizadas, aplicación por lotes y protección de formularios mantienen el esquema de perfiles v2 y las claves/rutas de persistencia existentes, sin borrar ni recrear los perfiles y recursos. Guarda los borradores antes de actualizar; las sesiones de navegador no son persistentes.

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
