# ADR 009 — Motor de automatización desacoplado

## Decisión

Ejecutar los procesos en el Extension Host mediante `ProcessRunner`, `NodeRegistry` y el puerto `AutomationBrowserSession`. La webview solo edita documentos y recibe snapshots de estado.

## Motivo

Playwright, persistencia, cancelación y logs no deben depender del ciclo de vida del panel. Un registro único evita duplicar entre motor, paleta e inspector la definición de cada nodo.

## Consecuencias

Cada proceso obtiene un contexto de Chromium nuevo y lo cierra en `finally`. Los mensajes cruzan la frontera como datos serializables y se validan antes de usarse. El motor se prueba con sesiones falsas sin instalar ni abrir Chromium.
