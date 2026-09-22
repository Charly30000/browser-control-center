# Estrategia de pruebas

Las pruebas unitarias se concentran en reglas puras para ser rápidas y no requerir un Extension Development Host.

| Área | Comportamiento cubierto |
|---|---|
| Nombres | Secuencia plana de `untitled` y conflictos al importar |
| Serialización | Round-trip, estructura y versión de esquema |
| Query params | Entradas activas, claves repetidas, encoding y URLs inválidas |
| Storage | Primitivos, JSON, `null` y errores de tipo |
| Overrides | Regex, matcher y rango de estado |
| Generadores | Precisión, datos básicos y dígitos de control |
| Dirty state | Draft nuevo, contenido modificado y fechas técnicas |
| Fórmulas | Contrato `generate`, nombres únicos y CRUD |
| Arrays | JSON, raíz array, valores aleatorios y colección vacía |
| Recursos globales | Serialización, envelopes versionados y conflictos de ID |
| Referencias Manual | Conservación de `resourceId` en perfiles |

La persistencia de archivos y los diálogos quedan detrás de adaptadores de VS Code. Se verifican manualmente en F5 porque dependen del Extension Host. Cuando exista integración de navegador se añadirá una suite propia contra una implementación real de `BrowserBridge`; no se convertirán los stubs actuales en falsos positivos.

## Comprobación completa

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

El orden permite detectar primero errores estructurales, luego reglas de negocio, análisis estático y finalmente problemas de bundle.
