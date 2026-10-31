import { t } from "../../../../localization";
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { AutomationNode } from "../../../../domain/automations/automation";
import { DATA_ASSERTION_OPERATORS, DATA_ASSERTION_PATHS, DATA_ASSERTION_SOURCES, defaultDataAssertionPath, type DataAssertionOperator, type DataAssertionSource } from "../../../../domain/automations/dataAssertion";

const sourceLabels: Readonly<Record<DataAssertionSource, string>> = {
  request: t("text.observedRequest"),
  response: t("text.observedResponse"),
  cookie: t("labels.cookie"),
  localStorage: t("labels.localStorage"),
  sessionStorage: t("labels.sessionStorage")
};

const operatorLabels: Readonly<Record<DataAssertionOperator, string>> = {
  exists: t("text.exists"),
  "not-exists": t("text.doesNotExist"),
  equals: t("text.equals"),
  "not-equals": t("text.doesNotEqual"),
  contains: t("text.contains"),
  matches: t("text.matchesRegex"),
  "json-equals": t("text.equivalentJSON")
};

const pathLabels: Readonly<Record<string, string>> = {
  "": t("text.fullValue"),
  url: t("text.url"),
  method: t("text.httpMethod"),
  status: t("text.httpStatus"),
  "headers.content-type": t("text.contentTypeHeader"),
  "headers.authorization": t("text.authorizationHeader"),
  body: t("text.fullBody"),
  value: t("text.value"),
  domain: t("text.domain"),
  path: t("text.path"),
  expires: t("text.expiration"),
  httpOnly: t("text.httpOnly"),
  secure: t("labels.secure"),
  sameSite: t("text.samesite")
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
  const customPlaceholder = networkSource ? t("text.eGBodyUserIdOrHeadersXRequestId") : source === "cookie" ? t("text.eGSameSite") : t("text.eGUserProfileEmail");

  return html`
    <div class="inspector-fields data-validation-fields">
      <label><span>${t("text.source")}</span><select .value=${live(source)} @change=${(event: Event) => update((draft) => {
        const nextSource = valueFrom(event) as DataAssertionSource;
        draft.config.source = nextSource;
        draft.config.pathPreset = defaultDataAssertionPath(nextSource);
        draft.config.path = "";
      })}>${DATA_ASSERTION_SOURCES.map((value) => html`<option value=${value} .selected=${value === source}>${sourceLabels[value]}</option>`)}</select></label>

      ${networkSource ? html`<label><span>${t("text.urlContains")}</span><input .value=${live(stringField(node, "urlPattern"))} placeholder=${t("text.apiUsers")} @input=${(event: Event) => update((draft) => { draft.config.urlPattern = valueFrom(event); })}></label>` : html`<label><span>${source === "cookie" ? t("text.cookieName") : t("text.key")}</span><input .value=${live(stringField(node, "key"))} @input=${(event: Event) => update((draft) => { draft.config.key = valueFrom(event); })}></label>`}

      <label><span>${t("text.fieldToValidate")}</span><select .value=${live(selectedPath)} @change=${(event: Event) => update((draft) => {
        const selected = valueFrom(event);
        draft.config.pathPreset = selected;
        if (selected === "custom" && DATA_ASSERTION_PATHS[source].includes(stringField(draft, "path"))) draft.config.path = "";
      })}>${paths.map((path) => html`<option value=${path} .selected=${path === selectedPath}>${pathLabels[path] ?? path}</option>`)}<option value="custom" .selected=${selectedPath === "custom"}>${t("text.customPath")}</option></select></label>

      ${selectedPath === "custom" ? html`<label><span>${t("text.customPath2")}</span><input .value=${live(configuredPath)} placeholder=${customPlaceholder} @input=${(event: Event) => update((draft) => { draft.config.path = valueFrom(event); })}></label>` : nothing}

      <label><span>${t("text.operator")}</span><select .value=${live(operator)} @change=${(event: Event) => update((draft) => { draft.config.operator = valueFrom(event); })}>${DATA_ASSERTION_OPERATORS.map((value) => html`<option value=${value} .selected=${value === operator}>${operatorLabels[value]}</option>`)}</select></label>

      ${operator === "exists" || operator === "not-exists" ? nothing : html`<label class="wide"><span>${t("text.expectedValue")}</span><textarea rows="4" .value=${live(stringField(node, "expected"))} @input=${(event: Event) => update((draft) => { draft.config.expected = valueFrom(event); })}></textarea></label>`}
    </div>
    <p class="inspector-help">${t("text.toValidateTheJSONReturnedByAnOverrideSelect")} <strong>${t("text.observedResponse")}</strong>${t("text.filterItsURLChoose")} <strong>${t("text.fullBody")}</strong> ${t("text.andUse")} <strong>${t("text.equivalentJSON")}</strong>${t("text.toValidateASinglePropertyChoose")} <strong>${t("text.customPath2")}</strong> ${t("text.andEnterForExample")} <code>${t("text.bodyUserId")}</code>.</p>
  `;
};
