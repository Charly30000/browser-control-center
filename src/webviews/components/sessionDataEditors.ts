import { t } from "../../localization";
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { renderRowDragHandle, reorderableRow, type RowReorderOptions } from "./rowReorder";
import type { CookieEntry, HeaderEntry, QueryParamEntry, StorageEntry, StorageValueType } from "../../domain/manual/manualProfile";
import { parseStorageValue } from "../../domain/manual/storageValue";
import type { ConfirmDestructiveAction } from "./confirmDestructiveAction";
import type { CollapsibleEntryState } from "./collapsibleEntryState";
import "./sessionDataEditors.css";

export interface EntryEditorCallbacks<T extends { readonly id: string }> {
  readonly add: () => void;
  readonly update: (id: string, change: (entry: T) => void) => void;
  readonly remove: (id: string) => void;
  readonly confirmDeletion: ConfirmDestructiveAction;
  readonly apply?: (id: string) => void;
  readonly applyAll?: () => void;
  readonly expansion?: CollapsibleEntryState;
  readonly reorder?: RowReorderOptions;
}

const valueFrom = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : "";
};

const checkedFrom = (event: Event): boolean => event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;
const toggle = (checked: boolean, label: string, change: (value: boolean) => void): TemplateResult => html`<label class="session-check"><input type="checkbox" .checked=${live(checked)} @change=${(event: Event) => change(checkedFrom(event))}><span>${label}</span></label>`;
const applyButton = (callbacks: { readonly apply?: (id: string) => void }, id: string): TemplateResult | typeof nothing => callbacks.apply === undefined ? nothing : html`<button type="button" @click=${(event: Event) => { event.stopPropagation(); callbacks.apply?.(id); }}>${t("actions.apply")}</button>`;
const applyAllButton = (callbacks: { readonly applyAll?: () => void }, label: string): TemplateResult | typeof nothing => callbacks.applyAll === undefined ? nothing : html`<button @click=${callbacks.applyAll}>${label}</button>`;

export const renderQueryParamEditor = (entries: readonly QueryParamEntry[], callbacks: EntryEditorCallbacks<QueryParamEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${repeat(entries, (entry) => entry.id, (entry) => html`<div class="session-row query-param-row" ${reorderableRow(callbacks.reorder, entry.id)}>
        ${renderRowDragHandle(callbacks.reorder, entry.id, entry.key || t("labels.queryParameter"))}
        <input aria-label=${t("text.key")} placeholder=${t("text.key")} .value=${live(entry.key)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.key = valueFrom(event); })}>
        <input aria-label=${t("text.value")} placeholder=${t("text.value")} .value=${live(entry.value)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.value = valueFrom(event); })}>
        ${toggle(entry.enabled, t("text.enabled"), (enabled) => callbacks.update(entry.id, (item) => { item.enabled = enabled; }))}
        <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: t("text.deleteQueryParameterArg0", { arg0: entry.key || t("text.noKey") }) })) callbacks.remove(entry.id); }}>${t("actions.delete")}</button>
      </div>`)}
      ${entries.length === 0 ? html`<p class="session-empty">${t("text.noQueryParameters")}</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>${t("text.add")}</button></div>
  </div>`;

export const renderHeaderEditor = (entries: readonly HeaderEntry[], callbacks: EntryEditorCallbacks<HeaderEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${repeat(entries, (entry) => entry.id, (entry) => html`<div class="session-row header-row" ${reorderableRow(callbacks.reorder, entry.id)}>
        ${renderRowDragHandle(callbacks.reorder, entry.id, entry.key || t("labels.header"))}
        <input aria-label=${t("text.key")} placeholder=${t("text.key")} .value=${live(entry.key)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.key = valueFrom(event); })}>
        <input aria-label=${t("text.value")} placeholder=${t("text.value")} .value=${live(entry.value)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.value = valueFrom(event); })}>
        ${toggle(entry.enabled, t("text.enabled"), (enabled) => callbacks.update(entry.id, (item) => { item.enabled = enabled; }))}
        ${applyButton(callbacks, entry.id)}
        <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: t("text.deleteHeaderArg0", { arg0: entry.key || t("text.noKey") }) })) callbacks.remove(entry.id); }}>${t("actions.delete")}</button>
      </div>`)}
      ${entries.length === 0 ? html`<p class="session-empty">${t("text.noHeaders")}</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>${t("text.add")}</button>${applyAllButton(callbacks, t("actions.applyAll"))}</div>
  </div>`;

export const renderCookieEditor = (entries: readonly CookieEntry[], callbacks: EntryEditorCallbacks<CookieEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${repeat(entries, (cookie) => cookie.id, (cookie) => {
        const expanded = callbacks.expansion?.isOpen(cookie.id, false) ?? false;
        return html`<details class="session-details" ${reorderableRow(callbacks.reorder, cookie.id)} .open=${expanded} @toggle=${(event: Event) => callbacks.expansion?.toggle(cookie.id, false, event)}>
        <summary class=${!expanded && callbacks.apply !== undefined ? "has-collapsed-apply" : ""}>${renderRowDragHandle(callbacks.reorder, cookie.id, cookie.name || t("labels.cookieLowercase"))}<span>${cookie.name || t("text.unnamedCookie")}</span><small>${cookie.domain || t("text.domainNotSet")}</small><span class=${cookie.enabled ? "session-enabled" : "session-disabled"}>${cookie.enabled ? t("text.enabled") : t("text.disabled")}</span>${expanded ? nothing : applyButton(callbacks, cookie.id)}</summary>
        <div class="session-details-grid">
          <label><span>${t("text.name")}</span><input .value=${live(cookie.name)} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.name = valueFrom(event); })}></label>
          <label><span>${t("text.value")}</span><input .value=${live(cookie.value)} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.value = valueFrom(event); })}></label>
          <label><span>${t("text.domain")}</span><input .value=${live(cookie.domain)} placeholder=${t("text.exampleCom")} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.domain = valueFrom(event); })}></label>
          <label><span>${t("text.path")}</span><input .value=${live(cookie.path)} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.path = valueFrom(event); })}></label>
          <label><span>${t("text.expires")}</span><input type="datetime-local" .value=${live(cookie.expires ?? "")} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.expires = valueFrom(event) || null; })}></label>
          <label><span>${t("text.samesite")}</span><select .value=${live(cookie.sameSite)} @change=${(event: Event) => callbacks.update(cookie.id, (item) => { item.sameSite = valueFrom(event) as CookieEntry["sameSite"]; })}><option>${t("text.strict")}</option><option>${t("text.lax")}</option><option>${t("text.none")}</option></select></label>
          ${toggle(cookie.secure, t("labels.secure"), (enabled) => callbacks.update(cookie.id, (item) => { item.secure = enabled; }))}
          ${toggle(cookie.httpOnly, t("labels.httpOnly"), (enabled) => callbacks.update(cookie.id, (item) => { item.httpOnly = enabled; }))}
          ${toggle(cookie.enabled, t("text.enabled"), (enabled) => callbacks.update(cookie.id, (item) => { item.enabled = enabled; }))}
        </div>
        <div class="session-actions">${expanded ? applyButton(callbacks, cookie.id) : nothing}<button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: t("text.deleteCookieArg0", { arg0: cookie.name || t("text.unnamed") }) })) callbacks.remove(cookie.id); }}>${t("actions.delete")}</button></div>
      </details>`; })}
      ${entries.length === 0 ? html`<p class="session-empty">${t("text.noCookies")}</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>${t("text.add")}</button>${applyAllButton(callbacks, t("actions.applyAll"))}</div>
  </div>`;

export const renderStorageEditor = (entries: readonly StorageEntry[], callbacks: EntryEditorCallbacks<StorageEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${repeat(entries, (entry) => entry.id, (entry) => {
        const validation = parseStorageValue(entry.valueType, entry.value);
        return html`<div class="session-row storage-entry-row" ${reorderableRow(callbacks.reorder, entry.id)}>
          ${renderRowDragHandle(callbacks.reorder, entry.id, entry.key || t("text.storageEntry"))}
          <input aria-label=${t("text.key")} placeholder=${t("text.key")} .value=${live(entry.key)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.key = valueFrom(event); })}>
          <select aria-label=${t("text.type")} .value=${live(entry.valueType)} @change=${(event: Event) => callbacks.update(entry.id, (item) => { item.valueType = valueFrom(event) as StorageValueType; if (item.valueType === "null") item.value = "null"; })}><option value="string">${t("text.string")}</option><option value="number">${t("text.number")}</option><option value="boolean">${t("text.boolean")}</option><option value="json">${t("text.json")}</option><option value="null">${t("text.null")}</option></select>
          <input aria-label=${t("text.value")} placeholder=${t("text.value")} .value=${live(entry.value)} ?disabled=${entry.valueType === "null"} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.value = valueFrom(event); })}>
          ${toggle(entry.enabled, t("text.enabled"), (enabled) => callbacks.update(entry.id, (item) => { item.enabled = enabled; }))}
          ${applyButton(callbacks, entry.id)}
          <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: t("text.deleteEntryArg0", { arg0: entry.key || t("text.noKey") }) })) callbacks.remove(entry.id); }}>${t("actions.delete")}</button>
          ${validation.ok ? nothing : html`<p class="session-validation">${validation.error}</p>`}
        </div>`;
      })}
      ${entries.length === 0 ? html`<p class="session-empty">${t("text.noValuesDefined")}</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>${t("text.add")}</button>${applyAllButton(callbacks, t("actions.applyAll"))}</div>
  </div>`;
