# Límite de ejecución de fórmulas

**Estado:** requerido por la Fase 2.

El dominio define el contrato de fórmula y la aplicación depende de `FormulaExecutionService`. La implementación de Fase 2 nunca ejecuta código y responde con indisponibilidad explícita.

Se descartan `eval`, `new Function` y `node:vm` porque no proporcionan el aislamiento requerido. La fase que integre navegador deberá aportar un adaptador aislado y con timeout sin acoplar la UI al mecanismo de ejecución.
