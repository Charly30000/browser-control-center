# Fórmulas

Cambiar de fórmula no pide guardar si no has editado el recurso, incluido un borrador nuevo recién abierto. Un borrador sin editar muestra **Not saved yet** y no se guarda automáticamente solo por abrir la página o marcar casillas de selección. Al editar se activa la protección Guardar/Descartar/Cancelar; tras guardar, cambiar de fórmula vuelve a ser directo. Las ediciones realizadas durante un guardado siguen pendientes.

La lista **Mis fórmulas** muestra cuántas funciones tienes guardadas y destaca la que estás editando. Las casillas permiten seleccionar varias y muestran el total seleccionado para eliminarlas. El editor separa el nombre del código JavaScript y muestra el estado de guardado en su cabecera; los campos tienen más espacio para leer y escribir. **Agregar** es la acción principal de la cabecera.

El interruptor **Auto-save** está arriba del todo, antes del título. Es opcional y está activado por defecto. Guarda los cambios de la fórmula actual tras **5 segundos sin interactuar con controles**. Escribir, pulsar botones o arrastrar reinicia la espera; mover el ratón o hacer scroll no la reinicia, y durante un arrastre se espera a que termine. Usa las validaciones habituales de Guardar y nunca ejecuta la fórmula. Si falla, mantiene el código del editor; si se sigue editando durante un guardado, conserva esas ediciones.

La preferencia se incluye en el JSON de cada fórmula como `preferences: { "autoSaveEnabled": true }` o con `false`. Los documentos antiguos sin este campo siguen siendo válidos. Al desactivarlo cancela la espera; pulsa Guardar para conservar la desactivación. Se pausa al editar Ver JSON y durante las decisiones sobre cambios sin guardar.

Una fórmula declara `function generate()` sin parámetros. Puede devolver string, number, boolean, object, array, `null` o `undefined`, y puede ser asíncrona.

Cada prueba se ejecuta en un proceso headless desechable del navegador seleccionado. La sesión está offline, bloquea requests, WebSockets y service workers, y dispone de un timeout duro de dos segundos. Un timeout mata el proceso aislado, no el Extension Host.

El editor avisa al aproximarse al límite documental, conserva dirty state y ofrece Guardar/Descartar/Cancelar antes de cambiar de recurso. La ejecución no debe usarse para conservar credenciales. Véase [formula-sandbox.md](formula-sandbox.md).
