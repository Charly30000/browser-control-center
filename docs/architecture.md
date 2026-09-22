# Arquitectura

## Objetivos

La arquitectura separa la interfaz, los casos de uso, el dominio, la persistencia y el futuro controlador de navegador. La lógica compartible no conoce Lit ni la API de VS Code.

```text
Webviews (Lit)
      │ mensajes discriminados
Extension adapters
      │
Application services
      │
Domain ◄──── Infrastructure adapters
```

## Capas

### `src/domain`

Contiene los modelos Manual, reglas de nombres, composición de URLs, validación de storage y overrides, dirty state, generadores y el contrato `BrowserBridge`. Es TypeScript puro y puede reutilizarse en automatizaciones futuras.

### `src/application`

Orquesta casos de uso sin decidir detalles visuales. `ManualProfileService` administra el ciclo de vida de los perfiles; `BrowserActionsService` valida y delega acciones en el bridge.

### `src/infrastructure`

Implementa puertos externos. `FileProfileRepository` usa `globalStorageUri`, `ProfileMetadataStore` limita `globalState` a metadatos y `StubBrowserBridge` declara el navegador como no disponible.

### `src/extension`

Es el adaptador de VS Code: activación, composición de dependencias, sidebar, panel, diálogos de importación/exportación y HTML seguro para webviews. `ManualPanelManager` conserva una única instancia del panel.

### `src/webviews`

Contiene UI Lit. Las páginas se centralizan en:

```text
pages/
├─ Manual/
├─ Formulas/
├─ Arrays/
└─ Automatizaciones/
```

`Manual`, `Fórmulas` y `Arrays` tienen implementación. `Automatizaciones` publica exclusivamente metadatos para el sidebar y delimita dónde vivirá su vista futura.

Los componentes reutilizables entre páginas viven en `webviews/components`. Los componentes exclusivos de una página viven en `pages/<Página>/components`.

## Mensajería

Cada dirección utiliza una unión discriminada. Los adaptadores validan los mensajes recibidos antes de ejecutar casos de uso. Los objetos de perfil se vuelven a validar con el serializador versionado, evitando `any` y dependencias implícitas entre UI y extensión.

## Seguridad de webviews

- `default-src 'none'`.
- Scripts permitidos únicamente mediante un nonce criptográfico.
- Estilos servidos desde recursos locales de la extensión.
- `localResourceRoots` restringido a `dist`.
- No se inyectan datos del usuario en el HTML inicial.

## Persistencia

El esquema actual es `schemaVersion: 1`. Cada perfil se serializa en `profiles/<uuid>.json`. La escritura utiliza un temporal y un rename para reducir el riesgo de archivos parciales. Los imports pasan por la misma validación del esquema y reciben ID y fechas nuevos.

Un perfil distingue tres conceptos:

- **draft**: copia editable en la webview;
- **saved**: última copia confirmada por persistencia;
- **enabled**: bandera runtime de cada entrada, independiente de que el perfil esté guardado.

`viewport` continúa como punto de extensión. Las referencias `resourceId` de fórmula/array ya resuelven catálogos globales por ID; una referencia cuyo recurso se haya eliminado se conserva y se muestra como no disponible.

## Build

esbuild produce un bundle CommonJS para el Extension Host y cuatro bundles de navegador: `manual`, `formulas`, `arrays` y `sidebar`. Lit queda dentro de los bundles de webview; `vscode` permanece externo al bundle de extensión. El VSIX no incluirá Chromium.

`.vscodeignore` limita el paquete publicable a los bundles, manifiesto, licencia, README y recursos necesarios. Código fuente, pruebas, configuración de desarrollo, sourcemaps y `node_modules` quedan fuera del VSIX.

## Extensión futura

La integración Playwright debe añadir otro adaptador de `BrowserBridge` y una implementación segura de `FormulaExecutionService`, sin modificar componentes Lit ni reglas del dominio. Automatizaciones podrán reutilizar fórmulas, arrays, modelos de selector, generadores y bridge sin importar código de Manual.
