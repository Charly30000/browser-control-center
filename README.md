# Browser Control Center

Extensión de Visual Studio Code que actuará como panel de control para desarrollo web, testing manual asistido y automatización de navegador.

La Fase 2 incluye la base publicable, la página **Manual** y recursos globales de **Fórmulas** y **Arrays**. Playwright y Automatizaciones todavía no forman parte del runtime.

## Estado actual

- View Container e icono propios.
- Sidebar con las cuatro áreas y estado del navegador.
- Panel Manual único y reutilizable.
- Perfiles persistentes, importables y exportables.
- Formularios para URL, query params, headers, cookies, storage, overrides y generadores.
- Generadores puros de datos básicos e identificadores españoles.
- CRUD global de Fórmulas y Arrays con importación/exportación versionada.
- Referencias por ID desde Manual y generación aleatoria desde arrays.
- Contrato de ejecución de fórmulas preparado, sin ejecución insegura.
- `BrowserBridge` desacoplado con implementación stub.
- CSP restrictiva, mensajes tipados, tema de VS Code y diseño responsive.

Consulta [la guía de desarrollo](docs/development.md), [la arquitectura](docs/architecture.md), [las dependencias](docs/dependencies.md), [la estrategia de pruebas](docs/testing.md) y [el detalle de Manual](docs/manual-page.md) para ampliar o ejecutar el proyecto.
