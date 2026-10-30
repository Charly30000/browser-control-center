import { introduction, jsonBlock, resourceReference } from "./common";
import { formulaDocumentationExample } from "./examples";

export const formulasDocumentation = (): string => `${introduction("Fórmulas")}
## Utilizar Fórmulas

1. Agregar crea una fórmula en el editor; elige un nombre único. El listado permite cambiar de fórmula y seleccionar varias para eliminar con confirmación.
2. En Código escribe JavaScript que declare function generate() sin parámetros. Puede ser async function generate(). No pegues aquí el documento JSON de importación: este campo contiene solo código JavaScript.
3. Generar ejemplo carga código de muestra en un borrador; no lo ejecuta ni lo guarda automáticamente.
4. Probar ejecuta el código actual aunque no se haya guardado y muestra valor, tipo y duración o el error. Guardar conserva la fórmula para que aparezca en los desplegables de Manual y Campo en Automatizaciones.
5. Exportar y Ver JSON contienen exactamente la fórmula seleccionada en una lista data de un elemento. Importar admite una lista de varias fórmulas. Eliminar una fórmula puede dejar referencias no disponibles en perfiles o flujos que la usaban.
6. Para pegar una respuesta de IA en Ver JSON conserva el id de la fórmula abierta; pulsa Aplicar cambios y después Guardar. Si solo necesitas código, pégalo en Código y prueba antes de guardar.
7. Arriba del todo tienes el interruptor Guardado automático. Es una preferencia de la fórmula actual y se incluye en su JSON como preferences: {autoSaveEnabled: true|false}. Guarda tras 5 segundos sin actividad, con las mismas validaciones de Guardar, y nunca ejecuta el código automáticamente. Si un guardado falla, conserva el código del editor para corregirlo.

## Contrato y límites de una fórmula

- Usa la declaración function generate() o async function generate(), sin parámetros. No basta una función flecha, no debe llamarse de otra forma y no se necesita export.
- Puede devolver valores JSON (string, number finito, boolean, object, array o null) o undefined. undefined indica Sin resultado; evita ese resultado si después vas a rellenar un campo.
- Se resuelven promesas. throw o una promesa rechazada produce un fallo. Una espera/loop superior a 2 segundos termina la ejecución aislada.
- Se ejecuta en una página headless desechable, sin red, requests ni WebSockets; no dispone de Node, require, filesystem, APIs VS Code, imports ni librerías externas.
- No recibe argumentos ni el contexto de una automatización. No puede consultar el DOM del navegador visible ni una respuesta HTTP de otra sesión; para ello utiliza Guardar dato en Automatizaciones.
- Para datos de prueba puedes usar Math.random(), Date, strings, listas y objetos JavaScript ordinarios. No devuelvas BigInt, funciones, ciclos, instancias que no sean representables como JSON ni números no finitos.
- Cada uso ejecuta generate de nuevo; no asumas estado compartido ni valores únicos. El origen de un Campo puede convertir el resultado JSON a texto al introducirlo.

${resourceReference}
## Documento completo para pegar en Ver JSON o importar

format: browser-control-center/formulas. data es una lista. Cada fórmula requiere schemaVersion:1, id, name, code, createdAt y updatedAt; code es un string con JavaScript y los saltos de línea escapados.
Para pegar en Ver JSON sustituye el ID de ejemplo por el de la fórmula abierta. Para crear una nueva desde un archivo, puedes usar un ID nuevo único.
${jsonBlock(formulaDocumentationExample)}
## Ejemplos de código para el editor Código (no documentos JSON)

Texto fijo: function generate() { return "Ada"; }
Número: function generate() { return Math.floor(Math.random() * 100) + 1; }
Checkbox: function generate() { return true; }
Objeto: function generate() { return {name:"Ada", role:"tester"}; }
Asíncrona sin red: async function generate() { return await Promise.resolve({ok:true}); }

## Usar la fórmula guardada

En Manual añade un campo/generador, elige Fórmula, selecciona el recurso y el elemento destino; Generar muestra comprueba el valor y Aplicar lo escribe. En Automatizaciones crea Campo, elige origen Fórmula, selecciona el recurso y el selector CSS. En JSON usa generatorType formula y resourceId con el ID real, no el nombre. Un perfil Manual portátil puede incluirla en data.formulas; un documento de automatización no importa fórmulas por sí solo.

Si quiero una fórmula adaptada, pregunta qué tipo debo recibir y qué restricciones debe cumplir el valor. Devuelve solo código para Código o el documento completo para Ver JSON, según lo solicitado. Para objetos almacenados como texto JSON en un input, aclara si debo devolver el objeto o un string JSON.
`;
