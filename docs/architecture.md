# Arquitectura

## Capas

```text
Webviews Lit
    │ mensajes discriminados y validados
Adaptadores de VS Code
    │
Servicios de aplicación
    │
Dominio ◄──── Adaptadores de infraestructura
                  ├─ persistencia
                  └─ Playwright / Chromium
```

- `src/domain`: modelos, contratos, validación y lógica pura. No conoce VS Code, Lit ni Playwright.
- `src/application`: casos de uso de perfiles, recursos, generadores y acciones de navegador.
- `src/infrastructure`: persistencia, instalación de Chromium, ciclo de vida, pestañas, red, picker y sandbox.
- `src/extension`: composición, comandos, paneles, diálogos y logging de VS Code.
- `src/webviews`: páginas Lit. Cada vista central vive en `pages/<Vista>` y los componentes reutilizables en `components`.

## Navegador

`PlaywrightBrowserBridge` es la fachada que consume la aplicación. Delega responsabilidades en:

- `BrowserBinaryManager`: instalación, detección, verificación y borrado seguro;
- `BrowserLifecycleManager`: estados y sesiones limpias;
- `BrowserPageRegistry`: IDs estables, pestaña activa y sincronización de URL/título;
- `RequestOverrideRouter`: matching y acciones de red;
- `ElementPickerService`: selección visual;
- `ChromiumFormulaExecutionService`: proceso headless desechable para código de usuario.

La webview nunca importa ni llama a Playwright. Solo envía mensajes tipados al Extension Host.

## Sesiones y estado

El navegador visible usa `launchServer` para conservar una referencia capaz de realizar cierre normal o forzado. Cada inicio crea un `BrowserContext` no persistente nuevo y un directorio temporal de descargas. Al detener o reiniciar se cierra el contexto, se termina el proceso y se elimina ese directorio.

Los estados son `stopped`, `starting`, `running`, `stopping` y `crashed`. Las operaciones se serializan para impedir carreras entre iniciar, detener y reiniciar.

## Persistencia

Los perfiles Manual usan `schemaVersion: 2`. Al cargar, los perfiles v1 se migran en memoria añadiendo el viewport completo y el modo de escritura de los generadores. Fórmulas y arrays mantienen sus documentos versionados independientes.

Los binarios no forman parte de la persistencia funcional: viven en `globalStorageUri/browser` y pueden eliminarse sin afectar perfiles o recursos.

## Empaquetado

esbuild genera el Extension Host y las webviews `manual`, `formulas`, `arrays`, `browserManagement` y `sidebar`. `playwright-core` queda externo al bundle porque carga módulos y recursos propios dinámicamente; `.vscodeignore` incluye ese paquete y excluye el resto de `node_modules`.

El VSIX no incluye `globalStorageUri`, Chromium ni datos de sesión.
