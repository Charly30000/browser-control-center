# Editor visual de flujos

El canvas propio usa Lit, SVG y Pointer Events. Selección, viewport, conexiones, historial y portapapeles están separados del modelo de automatización y del motor Playwright.

Permite mover uno o varios nodos, selección por marco, conectar puertos, borrar, copiar/pegar, deshacer/rehacer, pan y zoom. Los nodos nuevos se colocan siempre en `(80, 70)`.

El canvas puede recibir foco. Los nodos son accesibles por teclado: Enter/Espacio selecciona, flechas mueven, Shift+flecha mueve diez unidades y Supr elimina. Los puertos permiten iniciar y completar una conexión con Enter/Espacio. La lista lateral sigue siendo la alternativa estructurada al canvas.

High Contrast usa bordes y foco del sistema mediante `forced-colors`.
