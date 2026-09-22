# Página Fórmulas

## Modelo

Cada fórmula global contiene ID estable, nombre único, código, fechas y versión de esquema. El editor mantiene una copia draft y la compara con la última versión guardada para mostrar el dirty state.

El contrato estructural exige una declaración `function generate()` sin parámetros. `undefined` representará “sin resultado” cuando exista ejecución y cualquier otro resultado deberá ser JSON serializable.

## Seguridad

La Fase 2 no ejecuta el código. `Generar ejemplo` carga una plantilla editable que cumple el contrato, pero no obtiene un resultado. `Probar` delega en `FormulaExecutionService`; su implementación actual responde:

> Ejecución aislada disponible al integrar el navegador.

No se utilizan `eval`, `new Function` ni `node:vm`. La implementación futura deberá sustituir únicamente el adaptador del servicio y aplicar aislamiento y timeout.

## Persistencia y acciones

Las fórmulas se guardan individualmente en `globalStorageUri/formulas`. `globalState` contiene únicamente catálogo y selección. La lista permite selección múltiple y el borrado usa confirmación nativa de VS Code. Los paneles se reutilizan y nunca se duplican.

Importar y exportar utiliza documentos JSON versionados con `format`, `schemaVersion`, `extensionVersion` y `data`.
