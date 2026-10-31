# Capturas para el README

Estas imágenes sirven exclusivamente para presentar la extensión en GitHub y Marketplace. Se conservan en `docs/screenshots/` y no forman parte del VSIX. No se mantienen scripts de captura en el proyecto.

- `manual-session.png`: controles de sesión, perfil y URL, en una ventana de 1000 px de ancho.
- `manual-inputs.png`: detalle independiente de Inputs / Generators.
- `automations.png`: espacio de trabajo con seis nodos conectados y completados correctamente en verde, tomado de una ventana de 1280 px de ancho.

El README muestra Manual y Automatizaciones en dos columnas y, justo debajo, la captura de Inputs / Generators centrada en una tarjeta del mismo estilo. Las tres previsualizaciones tienen 360 px de ancho y un enlace visible **Open full-size image**. La distribución mantiene las dos capturas principales arriba y permite ver el editor de campos directamente, sin abrir un enlace adicional.

La galería agrupa dos tablas dentro de un contenedor centrado: una con Manual y Automatizaciones y otra con Inputs / Generators. Ambas tablas llevan su propio `align="center"`, para centrar también la caja sin depender de la alineación heredada del contenedor. La tabla inferior se ajusta al ancho de su imagen; no se ensancha con `colspan`. Al modificar la galería, comprueba el resultado con los estilos de la previsualización de VS Code y de GitHub, manteniendo el mismo centro para ambas tablas y el mismo ancho para las tres tarjetas.

Los enlaces de tamaño completo apuntan directamente al PNG mediante HTTPS para abrirlo en el navegador. La ficha de extensiones de VS Code [admite enlaces HTTP/HTTPS en el README](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts); no se promete un ampliador integrado en la ficha. Las capturas muestran zonas concretas para conservar su legibilidad y se pueden consultar sin depender de pulsar sobre una miniatura.

Para actualizarlas, abre los paneles reales con un tema oscuro y datos ficticios, usa una ventana de tamaño similar y captura únicamente la zona correspondiente. En Automatizaciones, ejecuta el flujo de ejemplo y espera a que termine correctamente: el verde debe proceder de los estados reales. No incluyas credenciales ni datos personales.

Sube el README y estos PNG al repositorio de GitHub antes de publicar. El empaquetador transforma los enlaces de imágenes en URLs del repositorio para mostrarlas en Marketplace; las imágenes no necesitan instalarse con la extensión. `docs/**` y `resources/screenshots/**` están excluidos en `.vscodeignore`.
