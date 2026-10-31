# Página Fórmulas

Cada fórmula declara `function generate()` sin parámetros y debe devolver JSON serializable o `undefined`.

## Ejecución

**Probar** crea un `BrowserServer` headless dedicado, un navegador y un contexto no persistente. Antes de insertar el código:

- activa modo offline;
- aborta solicitudes HTTP;
- intercepta WebSockets sin conectarlos;
- bloquea Service Workers;
- mantiene fuera las APIs de Node y VS Code.

El código se inserta como script en la página. No se usa `eval`, `new Function` ni `node:vm`. Un timeout de dos segundos mata el proceso completo, por lo que un bucle infinito no bloquea permanentemente el Extension Host.

El resultado muestra valor, tipo y duración. La sesión se destruye siempre, también después de errores o timeouts. Para probar fórmulas debe haber un navegador disponible en **Gestionar navegador**.

Manual utiliza el mismo `FormulaExecutionService`, evitando diferencias entre la muestra y el valor aplicado.

## Importación y exportación

Las fórmulas se exportan en el envelope JSON común y versionado. Antes de guardar se validan todas las fórmulas del archivo. Si coinciden el ID y todo el contenido guardado, se reutiliza la fórmula existente. Si el ID coincide pero el contenido difiere, o solo coincide el nombre, se generan un ID y un nombre nuevos; nunca se reemplaza silenciosamente la fórmula guardada. Los perfiles Manual portátiles también pueden reutilizar fórmulas por código equivalente.

**Ver JSON** muestra solo la fórmula seleccionada, aunque el envelope conserve el formato de colección usado por importación y exportación. Permite seleccionar, copiar y editar. Al aplicar debe contener exactamente una fórmula válida y conservar su ID; el cambio vuelve al editor como pendiente de guardar.
