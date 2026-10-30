import { introduction, jsonBlock, resourceReference, sessionReference } from "./common";
import { manualDocumentationExample } from "./examples";

export const manualDocumentation = (): string => `${introduction("Manual")}
## Utilizar Manual

1. Selecciona un perfil o pulsa Nuevo y ponle nombre. Guarda el perfil para conservar la configuración. Nuevo no crea por sí solo una sesión de navegador.
2. Configura el viewport antes de Iniciar. Iniciar crea una sesión limpia; Abrir inicia si hace falta y navega a la URL compuesta con los query params. Si cambias el viewport de una sesión abierta, usa Aplicar con reinicio limpio; se perderá el estado de la sesión actual.
3. Los botones de pestaña cambian la página activa. Headers y cookies afectan al contexto; storage y campos se aplican sobre la página activa.
4. Editar o Guardar el perfil no aplica automáticamente todos los headers, cookies, storage o campos. Usa Aplicar por fila o Aplicar todos en la sección correspondiente. Para modificar solicitudes posteriores, aplica headers/overrides antes de navegar o vuelve a provocar la petición. Los overrides se sincronizan también cuando cambia su configuración con la sesión abierta.
5. Navega antes de aplicar storage, campos o cookies sin dominio. Abre la web, selecciona cada destino y usa Generar muestra para comprobar el origen del valor antes de Aplicar.
6. Resetear en la sección de campos restaura los valores capturados antes de aplicar durante la sesión actual; no equivale a limpiar el perfil ni el navegador.
7. Detener intenta cerrar normalmente, Forzar cierre termina un navegador que no responde y Reinicio limpio crea una sesión nueva sin cookies/storage previos. Guardar mantiene la configuración del perfil, no una sesión de autenticación viva.
8. Importar/Exportar transporta el perfil y sus recursos referenciados. Ver JSON permite editar el paquete sin archivo. Aplicar cambios conserva profile.id, carga el borrador y exige Guardar después para persistirlo. Las fórmulas se reutilizan por código equivalente y los arrays por contenido equivalente al resolver el paquete.

## Aplicar sin automatismos

- Inputs / Generadores, Cookies y Request Overrides muestran un único Aplicar por fila. Expandida: en la zona de acciones. Minimizada: junto al resumen. No necesitas expandirla para aplicar.
- Los inputs solo se rellenan al pulsar Aplicar o Aplicar todos. Cargar, editar, seleccionar, importar o guardar el perfil, recibir estados del navegador, iniciar/reiniciar o navegar no dispara los generadores. Generar muestra solo muestra un resultado; Resetear restaura los originales mediante una acción explícita.
- Aplicar todos intenta cada fila activa por orden, aunque otra falle al generar o escribir. Un aviso final indica cuántos campos se aplicaron y cuáles fallaron. No deshace los campos correctos ni borra la configuración de los fallidos. Los arrays vacíos y las fórmulas que devuelven undefined se consideran sin resultado y no vacían el input.
- Si el selector no encuentra el elemento, esa fila falla sin quedar esperando su aparición para rellenarla más tarde. Navega a la página correcta y pulsa Aplicar de nuevo cuando el elemento esté listo. Los errores no se corrigen ejecutando el formulario automáticamente.
- La escritura de Manual bloquea temporalmente los envíos de formulario durante la aplicación, incluidos submit/requestSubmit y Enter fuera de un textarea. Al terminar se puede enviar manualmente mediante el botón o teclado de la página. Los textarea pueden contener saltos de línea.
- Actualizar la extensión manteniendo su identidad conserva los perfiles y recursos guardados. Estas mejoras no cambian el esquema de perfil v2 ni requieren migrar los JSON existentes. Guarda los borradores antes de actualizar; no se conserva una sesión viva del navegador.

## Forma del documento Manual

format: browser-control-center/manual-profile.
data: {bundleVersion:1, profile:{...}, formulas:[...], arrays:[...]}.
profile: {schemaVersion:2, id, name, url, queryParams, headers, cookies, localStorage, sessionStorage, requestOverrides, generatorBindings, viewport, createdAt, updatedAt}.
Todas las colecciones deben existir aunque sean []. id/name/url/fechas son strings. Mantén profile.id al editar Ver JSON. No confundas profile.schemaVersion:2 con schemaVersion:1 del documento exterior.

## Campos y generadores de Manual

Cada generatorBinding es {id, generatorType, selector, propertyKind, propertyName, min, max, resourceId, literalValue, inputMode, delayMs, enabled}.
- generatorType: string (texto fijo, usa literalValue), firstName, lastName, email, phone, number, dni, nie, cif, formula o array.
- selector: CSS del destino. propertyKind: value, textContent, innerText, checked, attribute o property. Para attribute/property, propertyName indica el nombre (ej. data-id). Para las demás propiedades puede ser "".
- value rellena input/textarea. checked modifica un checkbox; usa una fórmula/array que devuelva un booleano o texto fijo "true"/"false". No se selecciona una opción de un select mediante fill: si necesitas modificar su propiedad value usa propertyKind property y propertyName value, o un flujo de clicks en Automatizaciones.
- min/max son strings numéricos para number (incluye decimales si quieres esa precisión); min debe ser menor o igual que max. Los generadores numéricos integrados producen texto. Para otros generadores conserva por ejemplo min "0", max "100".
- resourceId es null para generadores integrados; formula/array requiere el ID de un recurso del catálogo o del paquete portátil. No lo sustituyas por el nombre.
- literalValue es el texto fijo. inputMode instant escribe de una vez y sequential simula teclas con delayMs numérico ≥0; se usa en propertyKind value. enabled desactiva una fila sin borrarla.
- Manual no interpola automáticamente variables de Automatizaciones: escribir {itemId} aquí es texto literal. Sus fórmulas tampoco reciben el perfil como parámetro.

${sessionReference}
${resourceReference}
## Ejemplo completo: página local con nombre, email y ciudad

El documento instala una página mediante un override: no necesita un servidor ni acceso a Internet. Importa el documento como archivo o adapta profile.id al de Ver JSON. Guarda, inicia la sesión, aplica los overrides si aún no se han sincronizado, pulsa Abrir y después Aplicar todos en la sección de campos/generadores. El nombre será Ada; email y ciudad se generan desde los recursos incluidos.
${jsonBlock(manualDocumentationExample)}
## Si pido ayuda con mi caso

Solicita la URL base, los parámetros, el JSON actual de Ver JSON y los selectores de destino. Aclara si necesito aplicar valores una vez (Manual) o encadenar pasos con comprobaciones (Automatizaciones). Entrega el paquete completo conservando el ID de mi perfil, incluyendo los recursos nuevos referenciados y sin borrar secciones existentes salvo que lo pida.
`;
