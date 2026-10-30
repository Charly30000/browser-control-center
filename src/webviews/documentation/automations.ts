import { introduction, jsonBlock, resourceReference, sessionReference } from "./common";
import { automationDocumentationExample, documentedNodes } from "./examples";

export const automationsDocumentation = (): string => `${introduction("Automatizaciones")}
## Utilizar Automatizaciones

1. Crea un grupo y un proceso/flujo dentro de él. Selecciona el proceso en el árbol. El grupo organiza procesos, no es un nodo ejecutable dentro de otro flujo.
2. Configura su nombre, viewport y variables iniciales (un objeto JSON). Arrastra/añade nodos desde la paleta, configura cada uno en el inspector y conecta su salida derecha con la entrada del siguiente.
3. El selector visual de elementos usa el navegador visible de Manual: abre allí una página equivalente, pulsa Seleccionar y captura el elemento. Al ejecutar el flujo usará una sesión limpia distinta, así que incluye Navigate y los pasos de acceso necesarios.
4. Ejecutar proceso recorre sus dependencias; ejecutar grupo intenta sus procesos secuencialmente, cada uno con navegador limpio y variables propias. No se comparte sesión con Manual ni entre procesos. Un fallo de nodo detiene ese proceso y omite sus nodos pendientes; los procesos posteriores del grupo sí se intentan.
5. Pausar actúa entre nodos; Reanudar continúa. Stop solicita cancelación/cierre normal; Force stop fuerza el cierre. Pause / Wait User mantiene una espera con Continuar, Reintentar o Detener tanto en VS Code como en la barra del navegador. Al terminar un proceso se cierra su navegador, salvo mientras está en una pausa manual.
6. Salida → Browser Automation informa del inicio, duración y fallo de cada nodo y del resumen de ejecución. Las cards muestran sus estados. Si falla un campo, comprueba selector, navegación previa, tipo del valor, disponibilidad de recursos y timeout.
7. Guardar/Ver JSON/Exportar admiten borradores con nodos incompletos. Ejecutar, Importar y Aplicar cambios de JSON necesitan configuraciones válidas. No ofrezcas un documento incompleto como listo para ejecutar.
8. Añadir ejemplo crea procesos autocontenidos sin Internet para las funciones de la aplicación, incluido Guardar dato, y un recorrido Todos concatenados. Añade un grupo nuevo sin reemplazar los existentes. Hay pausas manuales intencionadas que requieren Continuar.

## Dónde pegar el JSON y alcance de la edición

La lista lateral muestra cabeceras de Grupo con contador y procesos indentados con etiqueta Proceso y estado. Puedes renombrar cada grupo y proceso directamente en su campo de la lista o en los campos amplios Nombre del grupo / Nombre del proceso del editor. Al añadir un proceso, su nombre provisional queda seleccionado para escribir el definitivo. Guardar o el guardado automático conserva los nombres en el JSON; renombrar no cambia IDs ni ejecuta procesos.

Las asas de puntos permiten arrastrar grupos completos y ordenar procesos dentro de un grupo o moverlos a otro. Soltar un proceso sobre otro permite insertarlo antes/después según la línea indicadora; sobre una cabecera o el espacio de la lista de un grupo lo añade al final, también si está vacío o plegado. No se cambian IDs, nodos, conexiones ni variables. Alt+↑/↓ sobre un asa ordena con teclado dentro de su lista. La flecha de la cabecera pliega/despliega el grupo y conserva sus acciones visibles; no desactiva sus procesos. Añadir un proceso despliega su grupo para editar el nombre. El orden y la expansión se guardan con Guardar o guardado automático y viajan en el JSON; el orden de los procesos se respeta al ejecutar su grupo, pero arrastrar o plegar no ejecuta nada.

El interruptor Guardado automático está arriba del todo. Guarda el documento completo de grupos tras 5 segundos sin actividad; respeta las mismas validaciones de borrador que Guardar y no ejecuta ningún proceso. La preferencia del documento se incluye como preferences: {autoSaveEnabled: true|false}, también al exportar una selección. Aplicar un JSON de selección que incluya preferences actualiza esta preferencia; si no la incluye, conserva la actual. Importar añade grupos y conserva la preferencia del documento de destino.

Selecciona un grupo o un proceso y pulsa Ver JSON. Si seleccionas un proceso, data.groups debe tener exactamente un grupo con exactamente un proceso; si seleccionas un grupo, debe tener exactamente un grupo y puede contener varios procesos. La aplicación aplica el resultado sobre esa selección y conserva su identidad; otras selecciones no se reemplazan. Conviene conservar los IDs del documento copiado y mantener consistentes todas las conexiones. No pegues varios grupos en ese diálogo.
Aplicar cambios valida y devuelve al canvas como borrador; pulsa Guardar para persistirlo. Para añadir grupos nuevos en vez de reemplazar la selección, guarda el documento completo en un archivo y usa Importar. Los documentos de importación pueden tener varios grupos; las colisiones se resuelven sin sobrescrituras silenciosas. Exportar usa también el grupo/proceso seleccionado.

## Estructura JSON exacta

Puedes usar la rueda del ratón mientras sostienes el asa de un grupo o proceso para desplazar la página o la lista lateral; el indicador y el destino se actualizan con el scroll. Escape cancela sin modificar el orden. El guardado automático espera hasta soltar el elemento.

format: browser-control-center/automations; data es {schemaVersion:1, id, name, groups, createdAt, updatedAt}.
Cada grupo es {id, name, processes:[...]}.
Opcionalmente cada grupo incluye expanded booleano: true muestra su lista y false la pliega. Si falta, se muestra abierto; no cambies schemaVersion. Se conserva al importar/exportar y al guardar. Aplicar un JSON de grupo que no lo incluya conserva la preferencia actual.
Cada proceso es {id, name, viewport, nodes:[...], edges:[...], variables:{...}}.
Cada nodo es {id, type, position:{x,y}, config:{...}, timeoutMs:null}. x/y son números finitos para colocarlo en el canvas; timeoutMs null usa el valor predeterminado o indica milisegundos positivos. No cambies type por el título visible: Campo usa fill; Guardar dato usa capture-value.
Cada conexión es {id, sourceNodeId, sourcePort:"out", targetNodeId, targetPort:"in"}. Sus IDs de nodo deben existir en el mismo proceso. Usa IDs únicos para documento, grupos, procesos, nodos y conexiones. Incluye listas vacías donde corresponda, nombres no vacíos y fechas ISO. No agregues campos inventados para bucles, condiciones o funciones personalizadas: no existen nodos para ello.
El grafo no permite ciclos ni autoconexiones. La ejecución sigue dependencias y no dibuja un recorrido por sí sola: conecta todos los pasos que deban ser consecutivos. Entre ramas independientes, el orden se determina por la posición vertical/horizontal de los nodos, no por el orden del array nodes; evita depender de ese orden accidental.

## Variables, captura de datos y tipos

- variables contiene los valores iniciales del proceso. Nombres válidos: letras A–Z/a–z o guion bajo inicial, seguidos de letras, dígitos o guion bajo. No uses espacios, guiones ni puntos; ej. itemId.
- Para guardar una variable escribe itemId sin llaves en el nombre de salida; para leerla usa {itemId} en un campo de configuración. Una cadena exactamente igual a {itemId} conserva el tipo JSON; en "ID: {itemId}" se interpola como texto. No uses sintaxis de plantillas con dólar ni acceso {usuario.id}: primero extrae la propiedad a otra variable.
- Set Variable guarda un valor, Extract Value lee el DOM y Guardar dato admite source dom o previous. Las variables se resuelven también dentro de listas/objetos de configuración. Referenciar una variable inexistente falla. No se persisten ni pasan al siguiente proceso.
- Guardar dato con source previous requiere exactamente un predecesor conectado que produzca datos. Producen datos Campo (valor escrito), Extract Value, Set Variable, Guardar dato, Generate Value y Wait de tipo response. Click, Navigate, validaciones y otras esperas no ofrecen una salida de datos. No obtiene automáticamente la respuesta HTTP causada por un Click.
- Para capturar un input: source dom, selector #name, property value, path "", valueType string y outputVariable savedName. Para texto visible usa innerText; texto completo textContent; atributo usa property attribute y attribute con su nombre. Puedes leer value de input, textarea y select, aunque Campo escribe mediante fill y no selecciona opciones de un select.
- Para JSON visible en #payload: source dom, property textContent, path item.id, valueType number. Para respuesta del nodo Wait: source previous y path body.item.id. Para guardar toda la salida usa path "".
- Las rutas usan puntos e índices de array, por ejemplo body.items.0.id; no JSONPath, $, corchetes ni comodines. Se puede recorrer texto JSON. Una ruta que no existe falla. Un atributo DOM inexistente devuelve null.
- valueType auto conserva el tipo (las lecturas DOM ordinarias son texto); string convierte a texto, number exige un número válido y no vacío, boolean admite true/false, json interpreta JSON completo, null admite un valor vacío o null. La ruta se aplica antes de convertir. Los arrays y objetos introducidos en un input se convierten en texto JSON.
- Para una respuesta de red, Wait response escucha respuestas futuras: coloca la espera de modo que ya esté activa cuando llegue la respuesta. Un Click que recibe su respuesta antes del siguiente Wait puede hacer que la espera venza. Si la respuesta ya llegó, Validate Data consulta observaciones para validarla, pero no las guarda en variables. No prometas que añadir una espera fija recuperará respuestas pasadas; puedes capturar el resultado del DOM o utilizar un ejemplo cuya respuesta tenga retraso controlado.
- Un Request Override modifica la respuesta de una petición real del navegador, pero no envía peticiones por sí solo. No hay un nodo de cliente HTTP independiente ni un nodo para ejecutar JavaScript arbitrario contra la página.

${sessionReference}
${resourceReference}
## Catálogo de nodos y configuración válida de referencia

Cada bloque siguiente es SOLO el objeto config del nodo indicado, no un documento para pegar en Ver JSON. Úsalo dentro de un nodo completo con su type. Para headers, cookies y storage, rellena entries con las filas descritas arriba. Modifica los ejemplos según la página real y mantén campos obligatorios aunque en un modo concreto no se utilicen.
${documentedNodes.map(({ type, usage, config }) => `\n### ${type}\n${usage}\n${jsonBlock(config)}`).join("\n")}
### Detalles de Validate Data

source request expone url, method, headers y body; response expone url, status, headers y body; cookie sus propiedades value, domain, path, expires, httpOnly, secure, sameSite; localStorage/sessionStorage el valor de la clave. Usa urlPattern para acotar la última request/response (solo se conservan las 200 más recientes de cada tipo). Para headers usa nombres en minúsculas, por ejemplo headers.content-type.
pathPreset custom utiliza path. Si eliges presets, request admite url, method, headers.content-type, headers.authorization o body; response url, status, headers.content-type o body; cookie las propiedades citadas; storage "" para el valor completo. Con preset distinto de custom, path no sustituye al preset.
expected siempre es string. equals compara representación textual; json-equals compara JSON sin depender del orden de claves; matches usa una expresión regular válida. exists/not-exists no necesitan expected y consideran ausente undefined o null. Una ruta personalizada de request/response puede ser body.usuario.id y parsea el body como JSON al recorrerla. Para comprobar JSON en storage usa key con la clave real y una ruta interna adecuada.

## Ejemplo completo listo para importar: captura de un campo y de JSON en el DOM

Este ejemplo instala una página HTML con Request Override antes de navegar, escribe Ada en #name, la captura como savedName, la copia a #copy y la comprueba. Después lee item.id del JSON de #payload como número, lo guarda en itemId, escribe "ID: 42" y lo comprueba. No necesita Internet, login ni recursos globales. Importa el archivo para añadir el grupo o pega el documento en Ver JSON sobre un grupo/proceso de destino y guarda. El navegador se cerrará al terminar; puedes añadir Pause / Wait User antes del final si quieres inspeccionarlo.
${jsonBlock(automationDocumentationExample)}
## Cómo elaborar mi flujo

Pídeme el JSON actual de la selección, el objetivo, la URL, los selectores y ejemplos de datos relevantes. Para cada referencia a Fórmula/Array solicita el ID del recurso guardado o prepara su documento separado y explica el orden de importación. Incluye preparación de sesión, navegación, esperas necesarias y comprobaciones útiles, no solo los pasos de relleno. Devuelve un documento completo válido para el alcance seleccionado y explica el destino de pegado y los requisitos externos pendientes.
`;
