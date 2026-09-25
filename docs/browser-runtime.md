# Gestión de navegadores

La pantalla **Gestionar navegador** permite escoger el navegador que usarán Manual, Fórmulas y Automatizaciones. La selección se guarda en el estado versionado de la extensión y solo afecta a sesiones futuras.

## Navegadores disponibles

### Chromium administrado

Es la opción predeterminada y reproducible. La extensión instala la revisión compatible con su versión exacta de `playwright-core` dentro de:

```text
<globalStorageUri>/browser/binaries
```

`install.json` conserva la versión de Playwright, revisión requerida, versión real, ruta del ejecutable y fecha de verificación. Chromium no se descarga durante `npm install` ni se incluye en el VSIX.

Desde **Gestionar navegador** se puede instalar, verificar, reinstalar o eliminar. Estas acciones afectan exclusivamente a los binarios administrados y nunca a Google Chrome ni a los datos funcionales de la extensión.

### Google Chrome instalado

Esta opción usa el canal estable `chrome` de Playwright para localizar el Google Chrome instalado por el usuario. La extensión no lo instala, actualiza, desinstala ni modifica. **Verificar** realiza un arranque headless desechable y muestra la versión detectada.

Si Chrome no está instalado, su canal no es compatible o una política del equipo impide iniciarlo, aparecerá como no disponible. En ese caso se puede seguir usando Chromium administrado.

## Aislamiento del perfil personal

La extensión nunca abre el directorio `User Data`, el perfil predeterminado ni ningún perfil personal de Chrome. Todos los proveedores arrancan un proceso controlado por Playwright y crean un `BrowserContext` nuevo, no persistente y equivalente a una sesión de incógnito aislada.

Por tanto:

- no se leen ni se escriben cookies, historial, extensiones, contraseñas o sesiones personales;
- Manual crea un contexto limpio al iniciar o reiniciar;
- cada proceso de Automatizaciones obtiene una sesión independiente;
- las pruebas de Fórmulas usan un proceso headless desechable, sin red;
- al detener se cierran contexto y proceso, y se eliminan descargas temporales.

No se utiliza `launchPersistentContext` ni se proporciona `userDataDir`. Playwright documenta que los contextos no persistentes no escriben datos de navegación en disco y recomienda no automatizar el perfil principal de Chrome.

## Reinicio y limpieza

Los temporales propios de cada sesión viven en `browser/runtime/<session-id>`. **Reinicio limpio** cierra el contexto y el proceso actuales, elimina ese directorio y crea una sesión completamente nueva con el navegador seleccionado. **Detener** intenta un cierre normal y **Forzar cierre** mata el proceso si no responde. El comportamiento es el mismo para Chromium administrado y Chrome instalado.

Cambiar el selector de navegador detiene primero cualquier sesión visible de Manual para no reutilizar accidentalmente un proceso del proveedor anterior.

## Arquitectura extensible

Los adaptadores específicos viven en `src/infrastructure/browser/providers`:

- `ManagedChromiumProvider` resuelve el ejecutable administrado;
- `SystemChromeProvider` detecta el canal estable de Chrome;
- `BrowserBinaryManager` se ocupa únicamente del Chromium descargado por la extensión.

`BrowserSelectionService` conserva la selección y expone una configuración independiente de la UI. `BrowserLifecycleManager`, Manual, Fórmulas y Automatizaciones consumen esa configuración común y eligen el motor Playwright indicado. Para añadir otro navegador se incorpora un proveedor, se amplía el identificador de dominio y se registra en la composición; la lógica de sesión no necesita duplicarse.

## Diagnóstico

Consulta **Salida → Browser Automation**. El canal registra verificación, inicio, parada, errores y timeouts sin realizar capturas automáticas.

Estados habituales:

- **No disponible**: instala el navegador o selecciona otro proveedor.
- **Dañado**: el Chromium administrado no puede iniciarse; usa **Reinstalar**.
- **Incompatible**: la revisión administrada pertenece a otra versión de Playwright; usa **Reinstalar**.
- **Cerrado inesperadamente**: el proceso terminó fuera del ciclo normal; inicia una sesión nueva.

Referencias: [navegadores y canales de Playwright](https://playwright.dev/docs/browsers), [BrowserContext](https://playwright.dev/docs/api/class-browsercontext) y [BrowserType](https://playwright.dev/docs/api/class-browsertype).
