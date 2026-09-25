import { LitElement, html, nothing } from "lit";
import type { ArrayResource } from "../../../domain/arrays/arrayResource";
import { parseArrayContent } from "../../../domain/arrays/arrayValidation";
import { isResourceDirty } from "../../../domain/resources/resourceDirtyState";
import type { GlobalResourceSummary } from "../../../domain/resources/globalResource";
import type { ArrayToExtensionMessage, ExtensionToArrayMessage } from "../../../shared/messages/arrayMessages";
import type { NoticeTone } from "../../components/statusNotice";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./arrays.css";

const fieldValue = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : "";
};

class ArraysApp extends LitElement {
  private resource: ArrayResource | null = null;
  private savedResource: ArrayResource | null = null;
  private resources: readonly GlobalResourceSummary[] = [];
  private content = "[]";
  private savedContent = "";
  private selectedIds = new Set<string>();
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };

  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "array.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }

  protected override render() {
    if (this.resource === null) return html`<main class="resource-shell loading">Cargando arrays…</main>`;
    const validation = parseArrayContent(this.content);
    const dirty = isResourceDirty(this.resource, this.savedResource) || this.content !== this.savedContent;
    const validationMessage = validation.ok ? `JSON válido · ${validation.value.length} elementos` : validation.error;
    return html`
      <main class="resource-shell">
        <header class="page-header">
          <div><h1>Arrays</h1><p>Colecciones JSON globales y reutilizables.</p></div>
          <div class="toolbar">
            <button @click=${() => this.post({ type: "array.new" })}>Agregar</button>
            <button class="danger" @click=${() => this.post({ type: "array.deleteSelected", ids: [...this.selectedIds] })}>Eliminar seleccionados</button>
            <button @click=${() => this.post({ type: "array.import" })}>Importar</button>
          </div>
        </header>
        <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
        <div class="resource-layout">
          <aside class="resource-list">
            <h2>Lista</h2>
            ${this.resources.length === 0 ? html`<p class="empty-list">No hay arrays guardados.</p>` : html`
              <ul>${this.resources.map((item) => html`<li>
                <input type="checkbox" aria-label=${`Seleccionar ${item.name}`} .checked=${this.selectedIds.has(item.id)} @change=${(event: Event) => this.toggleSelection(item.id, event)}>
                <button class=${item.id === this.resource?.id ? "resource-name current" : "resource-name"} @click=${() => this.post({ type: "array.select", id: item.id })}>${item.name}</button>
              </li>`)}</ul>
            `}
          </aside>
          <section class="resource-editor">
            <h2>Editor</h2>
            <div class="editor-content">
              <label><span>Nombre</span><input .value=${this.resource.name} @input=${(event: Event) => this.changeName(fieldValue(event))}></label>
              <label><span>Contenido JSON</span><textarea class="code-editor" spellcheck="false" .value=${this.content} @input=${(event: Event) => { this.content = fieldValue(event); this.requestUpdate(); }}></textarea></label>
              <div class=${validation.ok ? "result-panel success" : "result-panel error"}>${validationMessage}</div>
              <p class="execution-note">Probar selecciona aleatoriamente un elemento del contenido actual sin guardar el array.</p>
              <div class="editor-actions">
                <button @click=${this.validate}>Validar</button>
                <button ?disabled=${!validation.ok} @click=${this.test}>Probar</button>
                <button class="primary" ?disabled=${!validation.ok} @click=${this.save}>Guardar</button>
                <button @click=${this.exportResource}>Exportar</button>
                <span class=${dirty ? "dirty-state dirty" : "dirty-state"}>${dirty ? "Cambios sin guardar" : "Guardado"}</span>
              </div>
              ${this.notice.message ? html`<div class=${this.notice.tone === "error" ? "result-panel error" : this.notice.tone === "success" ? "result-panel success" : "result-panel"}>${this.notice.message}</div>` : nothing}
            </div>
          </section>
        </div>
      </main>
    `;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToArrayMessage>): void => {
    if (event.data.type === "array.state") {
      this.resource = structuredClone(event.data.state.resource);
      this.savedResource = event.data.state.savedResource === null ? null : structuredClone(event.data.state.savedResource);
      this.resources = event.data.state.resources;
      this.content = JSON.stringify(this.resource.items, null, 2);
      this.savedContent = this.content;
      this.selectedIds = new Set([...this.selectedIds].filter((id) => this.resources.some((resource) => resource.id === id)));
    } else {
      this.notice = { tone: event.data.tone, message: event.data.message };
    }
    this.requestUpdate();
  };

  private changeName(name: string): void {
    if (this.resource === null) return;
    this.resource = { ...this.resource, name };
    this.requestUpdate();
  }

  private readonly validate = (): void => {
    const validation = parseArrayContent(this.content);
    this.notice = validation.ok
      ? { tone: "success", message: `JSON válido · ${validation.value.length} elementos.` }
      : { tone: "error", message: validation.error };
    this.requestUpdate();
  };

  private readonly save = (): void => {
    if (this.resource === null) return;
    const validation = parseArrayContent(this.content);
    if (!validation.ok) { this.notice = { tone: "error", message: validation.error }; this.requestUpdate(); return; }
    this.post({ type: "array.save", resource: { ...this.resource, items: validation.value } });
  };

  private readonly test = (): void => {
    if (this.resource === null) return;
    const validation = parseArrayContent(this.content);
    if (!validation.ok) { this.notice = { tone: "error", message: validation.error }; this.requestUpdate(); return; }
    this.post({ type: "array.test", resource: { ...this.resource, items: validation.value } });
  };

  private readonly exportResource = (): void => {
    if (this.resource === null) return;
    const validation = parseArrayContent(this.content);
    if (!validation.ok) { this.notice = { tone: "error", message: validation.error }; this.requestUpdate(); return; }
    this.post({ type: "array.export", resource: { ...this.resource, items: validation.value } });
  };

  private toggleSelection(id: string, event: Event): void {
    const checked = event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;
    this.selectedIds = new Set(this.selectedIds);
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    this.requestUpdate();
  }

  private post(message: ArrayToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("arrays-app", ArraysApp);
document.body.append(document.createElement("arrays-app"));
