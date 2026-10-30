<p align="center">
  <img src="resources/marketplace-icon.png" alt="Icono de Browser Control Center" width="96" height="96">
</p>

<h1 align="center">Browser Control Center</h1>

<p align="center">
  <strong>Prepara datos, controla el navegador y automatiza tus pruebas web desde VS Code.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=leviax.browser-control-center"><strong>Instalar desde Marketplace</strong></a>
  ·
  <a href="https://github.com/Charly30000/browser-control-center">Ver en GitHub</a>
  ·
  <a href="https://github.com/Charly30000/browser-control-center/issues">Reportar un problema</a>
</p>

---

Rellenar formularios, preparar cookies, cambiar datos y repetir el mismo recorrido puede ocupar más tiempo que la propia prueba. **Browser Control Center** reúne esas tareas en un panel dentro de tu editor: prepara una sesión, genera datos y guarda lo que necesitas para volver a utilizarlo.

Empieza con una prueba manual o conecta los pasos en un flujo visual. Puedes trabajar con **Chrome instalado o Chromium administrado**, en sesiones aisladas de tu navegador personal.

## Lo que puedes hacer

- **Rellenar formularios con datos de prueba.** Usa texto fijo, nombres, emails, teléfonos, números, DNI, NIE o CIF, además de tus propias fórmulas y listas de valores.
- **Preparar la sesión que necesitas.** Configura URL, parámetros, headers, cookies, localStorage y sessionStorage. Prueba distintos tamaños de pantalla, incluidos móvil y tablet.
- **Simular respuestas de una API.** Intercepta peticiones para devolver un JSON, modificar datos o reproducir errores sin cambiar el servidor.
- **Crear automatizaciones visuales.** Conecta navegación, campos, clicks, esperas y comprobaciones. Organiza tus recorridos en grupos y procesos reutilizables.
- **Capturar y reutilizar información.** Lee campos, texto o atributos del DOM, extrae propiedades JSON y guarda valores en variables para los siguientes pasos.
- **Compartir tu trabajo en JSON.** Importa y exporta perfiles, recursos y automatizaciones, o edítalos desde **Ver JSON**.

## Cinco espacios para tu trabajo

| Sección | Para qué sirve |
| --- | --- |
| **Manual** | Preparar una sesión, elegir elementos de la página y aplicar valores cuando tú decidas. |
| **Fórmulas** | Crear generadores JavaScript reutilizables con `function generate()`. |
| **Arrays** | Guardar listas JSON y escoger valores aleatorios para tus pruebas. |
| **Automatizaciones** | Diseñar y ejecutar flujos con nodos, variables y comprobaciones. |
| **Documentación para IA** | Copiar una guía de la aplicación para pedir ayuda y generar JSON adaptado a tu caso. |

## Empieza en unos pasos

1. **[Instala Browser Control Center desde la tienda de VS Code](https://marketplace.visualstudio.com/items?itemName=leviax.browser-control-center).**
2. Abre su icono en la barra lateral y pulsa **Gestionar navegador**. Selecciona tu Chrome instalado o instala Chromium administrado desde ese panel.
3. En **Manual**, prepara un perfil, indica la URL y pulsa **Abrir**. Añade un campo y utiliza **Seleccionar elemento** para elegir su destino en la página.
4. Elige el dato que quieres introducir y pulsa **Aplicar**. Guarda el perfil para reutilizar su configuración.

También puedes instalarla desde la terminal:

```sh
code --install-extension leviax.browser-control-center
```

Necesitas **VS Code de escritorio 1.90 o superior**. El navegador se configura por separado: no viene incluido en la descarga de la extensión.

## Prueba primero, automatiza después

### Manual: tú decides cuándo aplicar

Prepara valores, genera muestras y aplícalos a un campo o a todos los campos activos. **Aplicar** sigue accesible cuando minimizas una fila. Si un campo falla, **Aplicar todos** continúa con los demás y te indica qué ha ocurrido.

Cargar o editar un perfil no rellena automáticamente los formularios. La escritura asistida protege frente a envíos accidentales durante la aplicación; tú decides cuándo enviar el formulario de la página.

### Automatizaciones: conecta los pasos

Convierte un recorrido repetido en un flujo visual. Por ejemplo:

```text
Abrir página → Rellenar campo → Guardar dato → Reutilizar variable → Comprobar resultado
```

El nodo **Guardar dato** permite leer un campo o extraer una propiedad como `item.id` de un JSON y guardarla en una variable. Después puedes utilizar `{itemId}` en otro nodo.

Para empezar sin preparar una web, pulsa **Añadir ejemplo** en Automatizaciones. Encontrarás procesos ya conectados con una página y una API simuladas: **los ejemplos no necesitan un servidor externo ni acceso a Internet**. Algunos incluyen una pausa para que puedas inspeccionar el navegador y pulsar **Continuar**.

Cada proceso se ejecuta en una sesión limpia. Puedes pausar el recorrido, detenerlo o añadir una espera para completar manualmente un login, un CAPTCHA o una verificación en dos pasos.

## Pide ayuda a tu IA y pega el resultado

El quinto botón lateral, **Documentación para IA**, reúne las instrucciones de uso, las opciones y los formatos JSON que acepta la aplicación.

1. Abre esa página y pulsa **Copiar documentación**.
2. Pégala en tu chat y describe qué quieres preparar. Si vas a modificar algo existente, añade también su documento de **Ver JSON**.
3. Pide el documento JSON completo para el perfil, recurso o flujo que necesitas.
4. Pégalo en **Ver JSON**, pulsa **Aplicar cambios**, revisa el resultado y después **Guardar**.

También puedes guardar el documento en un archivo e **Importar**. En Fórmulas puedes pedir solo el código para su editor; en Arrays, solo la lista JSON. Los selectores deben corresponder a tu página y las referencias a recursos deben existir en tu catálogo.

## Guarda la configuración, empieza con una sesión limpia

Los perfiles, fórmulas, arrays y automatizaciones guardados quedan disponibles para reutilizarlos. Exportarlos te permite compartirlos o llevarlos a otra instalación; los perfiles Manual incluyen las fórmulas y arrays que utilizan.

Las sesiones de navegador son independientes de tu perfil personal y no se conservan al cerrarlas. Las fórmulas se prueban en un navegador aislado, sin red y con un límite de ejecución de dos segundos.

Si una acción falla, consulta **Salida → Browser Automation** para ver el detalle.

## Guías y comunidad

- **Uso:** [Manual](docs/manual-page.md), [Automatizaciones](docs/automations-page.md), [Fórmulas](docs/formulas.md) y [Arrays](docs/arrays-page.md).
- **Configuración y datos:** [navegadores](docs/browser-runtime.md), [importación y exportación](docs/import-export.md) y [resolución de problemas](docs/troubleshooting.md).
- **Desarrollo:** [guía de desarrollo](docs/development.md), [arquitectura](docs/architecture.md) y [pruebas](docs/testing.md).
- **Proyecto:** [repositorio en GitHub](https://github.com/Charly30000/browser-control-center), [novedades](CHANGELOG.md) y [errores o propuestas](https://github.com/Charly30000/browser-control-center/issues).

¿Has encontrado un fallo o tienes una idea para mejorar tus pruebas? [Cuéntalo en GitHub](https://github.com/Charly30000/browser-control-center/issues).

## Licencia

Copyright 2026 Andres Manuel Armesto Fernández. Distribuido bajo [Apache License 2.0](LICENSE). Consulta las licencias y atribuciones de las dependencias en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
