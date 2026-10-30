# Changelog

## Sin publicar

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
- Las ejecuciones abren automáticamente Output; Manual registra el inicio y resultado de sus acciones y muestra Output ante fallos.

All notable changes to Browser Control Center are documented here.

## 0.4.0

- Added Manual profiles, reusable Formulas and Arrays.
- Added managed Chromium and isolated system Chrome providers.
- Added the visual Automations editor and execution engine.
- Added versioned import/export and editable JSON documents.
- Centralized application persistence through a typed DAO.
- Added progressive document-size protection, consistent dirty-state transitions and credential redaction.
- Hardened browser cleanup, CSP, keyboard canvas controls and High Contrast behavior.
