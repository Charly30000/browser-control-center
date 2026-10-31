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

1. Ejecuta `npm.cmd version patch --no-git-tag-version` para una corrección o `npm.cmd version minor --no-git-tag-version` para una versión menor. También puedes indicar una versión exacta en lugar de `patch` o `minor`. El comando actualiza `package.json` y las dos versiones del paquete raíz en `package-lock.json`, sin crear un commit ni una etiqueta. El lockfile es un registro derivado, no otra fuente de configuración.
2. Agrupa los cambios correspondientes bajo `## <versión>` en `CHANGELOG.md`.
3. Genera el VSIX con los comandos de la siguiente sección. El empaquetado incluye la verificación de tipos, pruebas, lint y compilación, además de la coherencia del manifiesto, el lockfile, el changelog y los ejemplos para IA; no necesitas ejecutar `verify` aparte.

Las versiones de dependencias del lockfile pertenecen a esas dependencias. Las versiones históricas del changelog, las pruebas de compatibilidad y los documentos que haya guardado el usuario se conservan. En particular, importar un archivo no sustituye su `extensionVersion` de origen por la versión actual; una exportación nueva sí indica la versión que la genera.

`schemaVersion`, `bundleVersion` y las versiones de metadatos o preferencias describen sus propios formatos y no se igualan a la versión de la extensión. Un cambio del formato persistido requiere su incremento y migración según [Migraciones](migrations.md); un cambio de publicación por sí solo no modifica los esquemas ni los datos guardados.

## Generar el VSIX desde PowerShell

Abre una terminal en la raíz del proyecto, donde está `package.json`, y ejecuta:

```powershell
$env:BCC_REAL_BROWSER_TESTS = '1'
npm.cmd run package
```

La variable incluye las pruebas con Chrome instalado. `npm.cmd` evita los bloqueos que puede aplicar PowerShell al script `npm.ps1`. El comando ejecuta automáticamente la verificación completa y, si termina correctamente, crea `browser-control-center-<versión>.vsix` en la raíz. El nombre y la versión se toman de `package.json`. Ese es el archivo que puedes subir al Marketplace; este comando no lo publica.

Si solo quieres regenerar el paquete de la versión actual, basta con esos dos comandos. Para preparar el siguiente parche, ejecuta primero:

```powershell
npm.cmd version patch --no-git-tag-version
```

Actualiza después la entrada de `CHANGELOG.md` para esa versión y ejecuta los dos comandos de empaquetado anteriores. Usa `minor` en lugar de `patch` para una versión menor, o escribe una versión exacta si quieres fijarla expresamente. No es necesario cambiar a mano la versión del lockfile.

## Compatibilidad al actualizar

La identidad publicada es `Leviax.browser-control-center`: conserva `publisher` y `name` al publicar actualizaciones para mantener el almacenamiento asociado. Cambia únicamente la versión cuando prepares un nuevo VSIX. Los ajustes de Manual sobre filas minimizadas, aplicación por lotes y protección de formularios mantienen el esquema de perfiles v2 y las claves/rutas de persistencia existentes, sin borrar ni recrear los perfiles y recursos. Guarda los borradores antes de actualizar; las sesiones de navegador no son persistentes.

## Validación

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

`npm.cmd run verify` ejecuta todas esas comprobaciones sin generar un VSIX. `npm.cmd run package` llama a `vsce package`, que ejecuta automáticamente `vscode:prepublish` y, por tanto, la verificación completa. Durante el desarrollo puedes usar `verify`; reserva `package` para cuando necesites generar un archivo instalable.

Antes de publicar se debe inspeccionar el listado del VSIX y confirmar que contiene `dist`, manifiesto, README, LICENSE, CHANGELOG, avisos, recursos y `playwright-core`; no debe contener `docs`, Chromium, perfiles `.codex-*`, fuentes, tests, mapas, caches, fixtures, reportes o temporales.

La documentación del repositorio permanece en GitHub y no se incluye en el VSIX. Los enlaces relativos del README se convierten en enlaces al repositorio al empaquetar. La página Documentación para IA utiliza su contenido compilado en `dist/aiDocumentation.js`, sin leer archivos de `docs` durante la ejecución.

Las capturas del README están en `docs/screenshots/` y no se incluyen en el VSIX. Antes de publicar, sube también esas imágenes y el README a GitHub para que sus enlaces funcionen en Marketplace. Sus criterios de tamaño y contenido se describen en [Capturas para el README](screenshots/README.md); no se mantienen scripts auxiliares de captura.

`vsce ls --tree` permite inspeccionar el contenido sin generar el VSIX. `playwright-core` se conserva completo porque carga recursos internos de forma dinámica; contiene librería y herramientas de soporte, pero no ejecutables de Chromium.

El manifiesto incluye los enlaces de repositorio, homepage y bugs de GitHub y el icono de Marketplace `resources/marketplace-icon.png` (256 × 256). El icono SVG de la barra lateral se conserva por separado.
