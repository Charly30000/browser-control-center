# Documentación para IA

**Documentación para IA** es el quinto botón de la navegación lateral, junto a Manual, Fórmulas, Arrays y Automatizaciones. Abre una página propia con toda la documentación. Su selector permite consultar la guía completa o una sección concreta. El contenido es de solo lectura y ofrece selección de todo el texto y copia al portapapeles; también puede copiarse con el teclado. Si vuelves a pulsar el botón lateral, se muestra la misma página abierta.

La interfaz y el texto copiable están en inglés: busca **AI Documentation**, **Copy documentation**, **View JSON**, **Apply changes** y **Save**. Los nombres traducidos de esta guía describen esas mismas acciones.

La guía contiene contexto general de la aplicación, pasos de uso, opciones disponibles, estructura del documento, requisitos de identidad y versión, referencias entre recursos y ejemplos JSON completos. En Automatizaciones incluye todos los tipos de nodo, cómo conectar procesos y cómo capturar y reutilizar valores. Describe cómo utilizar la aplicación, sin explicar su implementación.

Para obtener ayuda:

1. Copia la documentación y pégala en tu chat con una IA.
2. Describe qué quieres preparar y dónde pegarás el resultado. Para adaptar un elemento existente, adjunta su documento de **Ver JSON** y los selectores o datos de ejemplo necesarios.
3. Copia el documento que genere la IA en **Ver JSON**, pulsa **Aplicar cambios**, revisa el resultado y pulsa **Guardar**. Para añadir recursos nuevos también puedes guardar el documento en un archivo e **Importar**.

El editor **Código** de Fórmulas acepta solo JavaScript y **Contenido JSON** de Arrays acepta solo una lista. Sus documentos completos de importación y **Ver JSON** llevan un envoltorio con `format`, versiones y `data`. Las guías explican esta diferencia y cómo conservar el ID del recurso abierto.

Los ejemplos de Manual y Automatizaciones incluyen una página HTML interceptada por un override, por lo que no necesitan un servidor externo. Para ejecutarlos sigue siendo necesario disponer de un navegador seleccionado. La guía es genérica: no incorpora automáticamente datos del perfil, credenciales ni documentos del usuario, y abrirla o copiarla no cambia los borradores.

Todas las secciones explican cómo elegir el navegador activo, conservar la configuración al actualizar y tratar documentos antiguos. Los datos compatibles se actualizan automáticamente; no se debe cambiar `schemaVersion` a mano para ocultar un error. También se indica que los elementos sin archivo no aparecen en los selectores y que una referencia ausente debe recuperarse desde una copia o sustituirse por el ID real de un recurso guardado.

## Mantenimiento de la documentación

Todo cambio que afecte a la forma de usar la aplicación debe actualizar las guías afectadas en el mismo cambio, como exige [AGENTS.md](../AGENTS.md). Esto incluye botones, valores predeterminados, guardado, navegación, validaciones, tipos de nodo y campos JSON. El texto copiable debe seguir explicando uso y ejemplos aceptados, sin detalles de implementación.

- Los textos en inglés están en `src/localization/locales/en.json`, principalmente en `documentation.*` y en los mensajes de uso de nodos. Los demás idiomas registrados se mantienen en sus propios catálogos; se conservan los marcadores de sustitución.
- `src/webviews/documentation/` compone las guías; `examples.ts` construye los ejemplos completos con las mismas factorías que la aplicación. La versión de publicación se toma del acceso compartido, sin copiarla como literal.
- Los cambios de opciones o formato deben reflejarse tanto en las explicaciones como en los ejemplos. Revisa las comprobaciones existentes en `test/aiDocumentation.test.ts` y las guías correspondientes de `docs/`, y resume el cambio en inglés en el changelog. El README presenta la aplicación para facilitar su adopción: solo se modifica si afecta a esa presentación, a sus funciones principales, a los primeros pasos o a la exactitud de lo que ya cuenta. Los detalles de uso se mantienen aquí y en las guías, sin trasladarlos al README por cada cambio.
- Todo nodo nuevo o modificado debe tener un ejemplo ejecutable accesible desde **Add example**, con sus nuevos modos, entradas y resultado esperado. Mantén también su guía contextual y configuración en el catálogo para IA; no des por terminada una modificación de nodo sin un ejemplo que la demuestre.
- `npm run verify` genera los catálogos, comprueba las traducciones y valida los ejemplos junto con el resto de la aplicación. No edites archivos de traducción generados ni las muestras históricas de persistencia.

Estas instrucciones de mantenimiento pertenecen al repositorio; no se incluyen en la documentación que el usuario copia para una IA.
