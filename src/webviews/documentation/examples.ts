import { createArrayResource } from "../../domain/arrays/arrayResource";
import { createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationNodeConfig, type AutomationNodeType } from "../../domain/automations/automation";
import { createFormula } from "../../domain/formulas/formula";
import { createImportExportDocument } from "../../domain/importExport/importExportDocument";
import { createManualProfileBundle } from "../../domain/importExport/manualProfileBundle";
import { createEmptyManualProfile, createGeneratorBinding, createRequestOverride } from "../../domain/manual/manualProfile";

const timestamp = "2026-01-01T00:00:00.000Z";
const exampleUrl = "https://example.test/form";
const exampleHtml = '<!doctype html><html><head><meta charset="utf-8"><title>Formulario de prueba</title></head><body><h1>Formulario de prueba</h1><label>Nombre <input id="name"></label><label>Copia <input id="copy"></label><label>Email <input id="email"></label><label>Ciudad <input id="city"></label><p id="result">Preparado</p><pre id="payload">{"item":{"id":42}}</pre><button id="apply" type="button">Continuar</button></body></html>';

export const documentationFormula = { ...createFormula("formula-example", "Email de prueba", timestamp), preferences: { autoSaveEnabled: false }, code: 'function generate() {\n  return "usuario" + Math.floor(Math.random() * 10000) + "@example.test";\n}' };
export const documentationArray = { ...createArrayResource("array-example", "Ciudades de prueba", timestamp), preferences: { autoSaveEnabled: false }, items: ["Madrid", "Sevilla", "Valencia"] };
const pageOverride = { ...createRequestOverride("override-page"), matcherType: "glob" as const, matcher: `${exampleUrl}*`, contentType: "text/html; charset=utf-8", body: exampleHtml, headers: [] };
const profile = createEmptyManualProfile("manual-example", "Formulario local de prueba", timestamp);
profile.url = exampleUrl;
profile.preferences = { autoSaveEnabled: false };
profile.requestOverrides = [pageOverride];
profile.generatorBindings = [
  { ...createGeneratorBinding("binding-name"), selector: "#name", literalValue: "Ada", expanded: true },
  { ...createGeneratorBinding("binding-email"), selector: "#email", generatorType: "formula", resourceId: documentationFormula.id },
  { ...createGeneratorBinding("binding-city"), selector: "#city", generatorType: "array", resourceId: documentationArray.id }
];
export const manualDocumentationExample = createImportExportDocument("browser-control-center/manual-profile", createManualProfileBundle(profile, { formulas: [documentationFormula], arrays: [documentationArray] }), timestamp);
export const formulaDocumentationExample = createImportExportDocument("browser-control-center/formulas", [documentationFormula], timestamp);
export const arrayDocumentationExample = createImportExportDocument("browser-control-center/arrays", [documentationArray], timestamp);

export interface DocumentedNode {
  readonly type: AutomationNodeType;
  readonly usage: string;
  readonly config: AutomationNodeConfig;
}

const documentedNode = (type: AutomationNodeType, usage: string, overrides: AutomationNodeConfig = {}): DocumentedNode => ({
  type, usage, config: { ...createAutomationNode("reference", type, { x: 0, y: 0 }).config, ...overrides }
});

export const documentedNodes: readonly DocumentedNode[] = [
  documentedNode("navigate", "Navigate: abre una URL, compuesta con las filas queryParams activas. La query de la URL base se reemplaza.", { url: exampleUrl }),
  documentedNode("click", "Click: pulsa el primer elemento que coincida con el selector CSS.", { selector: "#apply" }),
  documentedNode("fill", "Campo: introduce texto fijo o un valor generado en un input/textarea. generatorType: string, firstName, lastName, email, phone, number, dni, nie, cif, formula o array. Para string usa value; para number, min/max en texto; para formula/array, un resourceId guardado. mode: instant o sequential; delayMs en milisegundos.", { selector: "#name", value: "Ada" }),
  documentedNode("generate-value", "Generate Value: nodo antiguo compatible pero oculto en la paleta. Genera y guarda outputVariable. Para flujos nuevos utiliza Campo y Guardar dato.", { outputVariable: "generatedName" }),
  documentedNode("set-headers", "Set Headers: establece los headers del contexto para solicitudes posteriores. entries usa filas de headers; una lista vacía los limpia."),
  documentedNode("set-cookies", "Set Cookies: añade cookies activas; dominio sin protocolo. Si queda vacío, navega antes para disponer de una URL."),
  documentedNode("set-storage", "Set Storage: escribe entries en localStorage (scope local) o sessionStorage (scope session) de la página actual. Navega antes al origen correcto."),
  documentedNode("request-override", "Request Override: instala las reglas de entries antes de la acción que produce la petición. Cada ejecución de este nodo reemplaza las reglas anteriores.", { entries: [pageOverride] }),
  documentedNode("wait", "Wait: kind fixed (durationMs), random (durationMs a maxDurationMs), element (selector visible), url (url patrón de Playwright), navigation (carga completa) o response (url contiene y status; 0 acepta cualquiera). response espera una respuesta futura: debe estar escuchando antes de que llegue. Devuelve url, status, headers y body; body es JSON parseado o texto. Los demás tipos no devuelven datos."),
  documentedNode("assertion", "Assertion: kind exists, visible, text-equals, value-equals, url-equals o response-status. expected siempre es texto. response-status comprueba la última respuesta observada; url-equals usa igualdad de URL completa.", { kind: "value-equals", selector: "#name", expected: "Ada" }),
  documentedNode("validate-data", "Validate Data: consulta request, response, cookie, localStorage o sessionStorage. Red: urlPattern es un filtro por contenido y se usa la última coincidencia observada. Cookie/storage: key identifica el nombre. pathPreset custom hace que se use path; por ejemplo body.item.id. operator: exists, not-exists, equals, not-equals, contains, matches o json-equals. expected es texto, incluso para números y JSON. No guarda variables.", { source: "response", urlPattern: "/api/", pathPreset: "custom", path: "body.item.id", operator: "equals", expected: "42" }),
  documentedNode("extract-value", "Extract Value: lee del DOM value, textContent, innerText o attribute y guarda outputVariable. Para attribute indica attribute. También ofrece su resultado al nodo siguiente.", { selector: "#name", property: "value", outputVariable: "nameFromPage" }),
  documentedNode("set-variable", "Set Variable: guarda value en name; value puede ser cualquier valor JSON. El nombre se escribe sin llaves; también ofrece el dato al nodo siguiente.", { name: "greeting", value: "Hola" }),
  documentedNode("capture-value", "Guardar dato: source previous lee la salida del único predecesor conectado; source dom lee selector y property value, textContent, innerText o attribute (con attribute). path vacío guarda todo; body.item.id o items.0.id recorre JSON y también texto JSON. valueType: auto, string, number, boolean, json o null. La ruta se aplica antes de convertir; una conversión inválida falla. outputVariable sin llaves. Un atributo inexistente produce null; un campo DOM produce texto salvo conversión.", { source: "dom", selector: "#payload", property: "textContent", path: "item.id", valueType: "number", outputVariable: "itemId" }),
  documentedNode("wait-user", "Pause / Wait User: muestra message y espera intervención manual, con Continuar, Reintentar o Detener. Útil para login, CAPTCHA, 2FA y OAuth. No intenta resolverlos automáticamente.", { message: "Completa el acceso y pulsa Continuar." })
];

const automation = createAutomationDocument("automation-example", timestamp);
automation.name = "Copiar datos desde el DOM";
automation.preferences = { autoSaveEnabled: false };
const group = createAutomationGroup("group-example", "Ejemplo sin Internet");
const process = createAutomationProcess("process-example", "Capturar y reutilizar datos");
const addNode = (type: AutomationNodeType, config: AutomationNodeConfig): void => {
  const index = process.nodes.length;
  const node = createAutomationNode(`node-${index + 1}`, type, { x: 80 + (index % 4) * 260, y: 80 + Math.floor(index / 4) * 150 });
  node.config = { ...node.config, ...config };
  process.nodes.push(node);
};
addNode("request-override", { entries: [pageOverride] });
addNode("navigate", { url: exampleUrl });
addNode("fill", { selector: "#name", value: "Ada" });
addNode("capture-value", { source: "dom", selector: "#name", property: "value", valueType: "string", outputVariable: "savedName" });
addNode("fill", { selector: "#copy", value: "{savedName}" });
addNode("assertion", { kind: "value-equals", selector: "#copy", expected: "Ada" });
addNode("capture-value", { source: "dom", selector: "#payload", property: "textContent", path: "item.id", valueType: "number", outputVariable: "itemId" });
addNode("fill", { selector: "#copy", value: "ID: {itemId}" });
addNode("assertion", { kind: "value-equals", selector: "#copy", expected: "ID: 42" });
process.edges = process.nodes.slice(1).map((node, index) => ({ id: `edge-${index + 1}`, sourceNodeId: process.nodes[index]!.id, sourcePort: "out", targetNodeId: node.id, targetPort: "in" }));
group.processes = [process];
group.expanded = true;
automation.groups = [group];
export const automationDocumentationExample = createImportExportDocument("browser-control-center/automations", automation, timestamp);
