# Estrategia de pruebas

La suite no descarga ni abre un navegador real. Usa adaptadores y dobles deterministas para cubrir:

| Área | Cobertura |
|---|---|
| Binarios | ausencia, versión requerida y borrado limitado a rutas administradas |
| Ciclo de vida | transiciones, contextos nuevos y limpieza de sesiones |
| Pestañas | registro por ID, selección, navegación, título y cierre |
| Configuración | headers, cookies y storage tipado |
| Overrides | exacto, glob, regex y método |
| Picker | prioridad de selectores estables y fallback CSS |
| Fórmulas | bloqueo de red y WebSocket, timeout y cierre forzado |
| Viewports | presets y migración v1 → v2 |
| Fases previas | perfiles, recursos, arrays, generadores y validaciones |

Comprobación completa:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

## Prueba manual de integración

Después de instalar Chromium desde la extensión:

1. abre `https://example.com` desde Manual;
2. comprueba inicio, parada, reinicio y pestañas emergentes;
3. aplica headers, cookies y storage sobre un entorno de pruebas controlado;
4. crea un override para una URL conocida;
5. usa **Seleccionar elemento** y aplica un generador;
6. ejecuta una fórmula normal y otra con `while (true) {}`;
7. confirma que la segunda termina por timeout y que el canal `Browser Automation` registra el evento.

No se hacen capturas de pantalla automáticas.
