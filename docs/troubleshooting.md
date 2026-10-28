# Solución de problemas

## Chromium no está disponible

Abre **Gestionar navegador**, verifica la instalación y utiliza **Reinstalar** si la revisión no coincide con `playwright-core`. Los binarios están fuera del VSIX, en el almacenamiento global de la extensión.

## Chrome instalado no aparece

El proveedor usa el canal estable `chrome`. Comprueba que Google Chrome esté instalado para el usuario o selecciona Chromium administrado.

## El navegador quedó abierto

Utiliza **Force stop**. El cierre normal dispone de timeout y debería caer automáticamente a parada forzada. Si VS Code se cerró abruptamente, la siguiente ejecución no reutiliza el contexto anterior.

## No se puede importar un JSON

Comprueba que sea UTF-8, corresponda al área correcta, no supere 100 MiB y conserve los campos del envelope. Un archivo de otra pantalla se rechaza expresamente.

## Una fórmula no termina

El proceso aislado se elimina al alcanzar dos segundos. Revisa loops, promesas que no resuelven y excepciones en el panel **Salida → Browser Automation**.

## La automatización se detuvo

El Output identifica grupo, proceso y nodo. Las credenciales se redactan y no se generan screenshots. Un proceso fallido no impide que el grupo intente ejecutar los siguientes.
