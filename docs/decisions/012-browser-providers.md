# ADR 012 — Proveedores de navegador seleccionables

Manual, Fórmulas y Automatizaciones resuelven el navegador mediante `BrowserSelectionService`. Cada integración específica implementa `BrowserProvider` dentro de `infrastructure/browser/providers` y devuelve proveedor, motor, ejecutable o canal. El ciclo de vida común selecciona el motor de Playwright y mantiene las mismas garantías de reinicio y limpieza.

Google Chrome se inicia mediante el canal estable `chrome`, nunca con `launchPersistentContext` ni con el perfil del usuario. Todos los usos crean contextos no persistentes. La preferencia se guarda mediante el DAO central y Chromium administrado continúa siendo el valor predeterminado para conservar compatibilidad y reproducibilidad.

Esta frontera evita condicionales de navegador repartidos por la UI y deja un punto de extensión único para Firefox, WebKit u otros navegadores que puedan adaptarse al contrato.
