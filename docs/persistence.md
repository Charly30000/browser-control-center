# Persistencia

Toda persistencia funcional interna atraviesa `ApplicationDataDao`, implementado por `VsCodeApplicationDataDao`. Dominio y aplicación no acceden a VS Code ni al filesystem.

- `globalState` conserva catálogos pequeños, selección y preferencias.
- `globalStorageUri/profiles`, `formulas` y `arrays` contienen un JSON por entidad.
- `globalStorageUri/automations/automation.json` contiene el documento de automatizaciones.
- Las escrituras usan un temporal y un renombrado atómico.
- Los IDs empleados como nombres de archivo se validan.
- Las lecturas exigen UTF-8 válido y pasan por el codec de la entidad.

Los archivos externos de importación/exportación y los binarios del navegador no forman parte del DAO. Los cambios de esquema persistido deben conservar un lector de la versión anterior y añadir su prueba antes de incrementar la versión.

El motor y la regla obligatoria de mantenimiento se describen en [Migraciones](migrations.md) y `AGENTS.md`. Los cuatro codecs aplican migraciones secuenciales; el DAO guarda los cambios de versión válidos mediante escritura atómica al leer. Las listas se reconcilian con los archivos existentes para retirar referencias obsoletas sin eliminar documentos por errores de lectura.

## Identidad de instalación y recuperación

El almacenamiento depende de la identidad `publisher.name` de la extensión y del perfil de usuario de VS Code. Cambiar de publisher o de perfil puede mostrar otro catálogo aunque los archivos anteriores sigan en su carpeta original. Traducir las etiquetas no cambia los IDs, claves de metadata ni directorios de guardado.

Manual restaura primero el perfil seleccionado guardado, con sus inputs, cookies, headers, overrides y preferencias. Un perfil vacío guardado y seleccionado se restaura como vacío. Los elementos del catálogo cuyos archivos ya no existen no contienen los datos necesarios para reconstruirlos: el catálogo solo guarda sus resúmenes. Para recuperar una instalación anterior, conserva sus archivos y usa Importar con el perfil o una exportación portátil, incluyendo las fórmulas y arrays referenciados. Las sesiones vivas del navegador se mantienen separadas de esta configuración.
