# Evolución de los JSON guardados

Cada documento conserva su propia `schemaVersion`: Manual usa actualmente 2; Fórmulas, Arrays y Automatizaciones usan 1. La versión de la extensión, el envelope de importación y la metadata de los catálogos son independientes. Este cambio añade el motor común sin alterar la estructura de los documentos actuales: no inventa un cambio de esquema para incrementar sus números.

## Regla obligatoria al cambiar datos

1. Antes de cambiar campos, tipos, significado o valores predeterminados persistidos, conserva un fixture del formato publicado.
2. Incrementa su constante `*_SCHEMA_VERSION` en el modelo de dominio.
3. Añade una transformación pura `n -> n + 1` en `src/infrastructure/persistence/migrations/registry.ts`. Nunca elimines las transformaciones anteriores ni te saltes versiones.
4. Actualiza los guards y factories de la forma actual. Todos los lectores de disco y de importación deben pasar por el codec con migraciones antes de comprobar la estructura actual.
5. Añade pruebas del fixture anterior, preservación de datos e IDs, encadenamiento, versiones futuras y errores. La cadena debe cubrir todas las versiones admitidas, incluso al leer un documento ya actual: subir una constante sin registrar el paso falla.
6. Actualiza esta documentación, la referencia del formato y CHANGELOG. Las traducciones y otros cambios puramente visuales no cambian `schemaVersion`.

La regla también está en `AGENTS.md` para el mantenimiento del repositorio. Los fixtures históricos son contratos publicados: añade otros nuevos, sin reescribir los antiguos para que pasen las pruebas.

## Lectura y escritura

`migrateSchema` trabaja sobre una copia del JSON y aplica cada paso en orden. El codec valida la estructura final. Una lectura satisfactoria en el DAO escribe la versión nueva mediante temporal y renombrado atómico, antes de entregar el documento a la aplicación. Una segunda lectura del mismo archivo no repite la escritura. Las importaciones se migran en memoria y solo se guardan en el destino habitual; el archivo de importación original no se modifica.

La migración conserva identidad, nombres, referencias, valores y fechas salvo una conversión explícita del contrato. Si falta un paso, el documento es inválido o pertenece a una versión futura, se devuelve un error y no se sobrescribe el original. Un fallo del renombrado también conserva el archivo original. No se sustituye un documento antiguo por un perfil vacío como alternativa a migrarlo.

Manual v1 pasa a v2 conservando viewport y generadores y añadiendo los campos de escritura. Los otros tres tipos están registrados desde su primera versión; sus próximos cambios deberán añadir su correspondiente paso. Las preferencias opcionales ya compatibles conservan su comportamiento actual.

## Catálogos y selectores

Al cargar o refrescar perfiles y recursos, se comprueba mediante el DAO si sus archivos existen. Las referencias inexistentes se retiran de la metadata; si la selección desapareció, se elige una entrada existente o ninguna. Los selectores de Manual, Fórmulas, Arrays y los recursos de Automatizaciones reciben estas listas depuradas. Los borradores actuales se siguen identificando como no guardados y no representan un archivo eliminado.

Las comprobaciones son de existencia, sin cargar todo el contenido para construir una lista. Los errores de permisos u otros errores de lectura se muestran y no se interpretan como borrados. Los archivos corruptos o de versiones futuras tampoco se eliminan. La reconciliación conserva entradas añadidas o actualizadas mientras se comprobaban los archivos.

Los cambios del formato no deben cambiar el publisher, la identidad de la extensión ni las claves de almacenamiento. Una instalación anterior con otra identidad es una importación explícita, no una migración de esquema.
