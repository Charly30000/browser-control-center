# Persistencia de perfiles

**Estado:** definido para la Fase 1.

Cada perfil vive en un JSON versionado dentro de `globalStorageUri/profiles`. `globalState` conserva únicamente el catálogo pequeño y el ID seleccionado.

La alternativa de guardar todos los perfiles en `globalState` se descarta porque mezcla contenido con metadatos y dificulta migraciones, exportación y recuperación individual. Los archivos pasan por un serializador común tanto al cargar como al importar.
