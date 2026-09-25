# Mensajería y CSP de webviews

**Estado:** definido para la Fase 1.

Las webviews no acceden directamente a persistencia ni a la API de VS Code. Se comunican mediante uniones discriminadas en `src/shared/messages`. La extensión valida mensajes en el límite de confianza.

Los scripts requieren un nonce por documento y no se habilitan orígenes de red para scripts ni un `localResourceRoots` amplio. Los estilos son recursos locales generados por esbuild.

La webview de Automatizaciones permite `unsafe-inline` exclusivamente en `style-src`. El canvas necesita posiciones, transformaciones, zoom y dimensiones calculadas durante cada gesto; Lit las aplica mediante atributos `style` y la CSP de VS Code las bloquea sin esta excepción. `script-src` continúa limitado al nonce y el resto de webviews mantiene la política de estilos estricta.
