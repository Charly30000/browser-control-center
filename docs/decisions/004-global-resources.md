# Recursos globales de Fórmulas y Arrays

**Estado:** requerido por la Fase 2.

Fórmulas y arrays no pertenecen a un perfil Manual. Se almacenan como recursos globales, un archivo por recurso bajo `globalStorageUri`; `globalState` conserva únicamente catálogos pequeños.

Manual guarda referencias por ID y resuelve los nombres al cargar sus catálogos. Eliminar un recurso no reescribe perfiles existentes: mantiene la intención del perfil y muestra la referencia como no disponible.

En importación se reutiliza un recurso si coinciden su ID y todo su contenido serializado. Si el mismo ID contiene datos diferentes, o si el nombre ya está ocupado, se crean un UUID y un nombre con sufijo nuevos. Se devuelve un mapa de IDs para reparar referencias. Si no existe colisión se conservan el ID y el nombre originales. No se usan hashes.
