# Motor de automatizaciones

`AutomationExecutionCoordinator` garantiza una única ejecución activa. `ProcessRunner` valida el grafo, calcula un orden topológico determinista y ejecuta cada nodo mediante la definición registrada en `NodeRegistry`.

Cada proceso obtiene una sesión nueva e independiente. Los nodos tienen timeout y comparten un `ExecutionControl` para pausa, reanudación, cancelación y parada forzada. La sesión siempre se cierra en `finally`; los errores marcan los nodos pendientes como omitidos y un grupo continúa con el proceso siguiente.

Las variables iniciales y generadas son valores JSON. Los snapshots emitidos por el motor mantienen visible el proceso en ejecución. `Pause / Wait User` usa el mismo control desde VS Code y desde la barra inyectada en la página.

Los logs se escriben en `Browser Automation`, se limpian y muestran una vez por ejecución y pasan por redacción de credenciales. El panel se abre antes de validar para que también sean visibles los errores que impiden iniciar el navegador. No se generan screenshots.
