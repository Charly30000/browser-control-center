# Página Manual

## Sesión y pestañas

**Iniciar** crea una sesión limpia. **Detener** intenta un cierre normal, **Forzar cierre** termina el proceso y **Reinicio limpio** descarta el contexto actual y crea otro. Las pestañas se identifican internamente por ID y se actualizan cuando navegan, cambian de título, se abren como popup o se cierran.

**Abrir** compone la URL con los query params activos, inicia Chromium si es necesario y navega la pestaña seleccionada.

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

Los bindings pueden escribir `value`, `checked`, `textContent`, `innerText`, atributos o propiedades. El modo instantáneo usa `fill`; el secuencial simula teclas con retraso configurable.

El picker resalta el elemento bajo el puntero, captura el click y genera un selector CSS estable priorizando ID y atributos de testing. Los selectores CSS atraviesan Shadow DOM abierto; no se intenta acceder a raíces cerradas y XPath no es la opción principal. `Escape` cancela la selección.

Las fórmulas, arrays y generadores básicos se resuelven en la capa de aplicación. **Resetear** restaura los valores capturados antes de aplicar bindings durante la sesión actual.
