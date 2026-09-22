# Modelo de seguridad de fórmulas

El código del usuario nunca se ejecuta en el Extension Host. Cada ejecución usa un proceso Chromium headless nuevo y desechable.

Controles aplicados:

1. contexto no persistente;
2. modo offline;
3. solicitudes HTTP abortadas;
4. WebSockets interceptados sin conexión;
5. Service Workers bloqueados;
6. ausencia de APIs de Node y VS Code;
7. salida limitada a JSON o `undefined`;
8. timeout duro de 2 segundos;
9. destrucción del proceso incluso ante error o bloqueo.

El código se carga mediante una etiqueta de script dentro de Chromium. No se usa `eval`, `new Function` ni `node:vm` como aislamiento.

Este límite protege el proceso de la extensión y bloquea red, pero la fórmula sí dispone de las APIs normales del entorno JavaScript del navegador durante su breve ejecución. No debe usarse para conservar secretos.
