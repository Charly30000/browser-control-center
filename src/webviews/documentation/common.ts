import { CURRENT_EXTENSION_VERSION } from "../../domain/importExport/importExportDocument";

export const jsonBlock = (value: unknown): string => `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;

export const introduction = (area: string): string => `# Browser Control Center ${CURRENT_EXTENSION_VERSION} — ${area}: contexto de uso para una IA

Ayúdame a utilizar Browser Control Center dentro de Visual Studio Code. Esta guía describe funciones de usuario y los datos que acepta la aplicación. No necesito cambios en el código de la extensión.

QUÉ HACE LA APLICACIÓN
- Manual prepara una sesión de navegador y aplica valores a páginas web.
- Fórmulas guarda funciones JavaScript generadoras de datos. Arrays guarda listas JSON de las que se elige un elemento aleatorio. Son recursos globales reutilizables por Manual y Automatizaciones.
- Automatizaciones organiza grupos y procesos visuales con nodos conectados, variables, acciones y comprobaciones.
- En Gestionar navegador elige Chrome instalado o instala/verifica Chromium administrado. Manual y Automatizaciones necesitan un navegador disponible; las pruebas de Fórmulas también. Arrays no necesita navegador. Las sesiones son aisladas del perfil personal; cada proceso automatizado empieza limpio. Guardar una configuración no conserva las cookies de una sesión cerrada.

CÓMO DEBES AYUDARME
1. Identifica si quiero un perfil Manual, una fórmula, un array o una automatización y dónde voy a pegar el resultado.
2. Si voy a modificar algo existente, pídeme el documento de Ver JSON y conserva sus IDs donde corresponda. La guía es genérica y no incluye mi documento actual, mis selectores ni mi catálogo real de recursos.
3. Pide solo los datos que falten para ejecutar el caso: URL, selectores CSS reales, respuesta de ejemplo o IDs de recursos. No inventes selectores ni recursos como si estuvieran comprobados. Puedes ofrecer un ejemplo autocontenido claramente identificado.
4. Si solicito JSON para pegar, entrega un único documento JSON válido, sin comentarios, sin comas finales, sin puntos suspensivos y sin explicaciones dentro del JSON. Escapa saltos de línea, comillas y barras de strings. true/false y null no llevan comillas. Un campo que contiene código, storage o un body puede requerir JSON dentro de un string escapado.
5. Explica brevemente fuera del documento dónde pegarlo, qué botón pulsar y qué datos debo sustituir. No prometas que un flujo funciona contra una web cuyos selectores no conocemos.

PEGAR, IMPORTAR Y GUARDAR
- Si el documento no tiene una preferencia de guardado automático, se considera activado. Un autoSaveEnabled: false guardado se respeta; abrir o actualizar la extensión no lo vuelve a activar.
- Manual, Arrays, Fórmulas y Automatizaciones tienen un interruptor Guardado automático al principio de la pantalla, por encima del título. Activado por defecto; guarda cambios tras 5 segundos sin actividad y cada interacción reinicia la espera. No aplica campos, no prueba fórmulas y no ejecuta flujos.
- Solo cuenta la interacción con controles de la extensión: escribir o usar el teclado en un campo, pulsar botones u otros controles y arrastrar elementos. Mover el ratón, pasar sobre un campo, desplazar la página o pulsar el fondo no reinicia la espera. Durante un arrastre espera a que se termine antes de contar los 5 segundos.
- La preferencia viaja en el JSON como preferences: {autoSaveEnabled: true|false}, dentro de profile en Manual, de cada recurso de Arrays/Fórmulas y del documento de Automatizaciones. Es opcional: los documentos anteriores siguen siendo válidos. Al desactivarlo se cancela la espera pendiente; pulsa Guardar para persistir la desactivación. Se pausa mientras se edita Ver JSON o se decide qué hacer con cambios sin guardar; solo se guardan datos válidos. Un fallo conserva el borrador sin reintentos continuos, y la confirmación de un guardado conserva las ediciones posteriores a su envío.
- Ver JSON → sustituir el documento completo → Aplicar cambios → Guardar. Aplicar cambios carga un borrador; no equivale a ejecutar ni a guardar. No se pega una lista de nodos sueltos ni solo el campo data en Ver JSON.
- Importar abre un archivo .json; para contenido recibido por chat, guárdalo en un archivo o usa Ver JSON sobre un elemento creado/seleccionado previamente.
- Fórmulas y Arrays: Ver JSON representa exactamente un recurso dentro de data, que es una lista de longitud 1. Para importar un archivo sí puede contener varios recursos.
- Manual: data es un paquete con bundleVersion, profile, formulas y arrays. Automatizaciones: data es un documento con groups.
- Todos los documentos completos usan format, schemaVersion: 1, extensionVersion: "${CURRENT_EXTENSION_VERSION}", exportedAt (fecha ISO o null) y data. Las versiones de los objetos interiores son independientes: perfil Manual 2; paquete Manual 1; fórmula/array/documento de automatización 1.
- En perfiles Manual y recursos de Fórmulas/Arrays, Ver JSON exige conservar el ID del elemento abierto. Para usar uno de los ejemplos nuevos de esta guía, impórtalo como archivo o sustituye su ID por el del borrador abierto. Usa IDs únicos y nombres descriptivos. Importar resuelve colisiones sin sobrescribir silenciosamente; un mismo ID con contenido idéntico puede reutilizarse.
- Documentos hasta 100 MiB, con aviso al llegar al 80 %. Guardar/Descartar/Cancelar protege cambios al cambiar de selección; cerrar la pestaña puede perder un borrador. Exportar permite conservar una copia.
- Si una acción falla, consulta Salida → Browser Automation y comparte el mensaje relevante. Las ejecuciones automatizadas abren ese panel.
`;

export const sessionReference = `## Referencia de datos de sesión (Manual y nodos de sesión)

Cada fila tiene un id único y enabled booleano; las filas desactivadas no se aplican.
- Query param o header: {id, key, value, enabled}; key y value son strings. Los parámetros se construyen desde las filas activas: la query escrita dentro de la URL base se elimina y reemplaza. Para repetir una clave añade varias filas.
- Cookie: {id, name, value, domain, path, expires, secure, httpOnly, sameSite, enabled}. name/value/domain/path son strings, expires es null o una fecha ISO; secure/httpOnly son booleanos; sameSite es Strict, Lax o None. domain no lleva https:// ni ruta. Con dominio vacío se usa la URL activa y debe haberse navegado. path suele ser /. SameSite None suele requerir secure true.
- Storage: {id, key, value, valueType, enabled}. value SIEMPRE es string; valueType es string, number, boolean, json o null. Ejemplos: value "42" con number; "false" con boolean; "{\\"role\\":\\"tester\\"}" con json; "null" con null. Navega al origen antes de escribir storage. localStorage es del origen y sessionStorage también depende de la pestaña.
- Override: {id, matcherType, matcher, method, action, status, headers, body, contentType, enabled}. matcherType: exact, glob o regex; matcher es el patrón en texto; method: ANY, GET, POST, PUT, PATCH, DELETE, HEAD u OPTIONS. action fulfill responde con status entero 100–599, body string, contentType string y headers (filas de header); abort cancela; continue-modified deja continuar cambiando headers y body. Para interceptar una URL con query usa un glob adecuado o incluye la query en una coincidencia exacta. Instala las reglas antes de disparar la solicitud. Un body JSON se almacena como string escapado. Las reglas nuevas sustituyen la lista de reglas activa, no se acumulan como nodos independientes.
- Viewport: {preset, width, height, deviceScaleFactor, hasTouch, isMobile}. width/height son enteros positivos; escala positiva y los dos últimos booleanos. Presets: desktop (1920×1080), laptop (1366×768), tabletPortrait (768×1024), tabletLandscape (1024×768), mobilePortrait (390×844), mobileLandscape (844×390) o custom. Incluye todos los campos, incluso al elegir un preset. Para un tamaño propio usa custom.
- Selectores CSS: prioriza #id o atributos estables como [data-testid="email"]. Seleccionar captura un elemento del navegador visible de Manual; debe estar abierto. Escape cancela. Los selectores atraviesan Shadow DOM abierto; no asumas soporte para raíces cerradas o cualquier iframe. En Automatizaciones las lecturas y escrituras con selector usan la primera coincidencia.
`;

export const resourceReference = `## Recursos reutilizables

Fórmula: {schemaVersion:1, id, name, code, createdAt, updatedAt}. Array: {schemaVersion:1, id, name, items, createdAt, updatedAt}. IDs, nombres, código y fechas son strings; fechas en ISO; items es una lista de valores JSON. Los nombres de recursos guardados deben ser únicos sin distinguir mayúsculas ni espacios exteriores.
Una fórmula declara function generate() sin parámetros (también async). Devuelve texto, número finito, booleano, objeto/lista JSON, null o undefined. undefined representa ausencia de resultado y no sirve para rellenar un campo. Se ejecuta aislada sin red, Node ni APIs de VS Code y con timeout de 2 segundos: no lee el DOM de la página que estoy automatizando ni recibe variables del proceso. Usa Guardar dato para leer el DOM. No uses imports ni paquetes externos.
Un array contiene valores JSON y cada uso escoge uno al azar; no recorre la lista ni garantiza valores distintos. Vacío produce ausencia de resultado.
Manual puede transportar sus recursos dentro de formulas y arrays del paquete. Automatizaciones solo guarda resourceId: importa/guarda primero los recursos en sus pantallas y usa sus IDs reales; no añadas un catálogo inventado al documento de automatización.
`;
