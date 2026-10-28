# Límite de ejecución de fórmulas

**Estado:** decisión inicial, ampliada por el ADR 007.

El dominio define el contrato de fórmula y la aplicación depende de `FormulaExecutionService`. En la Fase 2 existió una implementación temporal que respondía con indisponibilidad explícita; dejó de ser la implementación activa al incorporarse el adaptador aislado descrito en el ADR 007.

Se descartan `eval`, `new Function` y `node:vm` en el Extension Host porque no proporcionan el aislamiento requerido. La implementación actual ejecuta cada fórmula en un proceso de navegador desechable, sin red y con timeout duro, sin acoplar la UI al mecanismo de ejecución.
