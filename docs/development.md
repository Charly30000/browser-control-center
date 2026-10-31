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
4. Pulsa **Gestionar navegador**.
5. Selecciona **Google Chrome instalado** o instala **Chromium administrado** y espera a la verificación.
6. Abre **Manual**, elige un viewport y pulsa **Iniciar** o introduce una URL y pulsa **Abrir**.

La primera descarga de Chromium puede ocupar varios cientos de MB. Si se selecciona Chrome instalado, se usa su ejecutable con un contexto temporal y aislado, nunca con el perfil personal.

`npm run dev` observa los siete puntos de entrada. Los cambios del Extension Host requieren recargar la ventana de desarrollo; para cambios de webview basta con reabrir su panel después de reconstruir.

Los paneles mantienen su contexto mientras quedan ocultos para proteger borradores y evitar reconstrucciones innecesarias. Las transiciones internas muestran Guardar/Descartar/Cancelar. El API de VS Code no permite vetar el cierre explícito de un `WebviewPanel`, por lo que cerrar su pestaña descarta los cambios que no se hayan guardado.

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

Usa la pantalla **Gestionar navegador** para borrar o reinstalar Chromium o para seleccionar Chrome. No borres manualmente carpetas globales.

## Publicación

Antes de publicar, comprueba el `publisher` de `package.json`. El paquete debe incluir `dist`, manifiesto, recursos, documentación, licencia y `node_modules/playwright-core`; nunca debe incluir `globalStorageUri` ni binarios de Chromium.

## Definition of Done

Todo cambio funcional, de contrato, persistencia, navegador, seguridad, UI o release debe actualizar en el mismo cambio:

- las pruebas unitarias o de integración afectadas;
- la guía funcional correspondiente en `docs`;
- la documentación copiable para IA y sus ejemplos cuando cambien opciones, pasos, valores predeterminados o JSON aceptado; consulta [su guía de mantenimiento](ai-documentation.md#mantenimiento-de-la-documentación);
- el README solo cuando cambien de forma importante su presentación, funciones principales, instalación, primeros pasos o enlaces, o alguna afirmación deje de ser correcta; mantén coherentes sus secciones inglesa y española. Su objetivo es presentar la aplicación y favorecer su adopción; los detalles de uso se actualizan en `docs` y en la documentación para IA;
- `architecture.md` o un ADR cuando cambien límites entre capas;
- `CHANGELOG.md` cuando el cambio sea visible para el usuario;
- `release.md` cuando afecte al paquete o al Marketplace.

Una tarea no se considera terminada si la documentación describe un comportamiento anterior al código.
