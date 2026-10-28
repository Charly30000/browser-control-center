# DAO central de datos de la aplicación

**Estado:** decisión aplicada por requisitos del proyecto.

Toda persistencia funcional pasa por una sola implementación pública: `VsCodeApplicationDataDao`. El objetivo es impedir que cada área vuelva a implementar lectura, escritura, rutas, tratamiento de errores o acceso a `globalState`.

El contrato `ApplicationDataDao` ofrece:

- perfiles y sus metadatos;
- fórmulas y su catálogo;
- arrays y su catálogo;
- el documento de automatizaciones;
- una única inicialización de la estructura de almacenamiento.

Los servicios reciben únicamente interfaces pequeñas (`EntityDataDao`, `SingletonDataDao` y `StateDataDao`). Esto permite probarlos con implementaciones en memoria y evita dependencias desde aplicación hacia VS Code. La composición crea una sola instancia del DAO y distribuye sus colecciones tipadas.

La implementación común se responsabiliza de:

- comprobar que los IDs usados como nombres de archivo sean seguros;
- leer siempre como UTF-8 válido;
- escribir primero un temporal y renombrarlo sobre el destino;
- tratar la ausencia de un archivo como dato no creado;
- ignorar el borrado de una entidad ya inexistente;
- validar y clonar los valores recuperados de `globalState`;
- crear una sola vez todos los directorios de datos.

La centralización mantiene las rutas, nombres y claves históricas, por lo que los datos instalados continúan siendo compatibles. Los codecs siguen separados para conservar la responsabilidad específica de validar y migrar cada esquema.

Quedan fuera del DAO los archivos externos escogidos por el usuario al importar o exportar y los artefactos de ejecución de Chromium. Ninguno de ellos representa el estado persistente interno de la aplicación.

La suite incluye una prueba de frontera que enumera el código fuente y falla si aparece un acceso a `workspace.fs` o `globalState` fuera de las ubicaciones permitidas, o si aplicación y dominio importan VS Code. Esto convierte la regla arquitectónica en una restricción verificable.
