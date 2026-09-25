# Frontera común de importación y exportación

**Estado:** aceptado.

Manual, Fórmulas, Arrays y Automatizaciones comparten un envelope JSON:

```json
{
  "format": "browser-control-center/manual-profile",
  "schemaVersion": 1,
  "extensionVersion": "0.4.0",
  "exportedAt": "2026-09-25T12:00:00.000Z",
  "data": {}
}
```

`format` impide importar un tipo de archivo en otra pantalla. `schemaVersion` versiona el contrato exterior; `extensionVersion` deja trazabilidad de la versión que lo generó; y cada entidad dentro de `data` conserva además su propia versión de esquema. Un cambio incompatible del envelope requiere incrementar `IMPORT_EXPORT_SCHEMA_VERSION` y definir explícitamente su migración.

La implementación se divide en tres carpetas:

- `src/domain/importExport`: contrato puro y versiones;
- `src/application/importExport`: decodificación, compatibilidad, resolución de identidades y fusión;
- `src/extension/importExport`: selección, lectura y escritura de archivos mediante VS Code.

Las importaciones no reemplazan datos. Una coincidencia de ID o nombre regenera ambos campos; los nombres se comparan sin distinguir mayúsculas ni espacios exteriores. Los nombres nuevos reciben sufijos `-1`, `-2`, etc. En automatizaciones, la fusión conserva el documento actual, añade grupos y repara los extremos de cada conexión cuando cambia el ID de un nodo.

Antes de mutar datos se comprueban el JSON, el formato, la versión, la estructura y las reglas semánticas disponibles. También se rechazan IDs duplicados dentro de colecciones, texto que no sea UTF-8 y archivos mayores de 5 MB. Los nombres de archivo sugeridos se sanean para evitar caracteres y nombres reservados de Windows. Se mantienen lectores heredados para los JSON directos de Manual y Automatizaciones y para los envelopes de recursos anteriores sin `exportedAt`.
