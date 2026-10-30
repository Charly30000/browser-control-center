# Página Arrays

## Modelo y validación

Cada array global contiene ID estable, nombre único, elementos JSON, fechas y versión de esquema. El texto del editor debe ser JSON válido y su raíz debe ser un array. Los elementos pueden ser strings, números finitos, booleanos, `null`, arrays u objetos JSON.

No se evalúa JavaScript. La validación usa exclusivamente `JSON.parse` y comprobación recursiva de valores JSON.

## Generación

`ArrayValueGenerator` recibe una fuente aleatoria inyectable. Con elementos escoge un índice aleatorio; con un array vacío devuelve `undefined`, que la UI presenta como “Sin resultado”. Este servicio puro puede reutilizarse desde Manual y Automatizaciones.

El botón **Probar** valida y utiliza el JSON que se encuentra actualmente en el editor, aunque todavía no se haya guardado. Selecciona un elemento mediante el mismo `ArrayValueGenerator` utilizado por el resto de la aplicación y muestra su tipo y valor. Cada pulsación realiza una selección nueva; un array vacío muestra **Sin resultado**.

## Persistencia y acciones

El interruptor **Guardado automático** aparece arriba del todo, antes del título. Está desactivado por defecto y guarda el array actual tras **5 segundos sin actividad**, reiniciando la espera con cada interacción. No guarda contenido JSON inválido ni ejecuta Probar. Conserva las ediciones realizadas mientras se guarda; un fallo mantiene el borrador. Se pausa mientras se edita Ver JSON o se decide si guardar los cambios antes de cambiar de recurso.

La preferencia de cada array se conserva en su JSON como `preferences: { "autoSaveEnabled": true }` o con `false`. Si falta, permanece desactivado; los archivos anteriores siguen siendo válidos. Al desactivarlo se cancela la espera pendiente y hay que pulsar Guardar para persistir esa desactivación.

Los arrays se guardan individualmente en `globalStorageUri/arrays`, mientras `globalState` conserva catálogo y selección. Validar no guarda; Guardar solo se habilita con contenido válido. Exportar utiliza el contenido actual validado del editor.

**Ver JSON** usa igualmente el contenido actual validado y muestra únicamente el array seleccionado. El JSON puede seleccionarse, copiarse y editarse. **Aplicar cambios** exige exactamente un array válido con el mismo ID y lo devuelve al editor como cambios sin guardar.

Los documentos de importación/exportación usan el envelope común con `format`, `schemaVersion`, `extensionVersion`, `exportedAt` y `data`. Antes de guardar se validan todos los arrays del archivo. Si coinciden el ID y todo el contenido serializado, se reutiliza el array existente. Si el ID coincide pero el contenido es distinto, o si únicamente colisiona el nombre, se generan un UUID y un nombre con sufijo nuevos; nunca se sustituye silenciosamente un array existente.
