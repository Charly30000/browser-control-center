import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { createHeader, type RequestOverrideEntry } from "../../domain/manual/manualProfile";
import type { ConfirmDestructiveAction } from "./confirmDestructiveAction";
import type { CollapsibleEntryState } from "./collapsibleEntryState";
import "./requestOverrideEditor.css";

export interface RequestOverrideEditorCallbacks {
  readonly add: () => void;
  readonly update: (id: string, change: (entry: RequestOverrideEntry) => void) => void;
  readonly remove: (id: string) => void;
  readonly confirmDeletion: ConfirmDestructiveAction;
  readonly apply?: (id: string) => void;
  readonly applyAll?: () => void;
  readonly expansion?: CollapsibleEntryState;
}

const controlValue = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.value : "";
};

const checkedValue = (event: Event): boolean => event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;

export const renderRequestOverrideEditor = (
  entries: readonly RequestOverrideEntry[],
  callbacks: RequestOverrideEditorCallbacks
): TemplateResult => html`
  <div class="request-override-editor">
    <div class="request-override-list">
      ${entries.map((override) => {
        const expanded = callbacks.expansion?.isOpen(override.id, true) ?? true;
        const apply = () => html`<button type="button" @click=${(event: Event) => { event.stopPropagation(); callbacks.apply?.(override.id); }}>Aplicar</button>`;
        return html`
        <details class="request-override-row" .open=${expanded} @toggle=${(event: Event) => callbacks.expansion?.toggle(override.id, true, event)}>
          <summary class=${!expanded && callbacks.apply !== undefined ? "has-collapsed-apply" : ""}>
            <span>${override.matcher || "Matcher sin definir"}</span>
            <small>${override.method} · ${override.action}</small>
            <span class=${override.enabled ? "override-enabled" : "override-disabled"}>${override.enabled ? "Activo" : "Inactivo"}</span>
            ${!expanded && callbacks.apply !== undefined ? apply() : nothing}
          </summary>
          <div class="request-override-grid">
            <label><span>Coincidencia</span><select .value=${live(override.matcherType)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.matcherType = controlValue(event) as RequestOverrideEntry["matcherType"]; })}><option value="exact" .selected=${override.matcherType === "exact"}>URL exacta</option><option value="glob" .selected=${override.matcherType === "glob"}>Glob</option><option value="regex" .selected=${override.matcherType === "regex"}>Regex</option></select></label>
            <label><span>Matcher</span><input .value=${live(override.matcher)} placeholder="https://example.com/api/**" @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.matcher = controlValue(event); })}></label>
            <label><span>Método</span><select .value=${live(override.method)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.method = controlValue(event) as RequestOverrideEntry["method"]; })}>${["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => html`<option value=${method} .selected=${method === override.method}>${method}</option>`)}</select></label>
            <label><span>Acción</span><select .value=${live(override.action)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.action = controlValue(event) as RequestOverrideEntry["action"]; })}><option value="fulfill" .selected=${override.action === "fulfill"}>Responder (fulfill)</option><option value="abort" .selected=${override.action === "abort"}>Cancelar (abort)</option><option value="continue-modified" .selected=${override.action === "continue-modified"}>Continuar modificada</option></select></label>
            <label><span>Status</span><input type="number" min="100" max="599" .value=${live(String(override.status))} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.status = Number(controlValue(event)); })}></label>
            <label><span>Content-Type</span><input .value=${live(override.contentType)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.contentType = controlValue(event); })}></label>
            <label class="override-wide"><span>Body</span><textarea rows="5" .value=${live(override.body)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.body = controlValue(event); })}></textarea></label>
          </div>
          <div class="request-override-headers">
            <h4>Headers de respuesta</h4>
            ${override.headers.map((header) => html`
              <div class="request-override-header-row">
                <input aria-label="Clave" placeholder="Key" .value=${live(header.key)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { const current = entry.headers.find(({ id }) => id === header.id); if (current) current.key = controlValue(event); })}>
                <input aria-label="Valor" placeholder="Value" .value=${live(header.value)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { const current = entry.headers.find(({ id }) => id === header.id); if (current) current.value = controlValue(event); })}>
                <label class="override-check"><input type="checkbox" .checked=${live(header.enabled)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { const current = entry.headers.find(({ id }) => id === header.id); if (current) current.enabled = checkedValue(event); })}><span>Activo</span></label>
                <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: "¿Eliminar este header del override?" })) callbacks.update(override.id, (entry) => { entry.headers = entry.headers.filter(({ id }) => id !== header.id); }); }}>Eliminar</button>
              </div>
            `)}
            <button class="override-add-header" @click=${() => callbacks.update(override.id, (entry) => { entry.headers.push(createHeader(crypto.randomUUID())); })}>+ Añadir header</button>
          </div>
          <div class="request-override-actions">
            <label class="override-check"><input type="checkbox" .checked=${live(override.enabled)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.enabled = checkedValue(event); })}><span>Activo</span></label>
            ${expanded && callbacks.apply !== undefined ? apply() : nothing}
            <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: `¿Eliminar el override «${override.matcher || "sin matcher"}»?`, detail: "La regla dejará de formar parte de la configuración." })) callbacks.remove(override.id); }}>Eliminar</button>
          </div>
        </details>
      `; })}
      ${entries.length === 0 ? html`<p class="request-override-empty">No hay overrides.</p>` : nothing}
    </div>
    <div class="request-override-toolbar">
      <button @click=${callbacks.add}>+ Añadir override</button>
      ${callbacks.applyAll === undefined ? nothing : html`<button @click=${callbacks.applyAll}>Aplicar todos</button>`}
    </div>
  </div>
`;
