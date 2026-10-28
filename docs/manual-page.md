# Página Manual

Las acciones de navegador escriben su inicio y resultado en **Salida → Browser Automation**. Los avisos y errores abren automáticamente el panel para que una acción fallida nunca quede sin explicación. El registro solo describe la operación y pasa por la redacción común de credenciales: no vuelca valores de cookies, headers, storage ni otros datos sensibles.

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

Los bindings pueden escribir `value`, `checked`, `textContent`, `innerText`, atributos o propiedades. El origen puede ser un texto fijo, uno de los generadores integrados, una fórmula o un array. El modo instantáneo usa `fill`; el secuencial simula teclas con retraso configurable.

El picker resalta el elemento bajo el puntero, captura el click y genera un selector CSS estable priorizando ID y atributos de testing. Los selectores CSS atraviesan Shadow DOM abierto; no se intenta acceder a raíces cerradas y XPath no es la opción principal. `Escape` cancela la selección.

Las fórmulas, arrays y generadores básicos se resuelven en la capa de aplicación. **Resetear** restaura los valores capturados antes de aplicar bindings durante la sesión actual.

## Importación y exportación

El perfil se exporta dentro del envelope JSON común y versionado como un paquete `bundleVersion: 1`. Además del perfil incluye únicamente las fórmulas y arrays referenciados por sus generadores, de modo que el archivo sea portátil entre instalaciones. También se admiten envelopes anteriores cuyo `data` era directamente el perfil y perfiles históricos exportados como JSON directo.

Al importar o guardar un JSON editado, las fórmulas se comparan por su código y los arrays por su contenido estructural. Si ya existe un recurso equivalente se reutiliza y se repara el `resourceId`; solo el contenido realmente nuevo pasa por las reglas de importación que generan ID y nombre seguros. Esto evita sobrescrituras y también evita crear duplicados en guardados sucesivos. El perfil importado sigue recibiendo una identidad independiente cuando su ID o nombre colisionan.

**Ver JSON** abre el paquete del perfil que se está editando. El documento se puede seleccionar, copiar y modificar, incluidas sus fórmulas y arrays portátiles. **Aplicar cambios** valida formato, versiones, perfil y recursos, exige conservar el ID del perfil y carga el resultado como cambios sin guardar. **Guardar** ejecuta el mismo resolvedor de recursos que la importación antes de persistir el perfil.
