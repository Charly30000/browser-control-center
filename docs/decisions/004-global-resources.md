# Recursos globales de Fórmulas y Arrays

**Estado:** requerido por la Fase 2.

Fórmulas y arrays no pertenecen a un perfil Manual. Se almacenan como recursos globales, un archivo por recurso bajo `globalStorageUri`; `globalState` conserva únicamente catálogos pequeños.

Manual guarda referencias por ID y resuelve los nombres al cargar sus catálogos. Eliminar un recurso no reescribe perfiles existentes: mantiene la intención del perfil y muestra la referencia como no disponible.

En importación nunca se reutiliza ni reemplaza un recurso por coincidencia. Si coincide el ID o el nombre, aunque el contenido sea idéntico, se crean un UUID y un nombre con sufijo nuevos. Se devuelve un mapa de IDs para que las entidades importadas puedan reparar sus referencias. Si no hay ninguna colisión se conservan el ID y el nombre originales. No se usan hashes.
