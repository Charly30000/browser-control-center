import { html, type TemplateResult } from "lit";

const steps: readonly { readonly node: string; readonly explanation: string }[] = [
  { node: "Viewport", explanation: "Configura un viewport móvil de 390×844, táctil y con modo móvil; la propia página muestra y valida sus dimensiones." },
  { node: "Variables iniciales", explanation: "Define initialName y expectedGreeting antes de ejecutar; después las interpola en Fill y Assertion mediante {nombre}." },
  { node: "Request Override", explanation: "Sirve la página HTML y la respuesta JSON de la API desde la propia automatización." },
  { node: "Set Headers", explanation: "Añade x-example-header a las peticiones; más adelante Validate Data comprueba su valor." },
  { node: "Set Cookies", explanation: "Crea example-cookie para el dominio virtual antes de navegar." },
  { node: "Navigate", explanation: "Abre https://browser-control.test/demo. No realiza una descarga real porque el override responde primero." },
  { node: "Set Storage", explanation: "Guarda un objeto JSON en localStorage y un texto en sessionStorage." },
  { node: "Generate Value", explanation: "Genera un nombre y lo conserva en la variable demoName." },
  { node: "Fill", explanation: "Introduce {demoName} en el campo #name." },
  { node: "Click", explanation: "Pulsa el botón de la página, actualiza el DOM y dispara la petición POST de ejemplo." },
  { node: "Wait", explanation: "Espera la response de la API y después deja un breve margen para que la página actualice su resultado." },
  { node: "Assertion", explanation: "Comprueba que el texto visible sea “Hola, {demoName}”." },
  { node: "Validate Data", explanation: "Valida body y header de la request, JSON de la response, cookie, localStorage y sessionStorage." },
  { node: "Extract Value", explanation: "Lee el resultado JSON mostrado en #api-result y lo guarda en apiResult." },
  { node: "Set Variable", explanation: "Combina demoName y apiResult en la variable exampleSummary." },
  { node: "Pause / Wait User", explanation: "Mantiene Chromium abierto para inspeccionar el resultado; pulsa Continuar para finalizar." }
];

export const renderExampleGuide = (processName: string): TemplateResult => {
  const concatenated = processName.includes("Todos concatenados");
  const targetName = processName.includes("·") ? processName.split("·").slice(1).join("·").trim() : processName;
  const visibleSteps = concatenated ? steps : steps.filter(({ node }) => node === targetName);
  return html`
    <details class="example-guide" open>
      <summary>${concatenated ? "Cómo funciona el ejemplo concatenado" : `Ejemplo de ${targetName}`}</summary>
      <p>${concatenated
        ? "Este último proceso conecta todos los elementos de izquierda a derecha y continúa en zigzag por las filas."
        : "Este proceso se centra en un único elemento. Los demás nodos son el soporte mínimo necesario para preparar la página o comprobar automáticamente el resultado."} Todo se ejecuta sobre un dominio virtual interceptado, sin servidor externo ni acceso a Internet.</p>
      <ol>${visibleSteps.map(({ node, explanation }) => html`<li><strong>${node}</strong><span>${explanation}</span></li>`)}</ol>
    </details>
  `;
};
