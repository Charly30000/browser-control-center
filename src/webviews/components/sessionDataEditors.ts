import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
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
}

const valueFrom = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : "";
};

const checkedFrom = (event: Event): boolean => event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;
const toggle = (checked: boolean, label: string, change: (value: boolean) => void): TemplateResult => html`<label class="session-check"><input type="checkbox" .checked=${live(checked)} @change=${(event: Event) => change(checkedFrom(event))}><span>${label}</span></label>`;
const applyButton = (callbacks: { readonly apply?: (id: string) => void }, id: string): TemplateResult | typeof nothing => callbacks.apply === undefined ? nothing : html`<button type="button" @click=${(event: Event) => { event.stopPropagation(); callbacks.apply?.(id); }}>Aplicar</button>`;
const applyAllButton = (callbacks: { readonly applyAll?: () => void }, label: string): TemplateResult | typeof nothing => callbacks.applyAll === undefined ? nothing : html`<button @click=${callbacks.applyAll}>${label}</button>`;

export const renderQueryParamEditor = (entries: readonly QueryParamEntry[], callbacks: EntryEditorCallbacks<QueryParamEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${entries.map((entry) => html`<div class="session-row query-param-row">
        <input aria-label="Clave" placeholder="Key" .value=${live(entry.key)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.key = valueFrom(event); })}>
        <input aria-label="Valor" placeholder="Value" .value=${live(entry.value)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.value = valueFrom(event); })}>
        ${toggle(entry.enabled, "Activo", (enabled) => callbacks.update(entry.id, (item) => { item.enabled = enabled; }))}
        <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: `¿Eliminar el query param «${entry.key || "sin clave"}»?` })) callbacks.remove(entry.id); }}>Eliminar</button>
      </div>`)}
      ${entries.length === 0 ? html`<p class="session-empty">No hay query params.</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>+ Añadir</button></div>
  </div>`;

export const renderHeaderEditor = (entries: readonly HeaderEntry[], callbacks: EntryEditorCallbacks<HeaderEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${entries.map((entry) => html`<div class="session-row header-row">
        <input aria-label="Clave" placeholder="Key" .value=${live(entry.key)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.key = valueFrom(event); })}>
        <input aria-label="Valor" placeholder="Value" .value=${live(entry.value)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.value = valueFrom(event); })}>
        ${toggle(entry.enabled, "Activo", (enabled) => callbacks.update(entry.id, (item) => { item.enabled = enabled; }))}
        ${applyButton(callbacks, entry.id)}
        <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: `¿Eliminar el header «${entry.key || "sin clave"}»?` })) callbacks.remove(entry.id); }}>Eliminar</button>
      </div>`)}
      ${entries.length === 0 ? html`<p class="session-empty">No hay headers.</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>+ Añadir</button>${applyAllButton(callbacks, "Aplicar todos")}</div>
  </div>`;

export const renderCookieEditor = (entries: readonly CookieEntry[], callbacks: EntryEditorCallbacks<CookieEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${entries.map((cookie) => {
        const expanded = callbacks.expansion?.isOpen(cookie.id, false) ?? false;
        return html`<details class="session-details" .open=${expanded} @toggle=${(event: Event) => callbacks.expansion?.toggle(cookie.id, false, event)}>
        <summary class=${!expanded && callbacks.apply !== undefined ? "has-collapsed-apply" : ""}><span>${cookie.name || "Cookie sin nombre"}</span><small>${cookie.domain || "Dominio pendiente"}</small><span class=${cookie.enabled ? "session-enabled" : "session-disabled"}>${cookie.enabled ? "Activa" : "Inactiva"}</span>${expanded ? nothing : applyButton(callbacks, cookie.id)}</summary>
        <div class="session-details-grid">
          <label><span>Nombre</span><input .value=${live(cookie.name)} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.name = valueFrom(event); })}></label>
          <label><span>Valor</span><input .value=${live(cookie.value)} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.value = valueFrom(event); })}></label>
          <label><span>Dominio</span><input .value=${live(cookie.domain)} placeholder="example.com" @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.domain = valueFrom(event); })}></label>
          <label><span>Path</span><input .value=${live(cookie.path)} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.path = valueFrom(event); })}></label>
          <label><span>Expira</span><input type="datetime-local" .value=${live(cookie.expires ?? "")} @input=${(event: Event) => callbacks.update(cookie.id, (item) => { item.expires = valueFrom(event) || null; })}></label>
          <label><span>SameSite</span><select .value=${live(cookie.sameSite)} @change=${(event: Event) => callbacks.update(cookie.id, (item) => { item.sameSite = valueFrom(event) as CookieEntry["sameSite"]; })}><option>Strict</option><option>Lax</option><option>None</option></select></label>
          ${toggle(cookie.secure, "Secure", (enabled) => callbacks.update(cookie.id, (item) => { item.secure = enabled; }))}
          ${toggle(cookie.httpOnly, "HttpOnly", (enabled) => callbacks.update(cookie.id, (item) => { item.httpOnly = enabled; }))}
          ${toggle(cookie.enabled, "Activo", (enabled) => callbacks.update(cookie.id, (item) => { item.enabled = enabled; }))}
        </div>
        <div class="session-actions">${expanded ? applyButton(callbacks, cookie.id) : nothing}<button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: `¿Eliminar la cookie «${cookie.name || "sin nombre"}»?` })) callbacks.remove(cookie.id); }}>Eliminar</button></div>
      </details>`; })}
      ${entries.length === 0 ? html`<p class="session-empty">No hay cookies.</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>+ Añadir</button>${applyAllButton(callbacks, "Aplicar todas")}</div>
  </div>`;

export const renderStorageEditor = (entries: readonly StorageEntry[], callbacks: EntryEditorCallbacks<StorageEntry>): TemplateResult => html`
  <div class="session-editor">
    <div class="session-list">
      ${entries.map((entry) => {
        const validation = parseStorageValue(entry.valueType, entry.value);
        return html`<div class="session-row storage-entry-row">
          <input aria-label="Clave" placeholder="Key" .value=${live(entry.key)} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.key = valueFrom(event); })}>
          <select aria-label="Tipo" .value=${live(entry.valueType)} @change=${(event: Event) => callbacks.update(entry.id, (item) => { item.valueType = valueFrom(event) as StorageValueType; if (item.valueType === "null") item.value = "null"; })}><option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option><option value="json">JSON</option><option value="null">null</option></select>
          <input aria-label="Valor" placeholder="Value" .value=${live(entry.value)} ?disabled=${entry.valueType === "null"} @input=${(event: Event) => callbacks.update(entry.id, (item) => { item.value = valueFrom(event); })}>
          ${toggle(entry.enabled, "Activo", (enabled) => callbacks.update(entry.id, (item) => { item.enabled = enabled; }))}
          ${applyButton(callbacks, entry.id)}
          <button class="danger" @click=${async () => { if (await callbacks.confirmDeletion({ question: `¿Eliminar la entrada «${entry.key || "sin clave"}»?` })) callbacks.remove(entry.id); }}>Eliminar</button>
          ${validation.ok ? nothing : html`<p class="session-validation">${validation.error}</p>`}
        </div>`;
      })}
      ${entries.length === 0 ? html`<p class="session-empty">No hay valores definidos.</p>` : nothing}
    </div>
    <div class="session-toolbar"><button @click=${callbacks.add}>+ Añadir</button>${applyAllButton(callbacks, "Aplicar todos")}</div>
  </div>`;
