# Browser Control Center

Extensión de Visual Studio Code para preparar sesiones web, ejecutar testing manual asistido y controlar navegadores aislados mediante Playwright.

El estado actual incluye:

- página **Manual** con perfiles persistentes;
- recursos globales de **Fórmulas** y **Arrays**;
- selector entre Chromium administrado y el Google Chrome instalado por el usuario;
- instalación administrada de Chromium fuera del VSIX;
- sesiones limpias, pestañas y viewports;
- aplicación real de URL, headers, cookies, storage, overrides e inputs;
- selector visual de elementos;
- ejecución de fórmulas en un navegador headless aislado, sin red y con timeout duro;
- canal de logs `Browser Automation`.
- editor visual propio de automatizaciones, sin librerías de grafos;
- perfiles, recursos y automatizaciones importables/exportables mediante un formato común versionado y sin sobrescribir elementos existentes;
- persistencia interna centralizada en un único DAO tipado, con escrituras atómicas y sin acceso directo al storage desde los servicios;
- ejecución secuencial en sesiones limpias del navegador seleccionado, variables tipadas, timeouts, pausa y cancelación;
- nodos reutilizables para navegación, interacción, datos, sesión, red, esperas y assertions.

Ningún navegador se descarga durante `npm install` ni se empaqueta con la extensión. Tras abrir el Extension Development Host, pulsa **Gestionar navegador** y selecciona Chrome instalado o instala Chromium administrado. Las sesiones son no persistentes y nunca utilizan el perfil personal del usuario.

El quinto botón de la navegación lateral, **Documentación para IA**, abre una página con la guía completa de la aplicación y un selector para consultar Manual, Fórmulas, Arrays o Automatizaciones. Incluye uso, opciones, formatos JSON y ejemplos completos. Pulsa **Copiar documentación**, pégala en tu chat y describe lo que necesitas. Si quieres modificar un elemento existente, añade su documento de **Ver JSON** para conservar sus IDs. Pega el resultado en **Ver JSON → Aplicar cambios → Guardar**; para Fórmulas y Arrays también puedes pedir solo el código o la lista y pegarlos en sus editores correspondientes.

Consulta [la guía de Automatizaciones](docs/automations-page.md), [la guía de desarrollo](docs/development.md), [la arquitectura](docs/architecture.md), [el motor de navegador](docs/browser-engine.md), [importación/exportación](docs/import-export.md), [la seguridad de fórmulas](docs/formula-sandbox.md), [release](docs/release.md) y [la estrategia de pruebas](docs/testing.md).
