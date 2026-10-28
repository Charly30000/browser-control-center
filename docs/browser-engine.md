# Motor de navegador

La aplicación controla navegadores a través de `BrowserProvider`. Actualmente existen dos proveedores: Chromium administrado y Google Chrome instalado. Ambos se lanzan mediante `playwright-core`, crean contextos no persistentes y nunca utilizan el perfil personal del usuario.

`BrowserLifecycleManager` serializa inicio, reinicio y parada. Cada sesión dispone de un directorio temporal de descargas. El cierre normal tiene un timeout y cae a terminación forzada; la desactivación de la extensión espera la parada. Un cierre inesperado cambia el estado a `crashed` y limpia los datos temporales.

`BrowserPageRegistry` mantiene IDs estables para pestañas y popups. Los eventos actualizan URL y título, y un único temporizador compartido refresca títulos dinámicos. El registro es desechable y elimina listeners y temporizadores al detener o reiniciar.

Chromium se instala en `globalStorageUri/browser/binaries`, nunca dentro del repositorio ni del VSIX. Desde **Gestionar navegador** se puede verificar, eliminar y reinstalar. Véase también [browser-runtime.md](browser-runtime.md) para la guía de uso.
