import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { AutomationNode } from "../../../../domain/automations/automation";
import { DATA_ASSERTION_OPERATORS, DATA_ASSERTION_PATHS, DATA_ASSERTION_SOURCES, defaultDataAssertionPath, type DataAssertionOperator, type DataAssertionSource } from "../../../../domain/automations/dataAssertion";

const sourceLabels: Readonly<Record<DataAssertionSource, string>> = {
  request: "Request observada",
  response: "Response observada",
  cookie: "Cookie",
  localStorage: "localStorage",
  sessionStorage: "sessionStorage"
};

const operatorLabels: Readonly<Record<DataAssertionOperator, string>> = {
  exists: "Existe",
  "not-exists": "No existe",
  equals: "Es igual",
  "not-equals": "No es igual",
  contains: "Contiene",
  matches: "Coincide con regex",
  "json-equals": "JSON equivalente"
};

const pathLabels: Readonly<Record<string, string>> = {
  "": "Valor completo",
  url: "URL",
  method: "Método HTTP",
  status: "Estado HTTP",
  "headers.content-type": "Header Content-Type",
  "headers.authorization": "Header Authorization",
  body: "Body completo",
  value: "Valor",
  domain: "Dominio",
  path: "Path",
  expires: "Expiración",
  httpOnly: "HTTP only",
  secure: "Secure",
  sameSite: "SameSite"
};

const valueFrom = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.value : "";
};

const stringField = (node: AutomationNode, key: string): string => {
  const value = node.config[key];
  return typeof value === "string" ? value : "";
};

export const renderDataValidationInspector = (
  node: AutomationNode,
  update: (change: (node: AutomationNode) => void) => void
): TemplateResult => {
  const configuredSource = stringField(node, "source");
  const source = DATA_ASSERTION_SOURCES.includes(configuredSource as DataAssertionSource) ? configuredSource as DataAssertionSource : "request";
  const configuredPath = stringField(node, "path");
  const configuredPreset = node.config.pathPreset;
  const paths = DATA_ASSERTION_PATHS[source];
  const selectedPath = typeof configuredPreset === "string"
    ? configuredPreset
    : paths.includes(configuredPath) ? configuredPath : "custom";
  const operator = stringField(node, "operator") as DataAssertionOperator;
  const networkSource = source === "request" || source === "response";
  const customPlaceholder = networkSource ? "Ej.: body.user.id o headers.x-request-id" : source === "cookie" ? "Ej.: sameSite" : "Ej.: user.profile.email";

  return html`
    <div class="inspector-fields data-validation-fields">
      <label><span>Fuente</span><select .value=${live(source)} @change=${(event: Event) => update((draft) => {
        const nextSource = valueFrom(event) as DataAssertionSource;
        draft.config.source = nextSource;
        draft.config.pathPreset = defaultDataAssertionPath(nextSource);
        draft.config.path = "";
      })}>${DATA_ASSERTION_SOURCES.map((value) => html`<option value=${value} .selected=${value === source}>${sourceLabels[value]}</option>`)}</select></label>

      ${networkSource ? html`<label><span>La URL contiene</span><input .value=${live(stringField(node, "urlPattern"))} placeholder="/api/users" @input=${(event: Event) => update((draft) => { draft.config.urlPattern = valueFrom(event); })}></label>` : html`<label><span>${source === "cookie" ? "Nombre de cookie" : "Clave"}</span><input .value=${live(stringField(node, "key"))} @input=${(event: Event) => update((draft) => { draft.config.key = valueFrom(event); })}></label>`}

      <label><span>Campo que se validará</span><select .value=${live(selectedPath)} @change=${(event: Event) => update((draft) => {
        const selected = valueFrom(event);
        draft.config.pathPreset = selected;
        if (selected === "custom" && DATA_ASSERTION_PATHS[source].includes(stringField(draft, "path"))) draft.config.path = "";
      })}>${paths.map((path) => html`<option value=${path} .selected=${path === selectedPath}>${pathLabels[path] ?? path}</option>`)}<option value="custom" .selected=${selectedPath === "custom"}>Ruta personalizada…</option></select></label>

      ${selectedPath === "custom" ? html`<label><span>Ruta personalizada</span><input .value=${live(configuredPath)} placeholder=${customPlaceholder} @input=${(event: Event) => update((draft) => { draft.config.path = valueFrom(event); })}></label>` : nothing}

      <label><span>Operador</span><select .value=${live(operator)} @change=${(event: Event) => update((draft) => { draft.config.operator = valueFrom(event); })}>${DATA_ASSERTION_OPERATORS.map((value) => html`<option value=${value} .selected=${value === operator}>${operatorLabels[value]}</option>`)}</select></label>

      ${operator === "exists" || operator === "not-exists" ? nothing : html`<label class="wide"><span>Valor esperado</span><textarea rows="4" .value=${live(stringField(node, "expected"))} @input=${(event: Event) => update((draft) => { draft.config.expected = valueFrom(event); })}></textarea></label>`}
    </div>
    <p class="inspector-help">Para validar el JSON devuelto por un override, selecciona <strong>Response observada</strong>, filtra su URL, elige <strong>Body completo</strong> y usa <strong>JSON equivalente</strong>. Para validar solo una propiedad, elige <strong>Ruta personalizada</strong> e introduce, por ejemplo, <code>body.user.id</code>.</p>
  `;
};
