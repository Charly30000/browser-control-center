# Importación y exportación

`extensionVersion` se obtiene de la versión central del manifiesto mediante `src/shared/extensionVersion.ts`. Describe la publicación que genera cada exportación y se conserva al leer documentos ajenos o antiguos; no decide la migración de sus esquemas. Véase [Versión centralizada](release.md#versión-centralizada).

Las cuatro áreas usan un envelope común con `format`, `schemaVersion`, `extensionVersion`, `exportedAt` y `data`. La versión exterior actual es 1. Todavía no existe una versión histórica del envelope que migrar; cuando se incremente, el cambio deberá añadir primero un migrador y sus pruebas.

Los documentos deben ser JSON UTF-8. No se intenta adivinar ANSI o Windows-1252 porque una conversión ambigua puede alterar valores. El máximo práctico es 100 MiB por documento: el archivo se comprueba antes de leerlo, los editores avisan desde el 80 % y bloquean cambios que lo superen.

Política de identidad:

- mismo ID y contenido serializado idéntico: reutilizar;
- mismo ID y contenido diferente: generar UUID y reparar referencias;
- nombre ocupado: generar identidad independiente y nombre con sufijo;
- IDs inválidos o internos que colisionen: regenerar;
- nunca sustituir silenciosamente una entidad existente.

Manual puede además reutilizar una fórmula por código o un array por contenido estructural para evitar duplicados en paquetes portátiles. Automatizaciones repara los extremos de conexiones cuando cambia el ID de un nodo.
