# Página Manual

## Perfiles

Un perfil agrupa URL base, query params, headers, cookies, ambos storages, request overrides, bindings de generadores y un viewport futuro. **Nuevo** crea un draft con nombre `untitled`; los sufijos usan siempre la serie plana `untitled-1`, `untitled-2`, etc. **Guardar** persiste el archivo, **Eliminar** pide confirmación mediante un diálogo nativo de VS Code y también permite descartar un borrador sin guardar, e **Importar/Exportar** usan JSON versionado.

## URL y query params

La URL base se procesa con `URL`; las entradas activas se añaden con `URLSearchParams`. Se permiten claves repetidas. Una URL inválida se muestra antes de enviarla al caso de uso.

## Storage

Los tipos admitidos son `string`, `number`, `boolean`, `JSON` y `null`. La UI valida el texto y `BrowserActionsService` repite la validación antes de alcanzar el bridge.

## Overrides

Los matchers pueden ser URL exacta, glob o regex. El modelo incluye método, acción, estado, headers, body y content type. Las regex y estados HTTP se validan antes de aplicar.

## Generadores

Nombre, apellido, email, teléfono, número, DNI, NIE y CIF funcionan como lógica pura. La precisión numérica es el máximo número de decimales textuales entre mínimo y máximo. Fórmula y array muestran los recursos globales existentes y guardan la selección mediante `resourceId`.

Los arrays permiten generar una muestra local mediante `ArrayValueGenerator`. Un array vacío produce “Sin resultado”. Las fórmulas no se ejecutan todavía: muestran que la ejecución aislada estará disponible al integrar el navegador.

Cada binding separa el selector CSS de la propiedad destino. Se admiten `value`, `textContent`, `innerText`, `checked`, atributo y propiedad personalizada. **Seleccionar elemento** y **Aplicar** llegan al bridge stub; **Generar muestra** permite verificar únicamente la generación local.

## Estado runtime

Ninguna acción de navegador se presenta como exitosa en esta fase. El bridge stub responde que el navegador no está configurado. Esto mantiene separadas la edición del perfil, su persistencia y su aplicación runtime.
