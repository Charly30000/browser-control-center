import { createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationDocument, type AutomationGroup, type AutomationNode, type AutomationNodeConfig, type AutomationNodeType, type AutomationProcess, type Point } from "./automation";
import { createCookie, createHeader, createRequestOverride, createStorageEntry } from "../manual/manualProfile";
import type { JsonValue } from "../manual/storageValue";

export const AUTOMATION_EXAMPLE_URL = "https://browser-control.test/demo";
export const AUTOMATION_EXAMPLE_API_URL = "https://browser-control.test/api/example";
const EXAMPLE_DOCUMENT_MARKER = "<title>Browser Control · Ejemplo local</title>";
const EXAMPLE_BOX_SIZING_RULE = "*, *::before, *::after { box-sizing: border-box; }";

const exampleHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Browser Control · Ejemplo local</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; color: #1f2937; background: #eef2ff; }
    main { width: min(680px, calc(100% - 32px)); margin: 48px auto; padding: 28px; border-radius: 14px; background: white; box-shadow: 0 12px 35px #312e8130; }
    h1 { margin-top: 0; color: #3730a3; }
    label { display: grid; gap: 6px; margin: 20px 0; font-weight: 600; }
    input, button { padding: 10px 12px; border: 1px solid #a5b4fc; border-radius: 7px; font: inherit; }
    button { color: white; background: #4f46e5; cursor: pointer; }
    .result { min-height: 24px; margin-top: 16px; padding: 12px; border-radius: 7px; background: #eef2ff; }
    code { overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>Ejemplo local de Automatizaciones</h1>
    <p>Esta página y su API han sido servidas por un nodo <strong>Request Override</strong>.</p>
    <label>Nombre <input id="name" autocomplete="off" placeholder="Escribe un nombre"></label>
    <button id="apply" type="button">Ejecutar ejemplo</button>
    <div id="result" class="result">Esperando interacción…</div>
    <div class="result">Respuesta API: <code id="api-result">pendiente</code></div>
    <div class="result">Storage: <code id="storage-result">pendiente</code></div>
    <div class="result">Viewport: <code id="viewport-result">pendiente</code></div>
  </main>
  <script>
    const nameInput = document.querySelector('#name');
    const result = document.querySelector('#result');
    const apiResult = document.querySelector('#api-result');
    const storageResult = document.querySelector('#storage-result');
    const updateViewportResult = () => {
      document.querySelector('#viewport-result').textContent = window.innerWidth + 'x' + window.innerHeight;
    };
    updateViewportResult();
    window.addEventListener('resize', updateViewportResult);
    requestAnimationFrame(updateViewportResult);
    document.querySelector('#apply').addEventListener('click', () => {
      result.textContent = 'Hola, ' + nameInput.value;
      storageResult.textContent = localStorage.getItem('exampleUser') + ' / ' + sessionStorage.getItem('exampleSession');
      window.setTimeout(async () => {
        try {
          const response = await fetch('/api/example', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: nameInput.value })
          });
          apiResult.textContent = JSON.stringify(await response.json());
        } catch (error) {
          apiResult.textContent = 'Error: ' + String(error);
        }
      }, 150);
    });
  </script>
</body>
</html>`;

const exampleApiBody = JSON.stringify({ success: true, source: "request-override", item: { id: 42 } });

const asJson = (value: unknown): JsonValue => structuredClone(value) as JsonValue;

const repairExampleHtml = (body: string): string => {
  if (!body.includes(EXAMPLE_DOCUMENT_MARKER) || body.includes(EXAMPLE_BOX_SIZING_RULE)) return body;
  return body.replace("<style>", `<style>\n    ${EXAMPLE_BOX_SIZING_RULE}`);
};

export const repairCompleteAutomationExamples = (document: AutomationDocument): AutomationDocument => {
  const repaired = structuredClone(document);
  for (const group of repaired.groups) {
    for (const process of group.processes) {
      for (const node of process.nodes) {
        if (node.type !== "request-override" || !Array.isArray(node.config.entries)) continue;
        node.config = {
          ...node.config,
          entries: node.config.entries.map((entry) => {
            if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
            return typeof entry.body === "string" ? { ...entry, body: repairExampleHtml(entry.body) } : entry;
          })
        };
      }
    }
  }
  return repaired;
};

const positionFor = (index: number): Point => {
  const row = Math.floor(index / 4);
  const offset = index % 4;
  const column = row % 2 === 0 ? offset : 3 - offset;
  return { x: 80 + column * 240, y: 70 + row * 130 };
};

type AddExampleNode = (type: AutomationNodeType, config: AutomationNodeConfig) => AutomationNode;

const createExampleProcess = (createId: () => string, name: string, configure: (add: AddExampleNode) => void) => {
  const process = createAutomationProcess(createId(), name);
  const nodes: AutomationNode[] = [];
  const add: AddExampleNode = (type, config) => {
    const node = createAutomationNode(createId(), type, positionFor(nodes.length));
    node.config = structuredClone(config);
    nodes.push(node);
    return node;
  };
  configure(add);
  process.nodes = nodes;
  process.edges = nodes.slice(1).map((node, index) => ({ id: createId(), sourceNodeId: nodes[index]?.id ?? "", sourcePort: "out", targetNodeId: node.id, targetPort: "in" }));
  return process;
};

const applyExampleViewport = (process: AutomationProcess): void => {
  process.viewport = { preset: "custom", width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true };
};

const applyExampleVariables = (process: AutomationProcess): void => {
  process.variables = { initialName: "Ada", expectedGreeting: "Hola, Ada" };
};

export const createCompleteAutomationExample = (createId: () => string): AutomationGroup => {
  const group = createAutomationGroup(createId(), "Ejemplos completos · sin Internet");

  const addOverrides = (add: AddExampleNode): void => {
    const pageOverride = { ...createRequestOverride(createId()), matcher: AUTOMATION_EXAMPLE_URL, contentType: "text/html; charset=utf-8", body: exampleHtml };
    const apiOverride = { ...createRequestOverride(createId()), matcher: AUTOMATION_EXAMPLE_API_URL, method: "POST" as const, contentType: "application/json; charset=utf-8", body: exampleApiBody };
    add("request-override", { entries: asJson([pageOverride, apiOverride]) });
  };
  const addNavigate = (add: AddExampleNode): void => { add("navigate", { url: AUTOMATION_EXAMPLE_URL }); };
  const addHeaders = (add: AddExampleNode): void => {
    const header = { ...createHeader(createId()), key: "x-example-header", value: "automation-demo" };
    add("set-headers", { entries: asJson([header]) });
  };
  const addCookie = (add: AddExampleNode): void => {
    const cookie = { ...createCookie(createId()), name: "example-cookie", value: "cookie-from-automation", domain: "browser-control.test", secure: true };
    add("set-cookies", { entries: asJson([cookie]) });
  };
  const addLocalStorage = (add: AddExampleNode): void => {
    const entry = { ...createStorageEntry(createId()), key: "exampleUser", value: "{\"name\":\"Ada\",\"role\":\"tester\"}", valueType: "json" as const };
    add("set-storage", { scope: "local", entries: asJson([entry]) });
  };
  const addSessionStorage = (add: AddExampleNode): void => {
    const entry = { ...createStorageEntry(createId()), key: "exampleSession", value: "ready" };
    add("set-storage", { scope: "session", entries: asJson([entry]) });
  };
  const addApiInteraction = (add: AddExampleNode, name: string): void => {
    add("fill", { selector: "#name", value: name, mode: "instant", delayMs: 0 });
    add("click", { selector: "#apply" });
    add("wait", { kind: "response", durationMs: 0, maxDurationMs: 0, selector: "", url: "/api/example", status: 200 });
    add("wait", { kind: "fixed", durationMs: 100, maxDurationMs: 100, selector: "", url: "", status: 0 });
  };
  const addDataValidations = (add: AddExampleNode, expectedName: string): void => {
    add("validate-data", { source: "request", urlPattern: "/api/example", key: "", pathPreset: "custom", path: "body.name", operator: "equals", expected: expectedName });
    add("validate-data", { source: "request", urlPattern: "/api/example", key: "", pathPreset: "custom", path: "headers.x-example-header", operator: "equals", expected: "automation-demo" });
    add("validate-data", { source: "response", urlPattern: "/api/example", key: "", pathPreset: "body", path: "", operator: "json-equals", expected: exampleApiBody });
    add("validate-data", { source: "cookie", urlPattern: "", key: "example-cookie", pathPreset: "value", path: "", operator: "equals", expected: "cookie-from-automation" });
    add("validate-data", { source: "localStorage", urlPattern: "", key: "exampleUser", pathPreset: "custom", path: "name", operator: "equals", expected: "Ada" });
    add("validate-data", { source: "sessionStorage", urlPattern: "", key: "exampleSession", pathPreset: "", path: "", operator: "equals", expected: "ready" });
  };
  const addProcess = (name: string, configure: (add: AddExampleNode) => void, configureProcess?: (process: AutomationProcess) => void): void => {
    const process = createExampleProcess(createId, name, configure);
    configureProcess?.(process);
    group.processes.push(process);
  };

  addProcess("01 · Viewport", (add) => { addOverrides(add); addNavigate(add); add("assertion", { kind: "text-equals", selector: "#viewport-result", expected: "390x844" }); }, applyExampleViewport);
  addProcess("02 · Variables iniciales", (add) => { addOverrides(add); addNavigate(add); add("fill", { selector: "#name", value: "{initialName}", mode: "instant", delayMs: 0 }); add("click", { selector: "#apply" }); add("assertion", { kind: "text-equals", selector: "#result", expected: "{expectedGreeting}" }); }, applyExampleVariables);
  addProcess("03 · Request Override", (add) => { addOverrides(add); addNavigate(add); add("assertion", { kind: "text-equals", selector: "h1", expected: "Ejemplo local de Automatizaciones" }); });
  addProcess("04 · Navigate", (add) => { addOverrides(add); addNavigate(add); add("assertion", { kind: "url-equals", selector: "", expected: AUTOMATION_EXAMPLE_URL }); });
  addProcess("05 · Click", (add) => { addOverrides(add); addNavigate(add); add("click", { selector: "#apply" }); add("assertion", { kind: "text-equals", selector: "#result", expected: "Hola, " }); });
  addProcess("06 · Campo con texto", (add) => { addOverrides(add); addNavigate(add); add("fill", { selector: "#name", generatorType: "string", value: "Ada", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 }); add("assertion", { kind: "value-equals", selector: "#name", expected: "Ada" }); });
  addProcess("07 · Campo con generador", (add) => { addOverrides(add); addNavigate(add); add("fill", { selector: "#name", generatorType: "firstName", value: "", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 }); add("assertion", { kind: "visible", selector: "#name", expected: "" }); });
  addProcess("08 · Set Headers", (add) => { addOverrides(add); addHeaders(add); addNavigate(add); addApiInteraction(add, "Ada"); add("validate-data", { source: "request", urlPattern: "/api/example", key: "", pathPreset: "custom", path: "headers.x-example-header", operator: "equals", expected: "automation-demo" }); });
  addProcess("09 · Set Cookies", (add) => { addOverrides(add); addCookie(add); addNavigate(add); add("validate-data", { source: "cookie", urlPattern: "", key: "example-cookie", pathPreset: "value", path: "", operator: "equals", expected: "cookie-from-automation" }); });
  addProcess("10 · Set Storage", (add) => { addOverrides(add); addNavigate(add); addLocalStorage(add); addSessionStorage(add); add("validate-data", { source: "localStorage", urlPattern: "", key: "exampleUser", pathPreset: "custom", path: "name", operator: "equals", expected: "Ada" }); add("validate-data", { source: "sessionStorage", urlPattern: "", key: "exampleSession", pathPreset: "", path: "", operator: "equals", expected: "ready" }); });
  addProcess("11 · Wait", (add) => { addOverrides(add); addNavigate(add); addApiInteraction(add, "Ada"); add("assertion", { kind: "text-equals", selector: "#api-result", expected: exampleApiBody }); });
  addProcess("12 · Assertion", (add) => { addOverrides(add); addNavigate(add); add("assertion", { kind: "text-equals", selector: "h1", expected: "Ejemplo local de Automatizaciones" }); });
  addProcess("13 · Validate Data", (add) => { addOverrides(add); addHeaders(add); addCookie(add); addNavigate(add); addLocalStorage(add); addSessionStorage(add); addApiInteraction(add, "Ada"); addDataValidations(add, "Ada"); });
  addProcess("14 · Extract Value", (add) => { addOverrides(add); addNavigate(add); add("extract-value", { selector: "h1", property: "textContent", attribute: "", outputVariable: "pageTitle" }); add("fill", { selector: "#name", value: "{pageTitle}", mode: "instant", delayMs: 0 }); add("assertion", { kind: "value-equals", selector: "#name", expected: "Ejemplo local de Automatizaciones" }); });
  addProcess("15 · Set Variable", (add) => { addOverrides(add); addNavigate(add); add("set-variable", { name: "exampleValue", value: "Ada" }); add("fill", { selector: "#name", value: "{exampleValue}", mode: "instant", delayMs: 0 }); add("assertion", { kind: "value-equals", selector: "#name", expected: "Ada" }); });
  addProcess("16 · Pause / Wait User", (add) => { addOverrides(add); addNavigate(add); add("wait-user", { message: "Inspecciona la página servida por el override y pulsa Continuar." }); });
  addProcess("17 · Todos concatenados", (add) => {
    addOverrides(add); addHeaders(add); addCookie(add); addNavigate(add); addLocalStorage(add); addSessionStorage(add);
    add("fill", { selector: "#name", value: "{initialName}", mode: "instant", delayMs: 0 });
    add("assertion", { kind: "value-equals", selector: "#name", expected: "{initialName}" });
    add("fill", { selector: "#name", generatorType: "firstName", value: "", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 });
    add("extract-value", { selector: "#name", property: "value", attribute: "", outputVariable: "demoName" });
    addApiInteraction(add, "{demoName}");
    add("assertion", { kind: "text-equals", selector: "#result", expected: "Hola, {demoName}" });
    addDataValidations(add, "{demoName}");
    add("extract-value", { selector: "#api-result", property: "textContent", attribute: "", outputVariable: "apiResult" });
    add("set-variable", { name: "exampleSummary", value: "Inicial: {initialName}; Nombre generado: {demoName}; API: {apiResult}" });
    add("wait-user", { message: "Revisa la página local, los nodos completados y pulsa Continuar para cerrar el ejemplo." });
  }, (process) => { applyExampleViewport(process); applyExampleVariables(process); });

  return group;
};
