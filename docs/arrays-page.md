# Página Arrays

## Modelo y validación

Cada array global contiene ID estable, nombre único, elementos JSON, fechas y versión de esquema. El texto del editor debe ser JSON válido y su raíz debe ser un array. Los elementos pueden ser strings, números finitos, booleanos, `null`, arrays u objetos JSON.

No se evalúa JavaScript. La validación usa exclusivamente `JSON.parse` y comprobación recursiva de valores JSON.

## Generación

`ArrayValueGenerator` recibe una fuente aleatoria inyectable. Con elementos escoge un índice aleatorio; con un array vacío devuelve `undefined`, que la UI presenta como “Sin resultado”. Este servicio puro puede reutilizarse desde Manual y Automatizaciones.

El botón **Probar** valida y utiliza el JSON que se encuentra actualmente en el editor, aunque todavía no se haya guardado. Selecciona un elemento mediante el mismo `ArrayValueGenerator` utilizado por el resto de la aplicación y muestra su tipo y valor. Cada pulsación realiza una selección nueva; un array vacío muestra **Sin resultado**.

## Persistencia y acciones

Los arrays se guardan individualmente en `globalStorageUri/arrays`, mientras `globalState` conserva catálogo y selección. Validar no guarda; Guardar solo se habilita con contenido válido. Exportar utiliza el contenido actual validado del editor.

Los documentos de importación/exportación usan el envelope común con `format`, `schemaVersion`, `extensionVersion`, `exportedAt` y `data`. Antes de guardar se validan todos los arrays del archivo. Si coincide el ID o el nombre, se regeneran ambos y nunca se sustituye el array existente.
