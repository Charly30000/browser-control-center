# Página Automatizaciones

## Modelo

Una automatización contiene grupos; cada grupo contiene procesos. Un proceso posee viewport, variables iniciales, nodos y conexiones. Al ejecutar un grupo, sus procesos se recorren en orden y cada uno abre una sesión limpia e independiente del navegador seleccionado que siempre se cierra al terminar.

**Ver JSON** y **Exportar** comparten exactamente el mismo ámbito. Al seleccionar la cabecera de un grupo generan únicamente ese grupo con todos sus procesos; al seleccionar un proceso generan únicamente ese flujo dentro de su grupo. El nombre raíz y el nombre sugerido del archivo reflejan la selección. Al aplicar se validan el envelope, su versión, nodos, conexiones y configuraciones registradas, y solo se reinserta el grupo o flujo editado sin eliminar el resto del documento.

El editor también admite pegar el JSON de otro grupo o flujo recibido por chat. No es necesario modificar sus IDs a mano: se conserva el ID del elemento de destino, se ignoran los IDs raíz y contenedores externos, se regeneran los IDs internos que colisionen y se reparan los extremos de las conexiones cuando cambia el ID de un nodo. Los nombres que colisionen reciben un sufijo. El resultado queda pendiente de **Guardar**.

**Guardar**, **Ver JSON** y **Exportar** admiten borradores con campos de nodo todavía incompletos, siempre que la estructura, IDs, conexiones, viewport y variables sean seguros. La validación semántica estricta de cada configuración se aplica al ejecutar y al importar; así se puede conservar trabajo a medias sin permitir que un flujo inválido llegue al navegador.

El documento usa `schemaVersion: 1` y se guarda en `globalStorageUri/automations/automation.json`. La exportación usa el envelope JSON común y versionado. Un flujo exportado sigue siendo un documento válido con un grupo y un proceso, por lo que puede importarse sin un formato paralelo. La importación añade el contenido al documento actual en vez de reemplazarlo. Si un grupo o proceso coincide por ID o nombre, regenera ambos; los IDs de nodos y conexiones que colisionen también se regeneran y las conexiones se reparan para apuntar a los nodos importados correctos. Los archivos históricos con el documento directo siguen siendo compatibles.

## Editor

- El árbol izquierdo crea, renombra, mueve, copia, duplica y elimina grupos o procesos.
- La paleta añade nodos por categoría. Todos los nodos nuevos aparecen en la misma posición inicial `(80, 70)`; se superponen de forma intencionada para que el usuario decida su distribución en el canvas.
- El canvas permite arrastrar, conectar puertos, seleccionar con rectángulo, mover una selección, hacer pan con espacio o botón central y controlar el zoom con la rueda o los botones `−`, `100%` y `+`.
- `Ctrl/Cmd+C`, `Ctrl/Cmd+V` y `Ctrl/Cmd+D` copian, pegan y duplican nodos. `Supr` elimina; `Ctrl/Cmd+Z` y `Ctrl/Cmd+Y` controlan el historial.
- Las eliminaciones estructurales de grupos y procesos, junto con overrides y headers de overrides, piden confirmación mediante el diálogo modal de advertencia de VS Code, igual que en Manual. El diálogo indica los elementos dependientes que también desaparecerán y la operación solo continúa cuando el Extension Host devuelve una confirmación positiva a la webview.
- Los nodos y conexiones del canvas se eliminan directamente porque forman parte del historial de edición y pueden recuperarse con **Deshacer**. Una conexión seleccionada muestra su `×`; cada nodo seleccionado muestra también un botón `×`. `Supr` y `Backspace` continúan eliminando la selección completa.
- El inspector inferior edita nombre, timeout y configuración. Los campos JSON conservan el último valor válido si el texto todavía no se puede parsear.
- Los controles del inspector están vinculados al documento como valores controlados: al seleccionar otro nodo o guardar, inputs, checkboxes y desplegables vuelven a reflejar explícitamente la configuración persistida. El guardado conserva el grupo, proceso y nodo seleccionados mientras sigan existiendo.
- Los campos `Selector` incluyen el botón **Seleccionar**. Usa el navegador visible compartido con Manual: debe estar abierto, se pulsa el botón, se hace clic sobre el elemento de la página y el selector CSS resultante se guarda en el nodo.
- `Request Override` utiliza el mismo editor estructurado que Manual. Permite añadir varias reglas y configurar coincidencia exacta, glob o regex, método, acción, status, content type, body, headers y activación. Al ejecutar el nodo, sus reglas se instalan en la sesión independiente del proceso.

El viewport acepta presets o valores personalizados de ancho, alto, escala, modo táctil y modo móvil. Las variables iniciales son un objeto JSON.

### Interacciones del canvas

- La selección por marco se representa en una capa de pantalla independiente de la capa transformada del grafo. Esto mantiene un borde y un relleno visibles con cualquier nivel de zoom o desplazamiento.
- La selección transitoria permanece dentro del canvas durante el gesto y se comunica al inspector al soltar el puntero. Así el inspector no provoca cambios de layout mientras se arrastra.
- Una conexión comienza arrastrando el puerto de salida situado a la derecha de una card. Durante el gesto se muestra una línea provisional.
- El destino se detecta por geometría, con un margen constante en pantalla alrededor del puerto de entrada. También se acepta soltar dentro de la card de destino.
- La card y el puerto de entrada compatibles se resaltan antes de confirmar la conexión. No se permiten conexiones consigo mismo, duplicadas ni conexiones que creen un ciclo.
- Las conexiones son SVG reales. Una ruta transparente amplía su área interactiva sin engrosar visualmente la flecha.
- Al pulsar una conexión queda resaltada y aparece una `×` en su punto medio. La `×`, `Supr` o `Backspace` eliminan la conexión seleccionada.
- `pointercancel` descarta el gesto en curso y `pointerup` es el único punto que confirma la mutación del grafo.

## Variables y recursos

Los nodos pueden leer variables con `{nombre}` en cualquier nivel de su configuración. Si el texto completo es una variable, conserva su tipo JSON; dentro de una cadena se interpola como texto. `Extract Value` y `Set Variable` escriben variables para los nodos posteriores.

### Guardar un dato del nodo anterior o del DOM

**Guardar dato**, en la categoría **Datos**, permite elegir el **Origen del dato**: salida del nodo anterior o elemento del DOM. La **Ruta JSON opcional** permite seleccionar una propiedad anidada (`body.usuario.id`) o un índice de array (`body.items.0.id`). Una ruta vacía guarda el valor completo. También puede recorrer texto que contenga JSON.

Con origen **Elemento del DOM / campo de texto**, indica un selector CSS (puedes usar **Seleccionar**) y el **Tipo de lectura del elemento**:

- **Valor de campo**: lee `value` de un input, textarea o select.
- **Contenido de texto**: lee `textContent` del elemento.
- **Texto visible**: lee `innerText`.
- **Atributo del elemento**: lee el atributo indicado, por ejemplo `href`, `id` o `data-id`.

El **Tipo del dato guardado** permite conservar el tipo original o convertirlo a texto, número, booleano, JSON o null. Las lecturas DOM devuelven texto: para guardar `42` como número, selecciona **Número**; para interpretar un documento completo, selecciona **JSON**. El booleano admite `true` o `false`; una conversión inválida detiene el nodo sin guardar la variable. La ruta JSON se aplica antes de convertir el resultado. Los nodos antiguos que no incluyen estas opciones conservan el origen anterior y el tipo original.

Ejemplo de campo de texto: selecciona origen **Elemento del DOM**, selector `#name`, lectura **Valor de campo**, ruta vacía, tipo **Número** y variable `fieldNumber`. Si contiene `42`, otro nodo Campo puede escribir `Número leído: {fieldNumber}`. Para copiar un título, usa selector `h1`, lectura **Texto visible**, tipo **Texto** y variable `domTitle`; después utiliza `{domTitle}`. Para un elemento que contiene `{"item":{"id":42}}`, usa **Contenido de texto**, ruta `item.id` y tipo **Número**.

Producen salidas `Campo` (el valor escrito), `Extract Value` (el dato extraído), `Set Variable`, el antiguo `Generate Value` y el propio `Guardar dato`. `Wait` de tipo `response` produce `{ url, status, headers, body }` de la respuesta que acaba de esperar; `body` contiene el JSON parseado o el texto original. La espera debe comenzar antes de que llegue esa respuesta. Los otros tipos de `Wait` y los nodos de acciones o validaciones no producen datos.

Ejemplo: para una respuesta `{"item":{"id":42}}`, conecta **Wait (response) → Guardar dato → Campo**:

1. En `Wait`, selecciona `response`, indica la URL de la API y el status esperado.
2. En **Guardar dato**, escribe `body.item.id` como ruta e `itemId` como variable de salida, sin llaves.
3. En **Campo**, selecciona el campo destino, elige **Texto fijo** y escribe `{itemId}`. Se introducirá `42`.

**Añadir ejemplo** incluye el proceso **17 · Guardar dato**, que captura la respuesta HTTP, lee el valor del campo `#name` como número, el texto visible de `h1` y el atributo `id` del campo. Cada captura se reutiliza en Campo y se comprueba con Assertion. El proceso **Todos concatenados** también extrae `item.id` del JSON mostrado en `#api-result`, tanto desde la salida de `Extract Value` como leyendo directamente el DOM.

Con origen **Salida del nodo anterior**, la conexión determina el dato, aunque otra rama se haya ejecutado entre ambos nodos; requiere exactamente un predecesor que produzca datos. Con origen **DOM**, lee la página del navegador del proceso y no necesita que el predecesor produzca una salida. Un atributo inexistente devuelve `null`. Si falta el elemento o la ruta, o la conversión no es válida, el nodo falla con un mensaje explicativo. Las variables pertenecen a la ejecución del proceso y pueden reutilizarse después mediante `{itemId}`; no se persisten automáticamente entre ejecuciones.

El nodo visible **Campo** concentra la introducción de datos: el usuario selecciona el elemento y escoge texto fijo, un generador integrado, una fórmula o un array como origen. También permite escritura instantánea o secuencial. Internamente conserva el tipo `fill` para mantener compatibles los documentos existentes. El antiguo `Generate Value` continúa registrado para ejecutar e importar flujos ya guardados, pero no se ofrece al crear nodos nuevos.

Los datos compartidos con Manual utilizan también los mismos editores visuales. `Navigate` ofrece URL base y filas de query params; `Set Headers`, `Set Cookies` y `Set Storage` muestran entradas individuales con sus campos, tipos, atributos, activación y validación. `Request Override` ya reutiliza el mismo editor completo de Manual. El JSON interno de los nodos se mantiene compatible, pero no es necesario editarlo a mano.

## Ejecución

Antes de ejecutar se validan nombres, IDs, viewport, configuración de nodos, variables, referencias y ciclos. Los nodos se ordenan topológicamente; dos ramas sin dependencia conservan el orden del documento. Un fallo marca como omitidos los nodos pendientes del proceso. En una ejecución de grupo, el siguiente proceso sí se intenta y el resumen acumula éxitos y fallos.

Al solicitar la ejecución de un proceso o grupo, VS Code limpia, abre y enfoca automáticamente el panel **Salida**, incluso si la validación impide que el navegador llegue a iniciarse. La limpieza ocurre una sola vez al comenzar la acción: si se ejecuta un grupo, todos sus procesos permanecen juntos en el mismo registro. El canal seleccionado es `Browser Automation`; usa el lenguaje de salida `log` para conservar el resaltado de fecha y nivel sin recurrir a un canal persistente. No se utiliza la terminal ni la consola de depuración. El registro identifica el grupo, el proceso y la posición de cada nodo, y utiliza estas etiquetas:

- `[INICIO]`: comienza un grupo, proceso o nodo.
- `[OK]`: el nodo o proceso terminó correctamente, incluyendo su duración.
- `[OMITIDO]`: el nodo no se ejecutó porque dependía de otro que falló.
- `[CANCELADO]`: la ejecución fue detenida.
- `[ERROR]`: incluye el motivo del fallo y, cuando existe, su traza técnica.

Al finalizar un grupo se informa cuántos procesos terminaron, cuántos fallaron y el tiempo total. Los fallos normales de un proceso no impiden intentar los procesos posteriores del mismo grupo.

La línea de inicio de cada proceso incluye también ancho, alto, escala, modo móvil y soporte táctil del viewport que recibió el ejecutor. Esto permite distinguir un problema de configuración del proceso de una discrepancia producida dentro de Chromium.

Cada nodo tiene un timeout por defecto configurable. Superarlo fuerza el cierre del navegador. **Stop** cancela y solicita cierre normal; **Force stop** fuerza el cierre. **Pausar** actúa entre nodos. `Pause / Wait User` mantiene el nodo esperando para completar CAPTCHA, 2FA u OAuth y ofrece continuar, reintentar o detener.

Al ejecutar un proceso desde el árbol, el editor selecciona inmediatamente ese proceso y muestra su canvas. Durante la ejecución de un grupo, la selección cambia automáticamente cada vez que comienza el siguiente proceso, incluyendo los estados de preparación, ejecución, pausa y espera del usuario. Los estados de los nodos continúan resaltándose sobre el canvas activo.

Cuando se alcanza `Pause / Wait User`, los controles siguen apareciendo en el banner de VS Code y, adicionalmente, se inyecta una barra aislada en la parte superior del navegador. Ambas ubicaciones controlan la misma espera y ofrecen **Continuar**, **Reintentar** y **Detener**. La barra usa Shadow DOM para no heredar estilos de la página, vuelve a aparecer si el documento navega mientras espera y se elimina al resolver o cancelar la pausa.

## Nodos iniciales

La paleta registra `Navigate`, `Click`, `Campo`, `Set Headers`, `Set Cookies`, `Set Storage`, `Request Override`, `Wait`, `Assertion`, `Validate Data`, `Extract Value`, `Set Variable`, `Guardar dato` y `Pause / Wait User`. El registro interno conserva `Generate Value` exclusivamente para compatibilidad hacia atrás.

### Validación de datos del navegador

`Validate Data` valida información real de la sesión independiente del proceso:

- `request`: última petición observada que contenga el filtro de URL. Expone `url`, `method`, `headers` y `body`.
- `response`: última respuesta observada que contenga el filtro de URL. Expone `url`, `status`, `headers` y `body`.
- `cookie`: busca por nombre y permite comprobar su valor o propiedades como `domain`, `path`, `secure`, `httpOnly` y `sameSite`.
- `localStorage` y `sessionStorage`: buscan una clave en la página actual. Una ruta interna opcional permite consultar valores almacenados como JSON.

El inspector muestra un selector de campos adaptado a cada fuente. Request ofrece URL, método, headers frecuentes y body; Response ofrece URL, status, Content-Type y body; Cookie ofrece sus propiedades; y Storage ofrece el valor completo. La opción **Ruta personalizada** permite cubrir cualquier header o propiedad JSON adicional. Las rutas personalizadas usan puntos: `headers.x-request-id` consulta un header y `body.user.id` parsea el body como JSON y accede a una propiedad anidada.

`Campo que se validará` se persiste en `pathPreset` y `Operador` en `operator`. Por ejemplo, **Body completo** y **JSON equivalente** se almacenan como `body` y `json-equals`; el campo técnico `path` queda reservado para la ruta escrita cuando se selecciona **Ruta personalizada**.

Los operadores disponibles son existencia, ausencia, igualdad, desigualdad, contenido, expresión regular y equivalencia JSON. La equivalencia JSON no depende del orden de las propiedades. Las observaciones de red están limitadas a las 200 peticiones y 200 respuestas más recientes para mantener acotado el consumo de memoria; conviene indicar un filtro de URL para evitar seleccionar recursos auxiliares como imágenes o favicons.

Para validar el JSON devuelto por un `Request Override`:

1. Coloca y ejecuta `Request Override` antes de la acción que dispara la petición.
2. Añade `Navigate`, `Click` u otra acción que produzca la respuesta interceptada.
3. Añade `Validate Data` después de esa acción.
4. Selecciona **Response observada**, introduce una parte suficientemente específica de su URL y elige **Body completo**.
5. Selecciona **JSON equivalente** y pega el JSON esperado. Para comprobar solo una propiedad, usa **Ruta personalizada**, por ejemplo `body.result.id`, y el operador que corresponda.

## Extensión

Una `NodeDefinition` reúne tipo, título, categoría, timeout, campos de inspector, validador y ejecutor. La UI recibe descriptores sin funciones; el Extension Host conserva los ejecutores. Esta separación permite incorporar nuevos nodos sin acoplar Playwright al canvas ni a la webview.

El formulario de overrides vive en `webviews/components/requestOverrideEditor` y es compartido por Manual y Automatizaciones. El selector interactivo cruza la frontera webview/Extension Host mediante mensajes validados y reutiliza `BrowserActionsService`; la lógica de Playwright no entra en la UI.

## Ejemplo completo integrado

El botón **Añadir ejemplo** crea un grupo adicional sin reemplazar el documento existente. El grupo contiene un proceso independiente para cada tipo de nodo registrado y termina con **Todos concatenados**, que reúne el recorrido completo. Todos los nodos de cada proceso ya están conectados y la página muestra una guía contextual para el proceso seleccionado.

Los procesos generados son: `Viewport`, `Variables iniciales`, `Request Override`, `Navigate`, `Click`, `Campo con texto`, `Campo con generador`, `Set Headers`, `Set Cookies`, `Set Storage`, `Wait`, `Assertion`, `Validate Data`, `Extract Value`, `Set Variable`, `Pause / Wait User`, `Guardar dato` y `Todos concatenados`.

`Viewport` usa una configuración móvil personalizada de 390×844, táctil y con modo móvil. La sesión aplica esas dimensiones tanto al viewport como a la pantalla emulada para que `width=device-width` sea determinista. La página servida por el override imprime `window.innerWidth` y `window.innerHeight`, y una assertion confirma que coinciden con el proceso. `Variables iniciales` define `initialName` y `expectedGreeting`; el flujo usa `{initialName}` en `Campo` y `{expectedGreeting}` en `Assertion`. El proceso final aplica el mismo viewport y reutiliza también esas variables antes de continuar con los generadores y el resto de nodos.

Antes y después de cada navegación se reaplica el tamaño mediante la API de página de Playwright. Esto evita que una ventana visible conserve temporalmente las dimensiones exteriores durante el cambio de documento. Si el DOM sigue informando otras medidas, el canal `Browser Automation` registra el viewport de Playwright, `inner`, `outer`, `screen`, `visualViewport`, su escala y el DPR. La página autocontenida actualiza además su indicador cuando recibe `resize`.

Como cada proceso se ejecuta en una sesión limpia, los ejemplos incorporan sus propios nodos auxiliares. El primer nodo de los procesos que usan la página instala dos overrides sobre el dominio reservado `browser-control.test`: uno entrega una página HTML autocontenida y otro responde a su API con JSON. El HTML aplica `border-box` globalmente para que padding y bordes no ensanchen el layout viewport móvil. Al cargar documentos antiguos se repara únicamente este HTML integrado mediante su marcador de título; los overrides creados por el usuario no se modifican. Por ello ningún ejemplo necesita servidor, archivos web externos ni conexión a Internet. El proceso final configura headers, cookie, ambos storages, navega, genera y rellena un valor, pulsa el botón, espera la petición, valida DOM y datos de navegador, extrae el resultado, crea una variable y termina en una pausa manual para poder inspeccionar Chromium.

Cada pulsación añade una copia independiente. El ejemplo queda como cambio sin guardar hasta pulsar **Guardar**. Al ejecutar el grupo entero habrá dos pausas intencionadas: el proceso dedicado a `Pause / Wait User` y la pausa final de `Todos concatenados`. En ambas se debe pulsar **Continuar** para completar el proceso y cerrar su sesión limpia.
