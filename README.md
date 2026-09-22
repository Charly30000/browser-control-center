# Browser Control Center

Extensión de Visual Studio Code para preparar sesiones web, ejecutar testing manual asistido y controlar un Chromium dedicado mediante Playwright.

La Fase 3 incluye:

- página **Manual** con perfiles persistentes;
- recursos globales de **Fórmulas** y **Arrays**;
- instalación administrada de Chromium fuera del VSIX;
- sesiones limpias, pestañas y viewports;
- aplicación real de URL, headers, cookies, storage, overrides e inputs;
- selector visual de elementos;
- ejecución de fórmulas en un Chromium headless aislado, sin red y con timeout duro;
- canal de logs `Browser Automation`.

Chromium no se descarga durante `npm install` ni se empaqueta con la extensión. Tras abrir el Extension Development Host, pulsa **Gestionar Chromium → Instalar**.

Consulta [la guía de desarrollo](docs/development.md), [la arquitectura](docs/architecture.md), [la gestión de Chromium](docs/browser-runtime.md), [la seguridad de fórmulas](docs/formula-sandbox.md) y [la estrategia de pruebas](docs/testing.md).
