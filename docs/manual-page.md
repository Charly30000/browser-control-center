# Página Manual

Las acciones de navegador escriben su inicio y resultado en **Salida → Browser Automation**. Los avisos y errores abren automáticamente el panel, salvo en Inputs / Generadores, cuyos avisos se muestran en Manual. El registro solo describe la operación y pasa por la redacción común de credenciales: no vuelca valores de cookies, headers, storage ni otros datos sensibles.

Las eliminaciones siempre requieren confirmación. Se aplica a perfiles, query params, headers, cookies, valores de localStorage y sessionStorage, overrides, headers internos de overrides y vínculos de generadores. Todas usan el diálogo modal de advertencia de VS Code con el botón explícito **Eliminar**; la webview espera la respuesta del Extension Host antes de modificar el borrador.

## Sesión y pestañas

**Iniciar** crea una sesión limpia. **Detener** intenta un cierre normal, **Forzar cierre** termina el proceso y **Reinicio limpio** descarta el contexto actual y crea otro. Las pestañas se identifican internamente por ID y se actualizan cuando navegan, cambian de título, se abren como popup o se cierran.

**Abrir** compone la URL con los query params activos, inicia el navegador seleccionado si es necesario y navega la pestaña seleccionada.

## Viewport

Incluye Desktop 1920×1080, Laptop 1366×768, tablet y móvil en ambas orientaciones, además de ancho, alto, escala, touch y modo móvil personalizados. Como son opciones del contexto, se aplican mediante un reinicio limpio.

## Headers, cookies y storage

Los headers se aplican al contexto y afectan a las solicitudes posteriores. Las cookies admiten nombre, valor, dominio, path, expiración, `Secure`, `HttpOnly` y `SameSite`. Si el dominio queda vacío se usa la URL de la pestaña activa; `path: /` cubre todas las rutas de ese dominio.

Local Storage y Session Storage aceptan `string`, `number`, `boolean`, JSON y `null`; el valor se valida antes de escribirlo en la página activa.

## Overrides

Los matchers pueden ser URL exacta, glob o regex y filtrarse por método. Las acciones son:

- `fulfill`: responde con status, headers, body y content type configurados;
- `abort`: cancela la solicitud;
- `continue-modified`: continúa con headers y body modificados.

Los Service Workers se bloquean en el contexto para que las rutas sean observables por Playwright.

## Inputs y selector visual

Al elegir escritura **Secuencial**, el retraso inicial es de **100 ms por tecla**. Puedes modificarlo. Los perfiles ya guardados conservan su valor al cargarlos; cambiar de modo mantiene los retrasos personalizados distintos de cero.

Los bindings pueden escribir `value`, `checked`, `textContent`, `innerText`, atributos o propiedades. El origen puede ser un texto fijo, uno de los generadores integrados, una fórmula o un array. El modo instantáneo usa `fill`; el secuencial simula teclas con retraso configurable.

El picker resalta el elemento bajo el puntero, captura el click y genera un selector CSS estable priorizando ID y atributos de testing. Los selectores CSS atraviesan Shadow DOM abierto; no se intenta acceder a raíces cerradas y XPath no es la opción principal. `Escape` cancela la selección.

Las fórmulas, arrays y generadores básicos se resuelven en la capa de aplicación. **Resetear** restaura los valores capturados antes de aplicar bindings durante la sesión actual.

### Aplicación explícita y filas minimizadas

Cada fila de Inputs / Generadores, Cookies y Request Overrides tiene un único botón **Aplicar**. Con la fila expandida aparece en su zona de acciones; al minimizarla se mueve junto al resumen. Pulsarlo en el resumen no expande la fila. El estado expandido/minimizado se conserva como preferencia de cada fila del perfil y se incluye en Ver JSON, Exportar e Importar mediante el campo opcional `expanded` (booleano).

Las cabeceras de las secciones se distinguen por su icono, acento de color y título destacado; las colecciones muestran el número de elementos. Cookies, Request Overrides e Inputs / Generadores incluyen **Expandir todos** y **Contraer todos** en su cabecera. Cada control afecta solo a las filas de ese grupo y actualiza sus preferencias en el borrador para guardarlas. Mantiene un único botón Aplicar por fila y no aplica valores al navegador. Si el grupo está vacío, ambos controles están deshabilitados.

### Guardado automático opcional

El interruptor **Guardado automático** está al principio de la pantalla, por encima del título, igual que en Arrays, Fórmulas y Automatizaciones. Permite alternarlo para el perfil actual y está activado si no se ha configurado. Al activarlo, los cambios se guardan después de **5 segundos sin interactuar con controles**: escribir o usar el teclado en un campo, pulsar botones u otros controles y arrastrar elementos reinicia la espera. Mover el ratón, pasar sobre campos, desplazar la página o pulsar el fondo no la reinicia. Durante un arrastre, la cuenta empieza al terminarlo. Solo guarda si hay cambios, incluidas las preferencias de expansión. No aplica valores ni envía formularios.

**Guardar** sigue disponible para guardar inmediatamente. Desactivar el guardado automático cancela la espera pendiente; pulsa Guardar para conservar también esa desactivación. La preferencia se incluye en el perfil y su JSON como `preferences: { "autoSaveEnabled": true }` o `false` dentro de ese objeto.

El guardado automático se pausa mientras se edita Ver JSON, se decide qué hacer con cambios sin guardar o se cambia de perfil. Aplicar cambios del editor JSON vuelve a iniciar la espera. Las ediciones realizadas mientras se guarda se conservan como cambios pendientes y se guardan después de su propia espera. Si falla el guardado, el borrador permanece y se muestra un aviso; no hay reintentos continuos sin actividad nueva.

Los perfiles antiguos sin `expanded` ni `preferences` siguen siendo válidos: cookies cerradas, overrides y generadores abiertos, y guardado automático activado. Guardar conserva estas preferencias usando el formato v2 existente.

### Ordenar filas con drag and drop

El asa de puntos de cada fila permite arrastrarla dentro de su propia lista: query params, headers, cookies, Local Storage, Session Storage, Request Overrides e Inputs / Generadores. Los headers internos de cada override también se pueden ordenar dentro de esa regla. La línea de inserción indica si se colocará antes o después de la fila de destino. No se arrastran las secciones ni se trasladan elementos entre listas o entre overrides distintos.

Arrastra desde el asa para seguir pudiendo editar y seleccionar texto normalmente en los campos. Con el asa enfocada también puedes usar **Alt+↑** y **Alt+↓**. Cancelar el arrastre o soltar fuera de la lista no cambia el orden. Las filas desplegables conservan su estado y sus valores al moverse, con un único botón Aplicar por elemento.

Mientras mantienes agarrado un elemento puedes usar la **rueda del ratón** para desplazar la página o la lista. El indicador de inserción se actualiza con el desplazamiento y al soltar se utiliza el destino visible. **Escape** cancela el movimiento; desplazar o cancelar no cambia los datos. El guardado automático espera a que termines de sostener el elemento.

Soltar una fila modifica el borrador y activa el indicador **Cambios sin guardar**. Pulsa **Guardar** para conservar el orden en el perfil; Ver JSON y Exportar incluyen ese mismo orden. No se crean IDs nuevos ni se modifica el esquema v2, y reordenar no aplica datos automáticamente al navegador. Aplicar todos utiliza el nuevo orden de los generadores; al aplicar overrides, la primera regla activa que coincida tiene prioridad.

Los campos solo se escriben al pulsar **Aplicar** en su fila o **Aplicar todos**. Cargar, seleccionar, guardar, importar o editar un perfil, iniciar/reiniciar el navegador, navegar, recibir cambios de estado y generar una muestra no rellenan los inputs. **Generar muestra** calcula un valor sin escribirlo. **Resetear** es una acción explícita que restaura los valores originales de la sesión.

**Aplicar todos** procesa las filas activas por orden e intenta cada una aunque otra tenga una fórmula fallida, un array sin resultado, un selector inválido, un elemento ausente o un error al escribir. Al terminar, si hubo errores, muestra cuántos campos se aplicaron y cuáles fallaron; los que se aplicaron correctamente no se deshacen. Los generadores desactivados se omiten y el lote no modifica ni elimina la configuración guardada.

Un elemento inexistente se informa como fallo de esa aplicación, sin dejar una espera pendiente que lo rellene más tarde al aparecer o al navegar. Si el elemento existe pero no está listo para escribirse, la espera ordinaria se limita a dos segundos; la escritura secuencial añade el tiempo de tecleo configurado. Para volver a intentar una fila hay que pulsar **Aplicar** o **Aplicar todos** de nuevo.

Los avisos y errores de **Inputs / Generadores** aparecen en Manual sin abrir automáticamente el panel Salida. Esto incluye Aplicar, Aplicar todos, Generar muestra, seleccionar un elemento y Resetear. El detalle se sigue registrando y se puede consultar manualmente en **Salida → Browser Automation**.

La escritura asistida de Manual no envía formularios: durante cada aplicación se bloquean los envíos nativos y los disparados mediante `submit`/`requestSubmit`, así como Enter fuera de un textarea. La protección se retira al acabar, también si la escritura falla, para permitir que el usuario envíe el formulario después mediante su botón o teclado. Los saltos de línea de un textarea siguen siendo contenido. Esta protección pertenece a Manual; los pasos explícitos de Automatizaciones mantienen su comportamiento.

### Actualizaciones y datos existentes

Estos cambios conservan el formato de perfil v2, los IDs de los perfiles y recursos, las claves de metadatos y las rutas de persistencia. No requieren reinicializar ni migrar los datos de la versión publicada. Al distribuir una actualización debe conservarse la identidad de la extensión (`publisher` y `name`) y asignarse una versión nueva. Los perfiles guardados se conservan; los borradores sin guardar y las sesiones vivas del navegador no son datos persistidos.

## Importación y exportación

El perfil se exporta dentro del envelope JSON común y versionado como un paquete `bundleVersion: 1`. Además del perfil incluye únicamente las fórmulas y arrays referenciados por sus generadores, de modo que el archivo sea portátil entre instalaciones. También se admiten envelopes anteriores cuyo `data` era directamente el perfil y perfiles históricos exportados como JSON directo.

Al importar o guardar un JSON editado, las fórmulas se comparan por su código y los arrays por su contenido estructural. Si ya existe un recurso equivalente se reutiliza y se repara el `resourceId`; solo el contenido realmente nuevo pasa por las reglas de importación que generan ID y nombre seguros. Esto evita sobrescrituras y también evita crear duplicados en guardados sucesivos. El perfil importado sigue recibiendo una identidad independiente cuando su ID o nombre colisionan.

**Ver JSON** abre el paquete del perfil que se está editando. El documento se puede seleccionar, copiar y modificar, incluidas sus fórmulas y arrays portátiles. **Aplicar cambios** valida formato, versiones, perfil y recursos, exige conservar el ID del perfil y carga el resultado como cambios sin guardar. **Guardar** ejecuta el mismo resolvedor de recursos que la importación antes de persistir el perfil.
