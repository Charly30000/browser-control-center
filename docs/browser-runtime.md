# Chromium administrado

## Ubicación

La extensión configura `PLAYWRIGHT_BROWSERS_PATH` hacia:

```text
<globalStorageUri>/browser/binaries
```

`install.json` conserva la versión de Playwright, revisión requerida, versión real, ruta del ejecutable y fecha de verificación. Los temporales de cada sesión viven en `browser/runtime/<session-id>` y se eliminan al detenerla.

## Instalar

Abre **Gestionar Chromium** desde la barra lateral y pulsa **Instalar**. La extensión ejecuta la CLI local de `playwright-core` con `install chromium`; no usa `npx` ni navegadores del sistema. El progreso es indeterminado salvo que la CLI proporcione un porcentaje real.

Tras descargar, se realiza un lanzamiento headless de verificación y se consulta la versión. Solo entonces el estado pasa a **Preparado**.

## Verificar, reinstalar y eliminar

- **Verificar** comprueba el ejecutable mediante un lanzamiento real.
- **Reinstalar** fuerza el cierre de cualquier sesión, elimina los binarios administrados, descarga y verifica de nuevo.
- **Eliminar** fuerza el cierre y borra exclusivamente `browser/binaries`, `browser/runtime` e `install.json`.

Estas acciones no eliminan perfiles, fórmulas ni arrays.

## Diagnóstico

Consulta **Salida → Browser Automation**. El canal registra instalación, verificación, inicio, parada, errores y timeouts sin realizar capturas de pantalla automáticas.

Estados habituales:

- **No instalado**: usa Instalar.
- **Dañado**: falta el ejecutable o no puede iniciarse; usa Reinstalar.
- **Incompatible**: la revisión pertenece a otra versión de Playwright; usa Reinstalar.
- **Cerrado inesperadamente**: el proceso terminó fuera del ciclo normal; inicia una sesión nueva.
