# Solución de problemas

## Chromium no está disponible

Abre **Gestionar navegador**, verifica la instalación y utiliza **Reinstalar** si la revisión no coincide con `playwright-core`. Los binarios están fuera del VSIX, en el almacenamiento global de la extensión.

## Chrome instalado no aparece

El proveedor usa el canal estable `chrome`. Comprueba que Google Chrome esté instalado para el usuario o selecciona Chromium administrado.

## El navegador quedó abierto

Utiliza **Force stop**. El cierre normal dispone de timeout y debería caer automáticamente a parada forzada. Si VS Code se cerró abruptamente, la siguiente ejecución no reutiliza el contexto anterior.

## No se puede importar un JSON

Comprueba que sea UTF-8, corresponda al área correcta, no supere 100 MiB y conserve los campos del envelope. Un archivo de otra pantalla se rechaza expresamente.

Los formatos antiguos compatibles se convierten automáticamente. Si el aviso indica una versión más nueva que la admitida, actualiza la extensión. No reduzcas `schemaVersion` ni sustituyas un documento por uno vacío para ocultar el error. Conserva el original y comparte el mensaje del aviso; una lectura o migración fallida no sobrescribe el archivo guardado.

## Un perfil, fórmula o array ya no aparece

Los selectores muestran solo elementos cuyos archivos guardados existen. Un borrador nuevo no es un recurso guardado hasta pulsar **Save** o completar un guardado automático tras editarlo. Si falta un archivo, importa una copia de seguridad y revisa las referencias de los campos que lo utilizaban.

Si falta todo el catálogo, comprueba que estás usando el mismo perfil de usuario de VS Code y la misma extensión instalada desde Marketplace. Los datos pertenecen a esa instalación; cambiar de publisher o de perfil de VS Code puede mostrar otro almacenamiento. No borres las carpetas anteriores: usa los archivos conservados o una exportación para recuperar la configuración. Véase [Perfiles](profiles.md).

## No sé qué navegador está seleccionado

Abre **Manage browser** y consulta **Active browser**. Su valor refleja la selección guardada. **Verify selected** comprueba su disponibilidad. Cambiarlo cierra la sesión actual de Manual y las sesiones nuevas usan el proveedor elegido; guarda la configuración antes de cambiar.

## Una fórmula no termina

El proceso aislado se elimina al alcanzar dos segundos. Revisa loops, promesas que no resuelven y excepciones en el panel **Salida → Browser Automation**.

## La automatización se detuvo

El Output identifica grupo, proceso y nodo. Las credenciales se redactan y no se generan screenshots. Un proceso fallido no impide que el grupo intente ejecutar los siguientes.
