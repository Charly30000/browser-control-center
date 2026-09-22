# Recursos globales de Fórmulas y Arrays

**Estado:** requerido por la Fase 2.

Fórmulas y arrays no pertenecen a un perfil Manual. Se almacenan como recursos globales, un archivo por recurso bajo `globalStorageUri`; `globalState` conserva únicamente catálogos pequeños.

Manual guarda referencias por ID y resuelve los nombres al cargar sus catálogos. Eliminar un recurso no reescribe perfiles existentes: mantiene la intención del perfil y muestra la referencia como no disponible.

En importación, un ID con contenido serializado idéntico reutiliza el recurso. Si el contenido difiere se crea otro UUID y se devuelve un mapa de IDs para que cualquier entidad importada actualice sus propias referencias. No se usan hashes.
