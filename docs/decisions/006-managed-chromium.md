# ADR 006 — Chromium administrado fuera del VSIX

Se usa `playwright-core` con una revisión fijada de Chromium instalada en `globalStorageUri`. El VSIX contiene la biblioteca, pero nunca el navegador. Esto mantiene el paquete publicable, evita depender de Chrome/Edge del usuario y permite verificar, reinstalar o eliminar una instalación conocida.
