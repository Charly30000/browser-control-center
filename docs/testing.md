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
| Automatizaciones | schema, persistencia íntegra de la configuración de todos los nodos, validación, registro de nodos, grafos, variables y ejecución secuencial |
| Confirmaciones | composición del mensaje y respeto de las respuestas de aceptación y cancelación antes de eliminar |
| Importación/exportación | envelope y versiones, formatos incompatibles, IDs repetidos, colisiones de ID/nombre y reparación de conexiones importadas |
| Persistencia central | contratos DAO tipados, codecs de cada entidad, CRUD y conservación de rutas y claves de almacenamiento |
| Validación de datos | rutas anidadas, existencia, regex, JSON y fuentes de red/storage/cookies |
| Flow Canvas | selección, coordenadas, estado de conexión sugerida, confirmación/cancelación, copy/paste con IDs reparados, undo y redo |
| Control de ejecución | estados, timeout, pausa, cancelación, stop y force stop |
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
8. crea un grupo y un proceso en **Automatizaciones**, conecta `Navigate` con `Assertion` y ejecuta el proceso;
9. comprueba que el primer clic sobre cada card no altera su posición y que puede arrastrarse después;
10. arrastra desde la salida de una card hasta la entrada o el cuerpo de otra, comprueba la flecha y elimina la conexión mediante su `×`;
11. prueba el marco de selección en ambas direcciones y confirma que desaparece al soltar dejando seleccionadas las cards incluidas;
12. prueba copy/paste, undo/redo, zoom mediante `−/+`, zoom con la rueda y movimiento del canvas;
13. verifica pausa, espera de usuario, stop, force stop y ejecución secuencial de un grupo.
14. configura `Validate Data` con **Body completo** y **JSON equivalente**, guarda y vuelve a seleccionarlo; confirma que ambos desplegables conservan visualmente esos valores.
15. repite el guardado con los desplegables, recursos, campos de texto, JSON y checkboxes de los demás tipos de nodo y comprueba que el inspector muestra la configuración guardada.
16. intenta eliminar un grupo, proceso y una fila de Manual; cancela el diálogo modal de VS Code y confirma que nada cambia, después acepta y comprueba la eliminación.
17. selecciona un nodo y elimínalo con su botón `×`; elimina también un nodo con `Supr` y una conexión con su `×`. Estas acciones no deben pedir confirmación y deben poder recuperarse con **Deshacer**.

La suite unitaria no abre VS Code ni hace capturas. Para regresiones de Pointer Events se usa una instancia aislada de `Extension Development Host` y se verifican posiciones, SVG, zoom, selección y errores de consola desde el protocolo de depuración de Chromium.
