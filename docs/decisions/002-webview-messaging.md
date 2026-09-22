# Mensajería y CSP de webviews

**Estado:** definido para la Fase 1.

Las webviews no acceden directamente a persistencia ni a la API de VS Code. Se comunican mediante uniones discriminadas en `src/shared/messages`. La extensión valida mensajes en el límite de confianza.

Los scripts requieren un nonce por documento; los estilos son recursos locales generados por esbuild. No se habilitan `unsafe-inline`, orígenes de red para scripts ni un `localResourceRoots` amplio.
