# Changelog

## Sin publicar

- El guardado automático queda activado por defecto en Manual, Arrays, Fórmulas y Automatizaciones cuando el documento no tiene preferencia; se respetan las desactivaciones guardadas por el usuario.

- Las casillas de Manual, Arrays, Fórmulas y Automatizaciones unifican su aspecto con un tamaño de 20 px, bordes redondeados y una marca más visible, con foco de teclado y soporte de alto contraste.

- Arrays y Fórmulas renuevan ligeramente su presentación con iconos y acentos propios, tarjetas separadas de lista y editor, contadores, selección destacada, campos más amplios y estado de guardado en la cabecera. Agregar pasa a ser la acción principal.

- El arrastre de filas de Manual y de grupos/procesos permite desplazar con la rueda mientras se sostiene el elemento, actualiza el destino tras el scroll y se puede cancelar con Escape; el guardado automático espera a terminar.

- Automatizaciones permite ordenar grupos y procesos mediante drag and drop, mover procesos entre grupos (incluidos vacíos o plegados) y usar Alt+↑/↓ para ordenar con teclado.
- Los grupos se pueden expandir o contraer; su campo opcional expanded se conserva al guardar, exportar, importar y editar JSON sin cambiar el esquema ni perder datos existentes.

- Automatizaciones distingue grupos y procesos mediante cabeceras, contadores y tarjetas indentadas; amplía los campos de nombre, permite renombrar procesos desde la lista y selecciona el nombre al añadir uno nuevo.
- Nuevo grupo pasa a ser el primer botón y la acción principal azul de Automatizaciones; Añadir ejemplo queda como acción secundaria.

- El guardado automático cuenta únicamente interacciones con controles y espera a terminar los arrastres; mover el ratón, pasar sobre campos, desplazar la página o pulsar el fondo no reinicia la espera.

- Guardado automático pasa a un interruptor al principio de Manual, Arrays, Fórmulas y Automatizaciones. Comparte la espera de 5 segundos sin actividad, conserva preferencias en sus JSON y protege las ediciones realizadas durante un guardado; Arrays omite contenido JSON inválido.

- Manual conserva la expansión individual y por grupo de cookies, overrides y generadores dentro del perfil y su JSON, con compatibilidad para los perfiles existentes.
- Manual añade un botón de guardado automático opcional por perfil: guarda cambios tras 5 segundos sin actividad, se puede desactivar y conserva las ediciones realizadas durante un guardado.

- Inputs / Generadores mantiene los avisos en Manual y el registro de errores sin abrir automáticamente Salida al aplicar, generar muestras, seleccionar elementos o resetear.

- El retraso predeterminado al elegir escritura secuencial pasa a 100 ms por tecla en Manual y Campo de Automatizaciones, conservando los valores de los documentos al cargarlos.

- Manual permite ordenar con drag and drop todas sus listas, incluidos los headers de cada override; conserva los valores e IDs y guarda el orden en el perfil. Incluye controles de teclado Alt+↑/↓ y mantiene el estado expandido de las filas.

- Manual mejora la separación visual de sus secciones con iconos, acentos y contadores; añade Expandir todos y Contraer todos a Cookies, Request Overrides e Inputs / Generadores sin aplicar datos al navegador.

- La licencia del proyecto cambia de MIT a Apache-2.0; se conservan las licencias y atribuciones de las dependencias.

- Manual mantiene un único botón Aplicar visible en las filas de campos, cookies y overrides, también al minimizarlas.
- Aplicar todos en Inputs / Generadores continúa tras errores de generación o escritura e informa de los campos fallidos sin borrar su configuración.
- Los selectores ausentes no dejan escrituras pendientes; Manual protege la aplicación de valores frente a envíos de formulario accidentales y mantiene la escritura ligada a acciones explícitas del usuario.
- Estos cambios conservan los perfiles v2 y la persistencia existente, sin reinicializar datos al actualizar.

- Documentación para IA es la quinta página de la navegación lateral: reúne guías copiables de Manual, Fórmulas, Arrays y Automatizaciones, con formatos y ejemplos JSON completos para pegar o importar.

- Automatizaciones añade Guardar dato para extraer la salida del nodo anterior a una variable, con rutas JSON y un ejemplo integrado de respuesta HTTP reutilizada en un campo.
- Guardar dato también permite leer campos, texto y atributos del DOM, seleccionar el tipo de dato y reutilizarlo en otros nodos; el ejemplo integrado demuestra estas lecturas.

- Manual permite usar texto fijo como origen de un campo.
- Automatizaciones unifica `Fill` y la generación directa en el nodo visible `Campo`, manteniendo compatibilidad con `Generate Value` en flujos anteriores.
- Manual y Automatizaciones comparten editores estructurados para query params, headers, cookies, storage y request overrides.
- Guardar, Ver JSON y Exportar automatizaciones aceptan borradores con nodos incompletos; Run e Importar mantienen validación estricta.
- Las ejecuciones abren automáticamente Output; Manual registra el inicio y resultado de sus acciones y muestra Output ante fallos, excepto en las acciones de Inputs / Generadores.

All notable changes to Browser Control Center are documented here.

## 0.4.0

- Added Manual profiles, reusable Formulas and Arrays.
- Added managed Chromium and isolated system Chrome providers.
- Added the visual Automations editor and execution engine.
- Added versioned import/export and editable JSON documents.
- Centralized application persistence through a typed DAO.
- Added progressive document-size protection, consistent dirty-state transitions and credential redaction.
- Hardened browser cleanup, CSP, keyboard canvas controls and High Contrast behavior.
