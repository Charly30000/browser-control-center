import { introduction, jsonBlock, resourceReference } from "./common";
import { arrayDocumentationExample, documentationArray } from "./examples";

export const arraysDocumentation = (): string => `${introduction("Arrays")}
## Utilizar Arrays

1. Agregar crea un array; dale un nombre único. En Contenido JSON pega SOLO una lista JSON, por ejemplo ["Madrid","Sevilla"]. No pegues el documento con format y data en ese campo.
2. Validar comprueba el contenido y muestra el número de elementos; no guarda. El contenido debe tener raíz de array, no un objeto ni JavaScript.
3. Probar escoge un elemento aleatorio del contenido actual, aunque no esté guardado, y muestra valor y tipo. Cada pulsación hace una selección nueva.
4. Guardar requiere contenido válido y lo deja disponible en Manual y Automatizaciones. Exportar y Ver JSON usan el contenido actual validado; no dependen de haberlo guardado antes.
5. La lista lateral cambia el recurso activo; sus casillas permiten Eliminar seleccionados con confirmación. Eliminar puede dejar referencias no disponibles en perfiles o flujos.
6. En Ver JSON conserva el ID del array abierto y exactamente un recurso en data. Aplicar cambios carga el borrador; pulsa Guardar después. Importar desde archivo admite varios recursos.

## Valores aceptados y comportamiento

items puede contener strings, números finitos, true/false, null, objetos y listas JSON anidadas. No acepta comentarios, claves sin comillas, trailing commas, undefined, NaN, Infinity, funciones o código JavaScript. Puedes mezclar tipos, aunque para rellenar el mismo campo suele ser más útil una lista homogénea.
No hay ejecución de JavaScript. Un array no es un bucle ni una secuencia de pasos: cada uso toma UN elemento aleatorio, con posibilidad de repetir. Vacío devuelve Sin resultado; evita listas vacías si el valor se necesita para rellenar un campo.
Si necesitas crear valores nuevos, usa Fórmulas. Si necesitas una secuencia de acciones, usa Automatizaciones. Un objeto escogido se puede reutilizar como JSON, o extraer una propiedad de la salida de Campo con Guardar dato antes de utilizarla después.

${resourceReference}
## Opción A: contenido para el editor Contenido JSON
${jsonBlock(documentationArray.items)}
## Opción B: documento completo para Ver JSON o Importar

format: browser-control-center/arrays. data es una lista de recursos; cada recurso contiene schemaVersion:1, id, name, items, createdAt y updatedAt. items es una lista JSON real, no un string que contiene una lista. Para editar Ver JSON cambia el ID del ejemplo por el del array abierto; para importar uno nuevo usa un ID único.
${jsonBlock(arrayDocumentationExample)}
## Reutilizar el array

Guárdalo primero. En Manual crea un campo/generador, elige Array y selecciónalo; indica selector y propiedad y usa Generar muestra/Aplicar. En Automatizaciones usa Campo con generatorType array y resourceId igual al ID real. Si el elemento elegido es un objeto o lista, al escribirlo en un input se representa como JSON; si necesitas una propiedad, añade Guardar dato con source previous y path, por ejemplo usuario.email, y reutiliza la variable en otro Campo.
Manual exporta en data.arrays los arrays referenciados por el perfil. Automatizaciones conserva solo la referencia, así que hay que importar/guardar ese array por separado antes de ejecutar el flujo.

Si quiero datos adaptados, pregunta cuántos ejemplos y de qué tipo necesito, qué campos deben tener y si busco valores literales o generación dinámica. Devuelve solo la lista para Contenido JSON o el documento completo para Ver JSON/Importar, según el destino.
`;
