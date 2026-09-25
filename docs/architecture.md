# Arquitectura

## Capas

```text
Webviews Lit
    │ mensajes discriminados y validados
Adaptadores de VS Code
    │
Servicios de aplicación / motor de automatización
    │
Dominio ◄──── Adaptadores de infraestructura
                  ├─ persistencia
                  └─ Playwright / proveedores de navegador
```

- `src/domain`: modelos, contratos, validación y lógica pura. No conoce VS Code, Lit ni Playwright.
- `src/application`: casos de uso de perfiles, recursos, generadores y acciones de navegador.
- `src/infrastructure`: persistencia, proveedores de navegador, instalación de Chromium, ciclo de vida, pestañas, red, picker y sandbox.
- `src/extension`: composición, comandos, paneles, diálogos y logging de VS Code.
- `src/webviews`: páginas Lit. Cada vista central vive en `pages/<Vista>` y los componentes reutilizables en `components`.

## Automatizaciones

El motor se diseñó antes que el canvas. `NodeRegistry` concentra metadatos, validación y ejecutor de cada tipo de nodo; la paleta y el inspector consumen descriptores derivados del mismo registro. `ProcessRunner` valida el grafo, calcula un orden topológico determinista, resuelve variables y ejecuta cada nodo con timeout y cancelación. `AutomationExecutionCoordinator` limita la ejecución a una tarea activa y encadena los procesos de un grupo.

El canvas de `pages/Automatizaciones/canvas` solo edita nodos y conexiones. Selección, viewport, conexiones, historial y portapapeles viven en clases separadas y no conocen Playwright. Añadir un nodo nuevo requiere ampliar el tipo de dominio, su configuración por defecto y registrar una `NodeDefinition`; no exige modificar el runner.

Los snapshots de ejecución emitidos por el Extension Host mantienen sincronizado el proceso visible en la webview. `Pause / Wait User` conserva como fuente de verdad `ExecutionControl`: tanto los mensajes de la webview como la barra temporal inyectada en Chromium resuelven la misma espera, evitando dos estados de pausa independientes.

## Navegador

`PlaywrightBrowserBridge` es la fachada que consume la aplicación. Delega responsabilidades en:

- `BrowserSelectionService`: selección persistente y resolución del proveedor activo;
- `providers/ManagedChromiumProvider`: adaptador del Chromium administrado;
- `providers/SystemChromeProvider`: detección de Google Chrome por su canal estable;
- `providers/BrowserBinaryManager`: instalación, detección, verificación y borrado seguro del Chromium administrado;
- `BrowserLifecycleManager`: estados y sesiones limpias;
- `BrowserPageRegistry`: IDs estables, pestaña activa y sincronización de URL/título;
- `RequestOverrideRouter`: matching y acciones de red;
- `ElementPickerService`: selección visual;
- `PlaywrightFormulaExecutionService`: proceso headless desechable para código de usuario.

La webview nunca importa ni llama a Playwright. Solo envía mensajes tipados al Extension Host.

## Sesiones y estado

El navegador visible usa `launchServer` para conservar una referencia capaz de realizar cierre normal o forzado. Cada inicio crea un `BrowserContext` no persistente nuevo y un directorio temporal de descargas. Nunca se pasa un perfil personal ni un `userDataDir`. Al detener o reiniciar se cierra el contexto, se termina el proceso y se elimina ese directorio.

Los estados son `stopped`, `starting`, `running`, `stopping` y `crashed`. Las operaciones se serializan para impedir carreras entre iniciar, detener y reiniciar.

## Persistencia

Los perfiles Manual usan `schemaVersion: 2`. Al cargar, los perfiles v1 se migran en memoria añadiendo el viewport completo y el modo de escritura de los generadores. Fórmulas, arrays y automatizaciones mantienen documentos versionados independientes. Las automatizaciones se guardan atómicamente en `automations/automation.json` y validan tanto estructura como semántica al guardar, importar o ejecutar.

Todo dato persistente de la aplicación atraviesa una única puerta de infraestructura: `VsCodeApplicationDataDao`. Este DAO concentra la creación de directorios, lectura UTF-8, escritura atómica, borrado seguro y acceso versionado a `globalState`. Expone colecciones tipadas para perfiles, fórmulas y arrays; un documento único para automatizaciones; y los estados de catálogo y selección. Los servicios dependen exclusivamente de los contratos definidos en `application/persistence/applicationDataDao.ts`, por lo que no conocen VS Code, rutas ni claves de almacenamiento.

Las rutas y claves siguen siendo las mismas que en versiones anteriores (`profiles`, `formulas`, `arrays`, `automations/automation.json` y las claves `*.v1` de `globalState`), de modo que la centralización no requiere migrar ni descartar datos existentes. Los serializadores permanecen separados por entidad porque contienen sus validaciones y migraciones de esquema, pero solo el DAO realiza operaciones de almacenamiento.

La frontera de importación y exportación está centralizada por capas: `domain/importExport` define el envelope, `application/importExport` valida documentos y resuelve identidades, y `extension/importExport` contiene únicamente los diálogos y acceso a archivos de VS Code. Las cuatro áreas exportan JSON con `format`, `schemaVersion`, `extensionVersion`, `exportedAt` y `data`. El formato identifica inequívocamente el tipo de contenido; la versión del envelope es distinta de la versión interna de perfiles, recursos o automatizaciones.

Al importar nunca se sobrescribe una entidad existente. Si coincide el ID o el nombre —comparado sin distinguir mayúsculas ni espacios exteriores— se regeneran ambos. En automatizaciones se añaden los grupos al documento actual y se reparan las referencias entre nodos y conexiones. Los archivos históricos sin envelope de Manual y Automatizaciones, y los envelopes anteriores de Fórmulas y Arrays sin `exportedAt`, siguen siendo legibles.

Los binarios no forman parte de la persistencia funcional: viven en `globalStorageUri/browser` y pueden eliminarse sin afectar perfiles o recursos.

Los archivos que el usuario selecciona mediante **Importar** o **Exportar** pasan por el servicio de documentos externos, no por el DAO persistente. Chromium, descargas y sesiones temporales también quedan fuera: son infraestructura de ejecución y tienen un ciclo de vida independiente de los datos de la aplicación.

## Empaquetado

esbuild genera el Extension Host y las webviews `manual`, `formulas`, `arrays`, `automations`, `browserManagement` y `sidebar`. `playwright-core` queda externo al bundle porque carga módulos y recursos propios dinámicamente; `.vscodeignore` incluye ese paquete y excluye el resto de `node_modules`.

El VSIX no incluye `globalStorageUri`, Chromium ni datos de sesión.
