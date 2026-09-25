# ADR 008 — Flow Canvas propio

## Decisión

Construir el editor de grafos con Lit, SVG y Pointer Events, separando selección, viewport, conexiones, historial y portapapeles.

## Motivo

Los requisitos iniciales son acotados y la extensión ya usa Lit. Evitar una librería de diagramas reduce el VSIX, elimina un segundo modelo de componentes y mantiene control total sobre integración con el tema de VS Code, accesos de teclado y serialización.

## Consecuencias

El proyecto mantiene explícitamente geometría, interacción y accesibilidad. Las pruebas cubren la lógica pura; las comprobaciones visuales y de Pointer Events forman parte de la prueba manual.

Las interacciones largas siguen un ciclo por gesto inspirado en Excalidraw: estado transitorio independiente, listeners de puntero instalados en `window` al comenzar, hit-testing geométrico durante el movimiento y confirmación o cancelación centralizada al finalizar. Las conexiones no dependen del elemento DOM que recibe `pointerup`.
