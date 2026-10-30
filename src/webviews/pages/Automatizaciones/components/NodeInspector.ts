import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { NodeDescriptor } from "../../../../application/automations/nodeRegistry";
import type { AutomationNode } from "../../../../domain/automations/automation";
import { createCookie, createHeader, createQueryParam, createRequestOverride, createStorageEntry, DEFAULT_SEQUENTIAL_DELAY_MS, type CookieEntry, type HeaderEntry, type QueryParamEntry, type RequestOverrideEntry, type StorageEntry } from "../../../../domain/manual/manualProfile";
import { buildUrlWithQueryParams } from "../../../../domain/manual/queryParams";
import { isRequestOverrideEntry } from "../../../../domain/manual/requestOverride";
import type { JsonValue } from "../../../../domain/manual/storageValue";
import type { AutomationResourceCatalogs } from "../../../../shared/messages/automationMessages";
import { renderRequestOverrideEditor } from "../../../components/requestOverrideEditor";
import { renderCookieEditor, renderHeaderEditor, renderQueryParamEditor, renderStorageEditor } from "../../../components/sessionDataEditors";
import type { ConfirmDestructiveAction } from "../../../components/confirmDestructiveAction";
import { renderDataValidationInspector } from "./DataValidationInspector";

const valueFrom = (event: Event): string => { const target = event.currentTarget; return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.value : ""; };

const overrideEntries = (node: AutomationNode): RequestOverrideEntry[] => {
  const entries = node.config.entries;
  if (!Array.isArray(entries)) return [];
  const values: readonly unknown[] = entries;
  return values.filter(isRequestOverrideEntry).map((entry) => structuredClone(entry));
};

const updateOverrides = (node: AutomationNode, change: (entries: RequestOverrideEntry[]) => void): void => {
  const entries = overrideEntries(node);
  change(entries);
  node.config.entries = entries as unknown as JsonValue;
};

const collectionEntries = <T extends { readonly id: string }>(node: AutomationNode, key: string): T[] => {
  const entries = node.config[key];
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) && typeof entry.id === "string")
    .map((entry) => structuredClone(entry) as unknown as T);
};

const updateCollection = <T extends { readonly id: string }>(node: AutomationNode, key: string, change: (entries: T[]) => void): void => {
  const entries = collectionEntries<T>(node, key);
  change(entries);
  node.config[key] = entries;
};

export const renderNodeInspector = (
  node: AutomationNode | null,
  descriptor: NodeDescriptor | null,
  resources: AutomationResourceCatalogs,
  validationError: string | null,
  update: (change: (node: AutomationNode) => void) => void,
  selectElement: (fieldKey: string) => void,
  confirmDeletion: ConfirmDestructiveAction
): TemplateResult => {
  if (node === null || descriptor === null) return html`<section class="node-inspector"><h2>Inspector</h2><p class="empty-hint">Selecciona un nodo.</p></section>`;
  const field = (key: string): JsonValue | undefined => {
    const value = node.config[key];
    if (node.type === "capture-value" && value === undefined) {
      if (key === "source") return "previous";
      if (key === "property") return "value";
      if (key === "valueType") return "auto";
    }
    return node.type === "fill" && key === "generatorType" && value === undefined ? "string" : value;
  };
  const queryParams = collectionEntries<QueryParamEntry>(node, "queryParams");
  const composedUrl = node.type === "navigate" ? buildUrlWithQueryParams(typeof node.config.url === "string" ? node.config.url : "", queryParams) : null;
  return html`<section class="node-inspector"><header><div><h2>${descriptor.title}</h2><small>${node.id}</small></div><label>Timeout (ms)<input type="number" min="1" .value=${live(node.timeoutMs === null ? "" : String(node.timeoutMs))} placeholder=${String(descriptor.defaultTimeoutMs)} @change=${(event: Event) => update((draft) => { const raw = valueFrom(event); draft.timeoutMs = raw === "" ? null : Math.max(1, Number(raw)); })}></label></header>
    ${node.type === "request-override" ? html`
      <div class="inspector-overrides">
        ${renderRequestOverrideEditor(overrideEntries(node), {
          add: () => update((draft) => updateOverrides(draft, (entries) => { entries.push(createRequestOverride(crypto.randomUUID())); })),
          update: (id, change) => update((draft) => updateOverrides(draft, (entries) => { const entry = entries.find((item) => item.id === id); if (entry) change(entry); })),
          remove: (id) => update((draft) => updateOverrides(draft, (entries) => { const index = entries.findIndex((item) => item.id === id); if (index >= 0) entries.splice(index, 1); })),
          confirmDeletion
        })}
      </div>
    ` : node.type === "navigate" ? html`<div class="inspector-session-data">
      <label><span>URL base</span><input type="url" .value=${live(typeof node.config.url === "string" ? node.config.url : "")} @input=${(event: Event) => update((draft) => { draft.config.url = valueFrom(event); })}></label>
      <p class=${composedUrl?.ok ? "session-url-preview" : "inline-error"}>${composedUrl?.ok ? composedUrl.value : composedUrl?.error}</p>
      <h3>Query params</h3>
      ${renderQueryParamEditor(queryParams, {
        add: () => update((draft) => updateCollection<QueryParamEntry>(draft, "queryParams", (entries) => { entries.push(createQueryParam(crypto.randomUUID())); })),
        update: (id, change) => update((draft) => updateCollection<QueryParamEntry>(draft, "queryParams", (entries) => { const entry = entries.find((item) => item.id === id); if (entry) change(entry); })),
        remove: (id) => update((draft) => updateCollection<QueryParamEntry>(draft, "queryParams", (entries) => { const index = entries.findIndex((item) => item.id === id); if (index >= 0) entries.splice(index, 1); })),
        confirmDeletion
      })}
    </div>` : node.type === "set-headers" ? html`<div class="inspector-session-data">${renderHeaderEditor(collectionEntries<HeaderEntry>(node, "entries"), {
      add: () => update((draft) => updateCollection<HeaderEntry>(draft, "entries", (entries) => { entries.push(createHeader(crypto.randomUUID())); })),
      update: (id, change) => update((draft) => updateCollection<HeaderEntry>(draft, "entries", (entries) => { const entry = entries.find((item) => item.id === id); if (entry) change(entry); })),
      remove: (id) => update((draft) => updateCollection<HeaderEntry>(draft, "entries", (entries) => { const index = entries.findIndex((item) => item.id === id); if (index >= 0) entries.splice(index, 1); })),
      confirmDeletion
    })}</div>` : node.type === "set-cookies" ? html`<div class="inspector-session-data">${renderCookieEditor(collectionEntries<CookieEntry>(node, "entries"), {
      add: () => update((draft) => updateCollection<CookieEntry>(draft, "entries", (entries) => { entries.push(createCookie(crypto.randomUUID())); })),
      update: (id, change) => update((draft) => updateCollection<CookieEntry>(draft, "entries", (entries) => { const entry = entries.find((item) => item.id === id); if (entry) change(entry); })),
      remove: (id) => update((draft) => updateCollection<CookieEntry>(draft, "entries", (entries) => { const index = entries.findIndex((item) => item.id === id); if (index >= 0) entries.splice(index, 1); })),
      confirmDeletion
    })}</div>` : node.type === "set-storage" ? html`<div class="inspector-session-data">
      <label><span>Ámbito</span><select .value=${live(typeof node.config.scope === "string" ? node.config.scope : "local")} @change=${(event: Event) => update((draft) => { draft.config.scope = valueFrom(event); })}><option value="local">localStorage</option><option value="session">sessionStorage</option></select></label>
      ${renderStorageEditor(collectionEntries<StorageEntry>(node, "entries"), {
        add: () => update((draft) => updateCollection<StorageEntry>(draft, "entries", (entries) => { entries.push(createStorageEntry(crypto.randomUUID())); })),
        update: (id, change) => update((draft) => updateCollection<StorageEntry>(draft, "entries", (entries) => { const entry = entries.find((item) => item.id === id); if (entry) change(entry); })),
        remove: (id) => update((draft) => updateCollection<StorageEntry>(draft, "entries", (entries) => { const index = entries.findIndex((item) => item.id === id); if (index >= 0) entries.splice(index, 1); })),
        confirmDeletion
      })}
    </div>` : node.type === "validate-data" ? renderDataValidationInspector(node, update) : html`<div class="inspector-fields">${descriptor.inspectorFields.map((item) => {
      if (item.visibleWhen !== undefined) {
        const dependency = field(item.visibleWhen.key);
        if (typeof dependency !== "string" || !item.visibleWhen.values.includes(dependency)) return nothing;
      }
      const value = field(item.key);
      if (item.kind === "select") { const selected = typeof value === "string" ? value : ""; return html`<label><span>${item.label}</span><select .value=${live(selected)} @change=${(event: Event) => update((draft) => { const next = valueFrom(event); if (draft.type === "fill" && item.key === "mode" && next === "sequential" && draft.config.mode !== "sequential" && draft.config.delayMs === 0) draft.config.delayMs = DEFAULT_SEQUENTIAL_DELAY_MS; draft.config[item.key] = next; if (item.key === "generatorType") draft.config.resourceId = null; })}>${item.options?.map((option) => html`<option value=${option.value} .selected=${option.value === selected}>${option.label}</option>`)}</select></label>`; }
      if (item.kind === "textarea") return html`<label class="wide"><span>${item.label}</span><textarea rows="4" .value=${live(typeof value === "string" ? value : "")} @input=${(event: Event) => update((draft) => { draft.config[item.key] = valueFrom(event); })}></textarea></label>`;
      if (item.kind === "json") return html`<label class="wide"><span>${item.label}</span><textarea rows="4" .value=${live(JSON.stringify(value, null, 2) ?? "")} @change=${(event: Event) => update((draft) => { try { const parsed: unknown = JSON.parse(valueFrom(event)); if (parsed === null || typeof parsed === "string" || typeof parsed === "boolean" || typeof parsed === "number" || Array.isArray(parsed) || typeof parsed === "object") draft.config[item.key] = parsed as JsonValue; } catch { /* El documento conserva el último JSON válido. */ } })}></textarea></label>`;
      if (item.kind === "resource") {
        const generatorType = node.config.generatorType; const catalog = generatorType === "formula" ? resources.formulas : generatorType === "array" ? resources.arrays : [];
        const selected = typeof value === "string" ? value : "";
        return generatorType === "formula" || generatorType === "array" ? html`<label><span>${item.label}</span><select .value=${live(selected)} @change=${(event: Event) => update((draft) => { draft.config[item.key] = valueFrom(event) || null; })}><option value="" .selected=${selected === ""}>Selecciona…</option>${catalog.map((resource) => html`<option value=${resource.id} .selected=${resource.id === selected}>${resource.name}</option>`)}</select></label>` : nothing;
      }
      if (item.kind === "checkbox") return html`<label class="check"><input type="checkbox" .checked=${live(value === true)} @change=${(event: Event) => update((draft) => { draft.config[item.key] = event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked; })}><span>${item.label}</span></label>`;
      const inputText = value === undefined || value === null ? "" : typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? `${value}` : JSON.stringify(value) ?? "";
      if (item.key === "selector") return html`<label><span>${item.label}</span><span class="field-with-action"><input type="text" .value=${live(inputText)} @input=${(event: Event) => update((draft) => { draft.config[item.key] = valueFrom(event); })}><button title="Seleccionar el elemento en el navegador abierto" @click=${() => selectElement(item.key)}>Seleccionar</button></span></label>`;
      return html`<label><span>${item.label}</span><input type=${item.kind === "number" ? "number" : "text"} .value=${live(inputText)} @input=${(event: Event) => update((draft) => { const raw = valueFrom(event); draft.config[item.key] = item.kind === "number" ? Number(raw) : raw; })}></label>`;
    })}</div>`}
    ${node.timeoutMs !== null && !Number.isFinite(node.timeoutMs) ? html`<p class="inline-error">El timeout no es válido.</p>` : nothing}
    ${validationError === null ? nothing : html`<p class="inline-error">${validationError}</p>`}
  </section>`;
};
