# Persistencia

Toda persistencia funcional interna atraviesa `ApplicationDataDao`, implementado por `VsCodeApplicationDataDao`. Dominio y aplicación no acceden a VS Code ni al filesystem.

- `globalState` conserva catálogos pequeños, selección y preferencias.
- `globalStorageUri/profiles`, `formulas` y `arrays` contienen un JSON por entidad.
- `globalStorageUri/automations/automation.json` contiene el documento de automatizaciones.
- Las escrituras usan un temporal y un renombrado atómico.
- Los IDs empleados como nombres de archivo se validan.
- Las lecturas exigen UTF-8 válido y pasan por el codec de la entidad.

Los archivos externos de importación/exportación y los binarios del navegador no forman parte del DAO. Los cambios de esquema persistido deben conservar un lector de la versión anterior y añadir su prueba antes de incrementar la versión.
