import { t } from "../../localization";
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { renderRowDragHandle, reorderableRow, type RowReorderOptions } from "./rowReorder";
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
  readonly reorder?: RowReorderOptions;
  readonly reorderHeaders?: (overrideId: string) => RowReorderOptions;
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
      ${repeat(entries, (override) => override.id, (override) => {
        const expanded = callbacks.expansion?.isOpen(override.id, true) ?? true;
        const headerReorder = callbacks.reorderHeaders?.(override.id);
        const apply = () => html`<button type="button" @click=${(event: Event) => { event.stopPropagation(); callbacks.apply?.(override.id); }}>${t("actions.apply")}</button>`;
        return html`
        <details class="request-override-row" ${reorderableRow(callbacks.reorder, override.id)} .open=${expanded} @toggle=${(event: Event) => callbacks.expansion?.toggle(override.id, true, event)}>
          <summary class=${!expanded && callbacks.apply !== undefined ? "has-collapsed-apply" : ""}>
            ${renderRowDragHandle(callbacks.reorder, override.id, override.matcher || "override")}
            <span>${override.matcher || t("text.noMatcherDefined")}</span>
            <small>${override.method} · ${override.action}</small>
            <span class=${override.enabled ? "override-enabled" : "override-disabled"}>${override.enabled ? t("text.enabled") : t("text.disabled")}</span>
            ${!expanded && callbacks.apply !== undefined ? apply() : nothing}
          </summary>
          <div class="request-override-grid">
            <label><span>${t("text.matchType")}</span><select .value=${live(override.matcherType)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.matcherType = controlValue(event) as RequestOverrideEntry["matcherType"]; })}><option value="exact" .selected=${override.matcherType === "exact"}>${t("text.exactURL")}</option><option value="glob" .selected=${override.matcherType === "glob"}>${t("text.glob")}</option><option value="regex" .selected=${override.matcherType === "regex"}>${t("text.regex")}</option></select></label>
            <label><span>${t("text.matcher")}</span><input .value=${live(override.matcher)} placeholder=${t("text.httpsExampleComApi")} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.matcher = controlValue(event); })}></label>
            <label><span>${t("text.method")}</span><select .value=${live(override.method)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.method = controlValue(event) as RequestOverrideEntry["method"]; })}>${["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => html`<option value=${method} .selected=${method === override.method}>${method}</option>`)}</select></label>
            <label><span>${t("text.action")}</span><select .value=${live(override.action)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.action = controlValue(event) as RequestOverrideEntry["action"]; })}><option value="fulfill" .selected=${override.action === "fulfill"}>${t("text.respondFulfill")}</option><option value="abort" .selected=${override.action === "abort"}>${t("text.cancelAbort")}</option><option value="continue-modified" .selected=${override.action === "continue-modified"}>${t("text.continueWithChanges")}</option></select></label>
            <label><span>${t("text.status")}</span><input type="number" min="100" max="599" .value=${live(String(override.status))} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.status = Number(controlValue(event)); })}></label>
            <label><span>${t("text.contentType")}</span><input .value=${live(override.contentType)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.contentType = controlValue(event); })}></label>
            <label class="override-wide"><span>${t("text.body")}</span><textarea rows="5" .value=${live(override.body)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { entry.body = controlValue(event); })}></textarea></label>
          </div>
          <div class="request-override-headers">
            <h4>${t("text.responseHeaders")}</h4>
            ${repeat(override.headers, (header) => header.id, (header) => html`
              <div class="request-override-header-row" ${reorderableRow(headerReorder, header.id)}>
                ${renderRowDragHandle(headerReorder, header.id, header.key || t("text.overrideHeader"))}
                <input aria-label=${t("text.key")} placeholder=${t("text.key")} .value=${live(header.key)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { const current = entry.headers.find(({ id }) => id === header.id); if (current) current.key = controlValue(event); })}>
                <input aria-label=${t("text.value")} placeholder=${t("text.value")} .value=${live(header.value)} @input=${(event: Event) => callbacks.update(override.id, (entry) => { const current = entry.headers.find(({ id }) => id === header.id); if (current) current.value = controlValue(event); })}>
                <label class="override-check"><input type="checkbox" .checked=${live(header.enabled)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { const current = entry.headers.find(({ id }) => id === header.id); if (current) current.enabled = checkedValue(event); })}><span>${t("text.enabled")}</span></label>
                <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: t("text.deleteThisHeaderFromTheOverride") })) callbacks.update(override.id, (entry) => { entry.headers = entry.headers.filter(({ id }) => id !== header.id); }); }}>${t("actions.delete")}</button>
              </div>
            `)}
            <button class="override-add-header" @click=${() => callbacks.update(override.id, (entry) => { entry.headers.push(createHeader(crypto.randomUUID())); })}>${t("text.addHeader")}</button>
          </div>
          <div class="request-override-actions">
            <label class="override-check"><input type="checkbox" .checked=${live(override.enabled)} @change=${(event: Event) => callbacks.update(override.id, (entry) => { entry.enabled = checkedValue(event); })}><span>${t("text.enabled")}</span></label>
            ${expanded && callbacks.apply !== undefined ? apply() : nothing}
            <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: t("text.deleteOverrideArg0", { arg0: override.matcher || t("text.noMatcher") }), detail: t("text.theRuleWillBeRemovedFromTheConfiguration") })) callbacks.remove(override.id); }}>${t("actions.delete")}</button>
          </div>
        </details>
      `; })}
      ${entries.length === 0 ? html`<p class="request-override-empty">${t("text.noOverrides")}</p>` : nothing}
    </div>
    <div class="request-override-toolbar">
      <button @click=${callbacks.add}>${t("text.addOverride")}</button>
      ${callbacks.applyAll === undefined ? nothing : html`<button @click=${callbacks.applyAll}>${t("actions.applyAll")}</button>`}
    </div>
  </div>
`;
