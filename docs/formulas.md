# Fórmulas

Una fórmula declara `function generate()` sin parámetros. Puede devolver string, number, boolean, object, array, `null` o `undefined`, y puede ser asíncrona.

Cada prueba se ejecuta en un proceso headless desechable del navegador seleccionado. La sesión está offline, bloquea requests, WebSockets y service workers, y dispone de un timeout duro de dos segundos. Un timeout mata el proceso aislado, no el Extension Host.

El editor avisa al aproximarse al límite documental, conserva dirty state y ofrece Guardar/Descartar/Cancelar antes de cambiar de recurso. La ejecución no debe usarse para conservar credenciales. Véase [formula-sandbox.md](formula-sandbox.md).
