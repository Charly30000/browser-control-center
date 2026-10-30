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
8. Importar/Exportar transporta el perfil y sus recursos referenciados. Ver JSON permite editar el paquete sin archivo. Aplicar cambios conserva profile.id y carga el borrador; usa Guardar o el guardado automático para persistirlo. Las fórmulas se reutilizan por código equivalente y los arrays por contenido equivalente al resolver el paquete.
9. El interruptor Guardado automático está al principio de la pantalla, por encima del título. Se activa/desactiva por perfil y está desactivado por defecto. Activado, guarda los cambios tras 5 segundos sin actividad del usuario en Manual; cada nueva interacción reinicia la espera. No aplica datos al navegador. Si lo desactivas, pulsa Guardar para conservar esa desactivación. No guarda durante la edición de Ver JSON ni durante una decisión sobre cambios sin guardar. Al aplicar el JSON vuelve a programar el guardado. Los errores conservan el borrador, sin reintentos continuos; las ediciones durante un guardado no se sobrescriben.

## Aplicar sin automatismos

- Inputs / Generadores, Cookies y Request Overrides muestran un único Aplicar por fila. Expandida: en la zona de acciones. Minimizada: junto al resumen. No necesitas expandirla para aplicar.
- Las secciones tienen iconos y cabeceras diferenciadas con contadores de elementos. En Cookies, Request Overrides e Inputs / Generadores, Expandir todos y Contraer todos cambian únicamente las filas de ese grupo. La expansión individual y por grupo modifica la preferencia expanded de cada fila en el borrador, que se conserva al Guardar o mediante guardado automático y viaja en Ver JSON/Exportar/Importar. No aplica datos al navegador; los controles se deshabilitan cuando no hay filas.
- Puedes reordenar todas las filas con el asa de puntos: query params, headers, cookies, ambos storages, overrides, headers de cada override y generadores. Arrastra solo dentro de la misma lista; no se mueven las secciones ni se mezclan grupos. Alt+↑/↓ sobre el asa permite ordenar con teclado. Se conservan IDs, valores y el estado desplegado. El nuevo orden es un cambio del borrador: Guardar lo conserva y Ver JSON/Exportar lo reflejan. No se aplican datos al reordenar. Aplicar todos sigue el orden de los generadores; la primera regla de override activa que coincida tiene prioridad al aplicarlas.
- Los inputs solo se rellenan al pulsar Aplicar o Aplicar todos. Cargar, editar, seleccionar, importar o guardar el perfil, recibir estados del navegador, iniciar/reiniciar o navegar no dispara los generadores. Generar muestra solo muestra un resultado; Resetear restaura los originales mediante una acción explícita.
- Aplicar todos intenta cada fila activa por orden, aunque otra falle al generar o escribir. Un aviso final indica cuántos campos se aplicaron y cuáles fallaron. No deshace los campos correctos ni borra la configuración de los fallidos. Los arrays vacíos y las fórmulas que devuelven undefined se consideran sin resultado y no vacían el input.
- Las acciones de Inputs / Generadores muestran sus avisos en Manual sin abrir automáticamente el panel Salida, también al seleccionar un elemento, generar una muestra o resetear. El detalle sigue disponible en Salida → Browser Automation para consultarlo manualmente.
- Si el selector no encuentra el elemento, esa fila falla sin quedar esperando su aparición para rellenarla más tarde. Navega a la página correcta y pulsa Aplicar de nuevo cuando el elemento esté listo. Los errores no se corrigen ejecutando el formulario automáticamente.
- La escritura de Manual bloquea temporalmente los envíos de formulario durante la aplicación, incluidos submit/requestSubmit y Enter fuera de un textarea. Al terminar se puede enviar manualmente mediante el botón o teclado de la página. Los textarea pueden contener saltos de línea.
- Actualizar la extensión manteniendo su identidad conserva los perfiles y recursos guardados. Estas mejoras no cambian el esquema de perfil v2 ni requieren migrar los JSON existentes. Guarda los borradores antes de actualizar; no se conserva una sesión viva del navegador.

## Forma del documento Manual

Al reordenar filas puedes usar la rueda del ratón sin soltar el asa, tanto para desplazar la página como una lista con scroll. El destino se actualiza con el desplazamiento. Escape cancela el movimiento; el guardado automático espera hasta soltar el elemento.

format: browser-control-center/manual-profile.
data: {bundleVersion:1, profile:{...}, formulas:[...], arrays:[...]}.
profile: {schemaVersion:2, id, name, url, queryParams, headers, cookies, localStorage, sessionStorage, requestOverrides, generatorBindings, viewport, createdAt, updatedAt}.
Todas las colecciones deben existir aunque sean []. id/name/url/fechas son strings. Mantén profile.id al editar Ver JSON. No confundas profile.schemaVersion:2 con schemaVersion:1 del documento exterior.
Opcionalmente profile.preferences es {autoSaveEnabled: true|false}; si falta, el guardado automático está desactivado. Las filas de cookies, requestOverrides y generatorBindings admiten expanded: true|false para conservar su preferencia visual. Si falta, cookies empieza cerrado y overrides/generadores abiertos. Estas preferencias no cambian cómo se aplican los datos y no requieren cambiar schemaVersion.

## Campos y generadores de Manual

Cada generatorBinding es {id, generatorType, selector, propertyKind, propertyName, min, max, resourceId, literalValue, inputMode, delayMs, enabled}.
- generatorType: string (texto fijo, usa literalValue), firstName, lastName, email, phone, number, dni, nie, cif, formula o array.
- selector: CSS del destino. propertyKind: value, textContent, innerText, checked, attribute o property. Para attribute/property, propertyName indica el nombre (ej. data-id). Para las demás propiedades puede ser "".
- value rellena input/textarea. checked modifica un checkbox; usa una fórmula/array que devuelva un booleano o texto fijo "true"/"false". No se selecciona una opción de un select mediante fill: si necesitas modificar su propiedad value usa propertyKind property y propertyName value, o un flujo de clicks en Automatizaciones.
- min/max son strings numéricos para number (incluye decimales si quieres esa precisión); min debe ser menor o igual que max. Los generadores numéricos integrados producen texto. Para otros generadores conserva por ejemplo min "0", max "100".
- resourceId es null para generadores integrados; formula/array requiere el ID de un recurso del catálogo o del paquete portátil. No lo sustituyas por el nombre.
- literalValue es el texto fijo. inputMode instant escribe de una vez y sequential simula teclas con delayMs numérico ≥0; se usa en propertyKind value. enabled desactiva una fila sin borrarla.
- Manual no interpola automáticamente variables de Automatizaciones: escribir {itemId} aquí es texto literal. Sus fórmulas tampoco reciben el perfil como parámetro.
- Al elegir escritura secuencial, el retraso predeterminado es de 100 ms por tecla y puedes modificarlo. Cargar un perfil no cambia sus retrasos guardados; al alternar modos se conservan los valores personalizados distintos de cero.

${sessionReference}
${resourceReference}
## Ejemplo completo: página local con nombre, email y ciudad

El documento instala una página mediante un override: no necesita un servidor ni acceso a Internet. Importa el documento como archivo o adapta profile.id al de Ver JSON. Guarda, inicia la sesión, aplica los overrides si aún no se han sincronizado, pulsa Abrir y después Aplicar todos en la sección de campos/generadores. El nombre será Ada; email y ciudad se generan desde los recursos incluidos.
${jsonBlock(manualDocumentationExample)}
## Si pido ayuda con mi caso

Solicita la URL base, los parámetros, el JSON actual de Ver JSON y los selectores de destino. Aclara si necesito aplicar valores una vez (Manual) o encadenar pasos con comprobaciones (Automatizaciones). Entrega el paquete completo conservando el ID de mi perfil, incluyendo los recursos nuevos referenciados y sin borrar secciones existentes salvo que lo pida.
`;
