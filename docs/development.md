# Desarrollo

## Requisitos

- Node.js 20.19+, 22.13+ o una versión compatible posterior.
- npm.
- Visual Studio Code 1.90 o posterior.

Node 22.7 permite ejecutar el proyecto, pero npm avisa de que una dependencia transitiva de ESLint no declara soporte para ese minor. Se recomienda actualizar Node dentro de la rama 22.

## Preparación

```powershell
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

## Ver la extensión

1. Abre la raíz del proyecto en VS Code.
2. Pulsa `F5` y selecciona **Ejecutar extensión**.
3. En la nueva ventana, abre **Browser Control** en la Activity Bar.
4. Pulsa **Gestionar Chromium**.
5. Pulsa **Instalar** y espera a la verificación.
6. Abre **Manual**, elige un viewport y pulsa **Iniciar** o introduce una URL y pulsa **Abrir**.

La primera descarga puede ocupar varios cientos de MB. No se utiliza Chrome o Edge del sistema.

`npm run dev` observa los siete puntos de entrada. Los cambios del Extension Host requieren recargar la ventana de desarrollo; para cambios de webview basta con reabrir su panel después de reconstruir.

## Datos locales

Dentro de `ExtensionContext.globalStorageUri` se crean:

```text
profiles/
formulas/
arrays/
automations/
browser/
  binaries/
  runtime/
  install.json
```

Usa la pantalla **Gestionar Chromium** para borrar o reinstalar el navegador. No borres manualmente carpetas globales.

## Publicación

Antes de publicar, comprueba el `publisher` de `package.json`. El paquete debe incluir `dist`, manifiesto, recursos, documentación, licencia y `node_modules/playwright-core`; nunca debe incluir `globalStorageUri` ni binarios de Chromium.
