import { LitElement, html, nothing } from "lit";
import type { ArrayResource } from "../../../domain/arrays/arrayResource";
import { assessDocumentSize, documentSizeLimitMessage, formatBytes, MAX_DOCUMENT_BYTES } from "../../../domain/importExport/documentSize";
import { parseArrayContent } from "../../../domain/arrays/arrayValidation";
import { isResourceDirty } from "../../../domain/resources/resourceDirtyState";
import { reconcileSavedResource } from "../../../domain/resources/reconcileSavedResource";
import type { GlobalResourceSummary } from "../../../domain/resources/globalResource";
import type { ArrayToExtensionMessage, ExtensionToArrayMessage } from "../../../shared/messages/arrayMessages";
import type { NoticeTone } from "../../components/statusNotice";
import type { JsonEditorApplyDetail } from "../../components/jsonDocumentEditor";
import type { UnsavedChangesChoice } from "../../components/unsavedChangesDialog";
import "../../components/jsonDocumentEditor";
import { vscodeApi } from "../../vscodeApi";
import { AutoSaveController } from "../../components/autoSaveController";
import { renderAutoSaveControl } from "../../components/autoSaveControl";
import { SaveRequestTracker } from "../../components/saveRequestTracker";
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
  private jsonDocument: string | null = null;
  private pendingTransition: (() => void) | null = null;
  private awaitingSaveTransition = false;
  private unsavedMessage: string | null = null;
  private changingResource = false;
  private readonly saves = new SaveRequestTracker<{ resource: ArrayResource; content: string }>("array");
  private readonly autoSave = new AutoSaveController(this, {
    enabled: () => this.resource?.preferences?.autoSaveEnabled ?? false,
    canSave: () => !this.saves.pending && !this.changingResource && this.jsonDocument === null && this.unsavedMessage === null && this.pendingTransition === null && parseArrayContent(this.content).ok,
    dirty: () => this.hasUnsavedChanges(),
    save: () => { this.save(); }
  });

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
        ${renderAutoSaveControl(this.resource.preferences?.autoSaveEnabled ?? false, this.toggleAutoSave)}
        <header class="page-header">
          <div><h1>Arrays</h1><p>Colecciones JSON globales y reutilizables.</p></div>
          <div class="toolbar">
            <button @click=${() => this.guardTransition(() => this.post({ type: "array.new" }), "¿Guardar el array antes de crear otro?")}>Agregar</button>
            <button class="danger" @click=${() => this.guardTransition(() => this.post({ type: "array.deleteSelected", ids: [...this.selectedIds] }), "¿Guardar el array actual antes de eliminar la selección?")}>Eliminar seleccionados</button>
            <button @click=${() => this.guardTransition(() => this.post({ type: "array.import" }), "¿Guardar el array antes de importar?")}>Importar</button>
          </div>
        </header>
        <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
        <div class="resource-layout">
          <aside class="resource-list">
            <h2>Lista</h2>
            ${this.resources.length === 0 ? html`<p class="empty-list">No hay arrays guardados.</p>` : html`
              <ul>${this.resources.map((item) => html`<li>
                <input type="checkbox" aria-label=${`Seleccionar ${item.name}`} .checked=${this.selectedIds.has(item.id)} @change=${(event: Event) => this.toggleSelection(item.id, event)}>
                <button class=${item.id === this.resource?.id ? "resource-name current" : "resource-name"} @click=${() => this.guardTransition(() => this.post({ type: "array.select", id: item.id }), "¿Guardar el array antes de cambiar de selección?")}>${item.name}</button>
              </li>`)}</ul>
            `}
          </aside>
          <section class="resource-editor">
            <h2>Editor</h2>
            <div class="editor-content">
              <label><span>Nombre</span><input .value=${this.resource.name} @input=${(event: Event) => this.changeName(fieldValue(event))}></label>
              <label><span>Contenido JSON</span><textarea class="code-editor" spellcheck="false" .value=${this.content} @input=${this.changeContent}></textarea></label>
              <div class=${validation.ok ? "result-panel success" : "result-panel error"}>${validationMessage}</div>
              <p class="execution-note">Probar selecciona aleatoriamente un elemento del contenido actual sin guardar el array.</p>
              <div class="editor-actions">
                <button @click=${this.validate}>Validar</button>
                <button ?disabled=${!validation.ok} @click=${this.test}>Probar</button>
                <button class="primary" ?disabled=${!validation.ok || this.saves.pending} @click=${this.save}>Guardar</button>
                <button @click=${this.exportResource}>Exportar</button>
                <button @click=${this.viewJson}>Ver JSON</button>
                <span class=${dirty ? "dirty-state dirty" : "dirty-state"} role="status">${this.saves.pending ? "Guardando…" : dirty ? "Cambios sin guardar" : "Guardado"}</span>
              </div>
              ${this.notice.message ? html`<div class=${this.notice.tone === "error" ? "result-panel error" : this.notice.tone === "success" ? "result-panel success" : "result-panel"}>${this.notice.message}</div>` : nothing}
            </div>
          </section>
        </div>
      </main>
      ${this.jsonDocument === null ? nothing : html`<json-document-editor
        .value=${this.jsonDocument}
        .heading=${`JSON de ${this.resource.name}`}
        .errorMessage=${this.notice.tone === "error" ? this.notice.message : ""}
        @json-editor-change=${this.changeJson}
        @json-editor-close=${this.closeJsonEditor}
        @json-editor-apply=${this.applyJson}
      ></json-document-editor>`}
      ${this.unsavedMessage === null ? nothing : html`<unsaved-changes-dialog .message=${this.unsavedMessage} @unsaved-choice=${this.resolveUnsavedChoice}></unsaved-changes-dialog>`}
    `;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToArrayMessage>): void => {
    if (event.data.type === "array.state") {
      this.autoSave.cancel();
      this.saves.reset();
      this.changingResource = false;
      this.resource = structuredClone(event.data.state.resource);
      this.savedResource = event.data.state.savedResource === null ? null : structuredClone(event.data.state.savedResource);
      this.resources = event.data.state.resources;
      this.content = JSON.stringify(this.resource.items, null, 2);
      this.savedContent = this.content;
      this.selectedIds = new Set([...this.selectedIds].filter((id) => this.resources.some((resource) => resource.id === id)));
      if (this.awaitingSaveTransition) {
        const transition = this.pendingTransition;
        this.awaitingSaveTransition = false;
        this.pendingTransition = null;
        transition?.();
      }
    } else if (event.data.type === "array.saved") {
      const submitted = this.saves.complete(event.data.requestId);
      const saved = event.data.state.resource;
      if (submitted === null || this.resource?.id !== saved.id) return;
      this.resource = reconcileSavedResource(this.resource, submitted.resource, saved);
      this.savedResource = structuredClone(event.data.state.savedResource);
      this.resources = event.data.state.resources;
      this.savedContent = JSON.stringify(saved.items, null, 2);
      if (this.content === submitted.content) this.content = this.savedContent;
      const parsed = parseArrayContent(this.content);
      this.resource.items = parsed.ok ? parsed.value : structuredClone(saved.items);
      this.finishSaveTransition();
      this.autoSave.schedule();
    } else if (event.data.type === "array.saveFailed") {
      if (this.saves.complete(event.data.requestId) === null) return;
      this.autoSave.cancel();
      this.awaitingSaveTransition = false;
      this.pendingTransition = null;
      this.notice = { tone: "error", message: event.data.error };
    } else if (event.data.type === "array.resources") {
      this.resources = event.data.resources;
    } else if (event.data.type === "array.operationCanceled") {
      this.changingResource = false;
      this.autoSave.activity();
    } else if (event.data.type === "array.jsonDocument") {
      this.autoSave.cancel();
      this.jsonDocument = event.data.serialized;
      this.notice = { tone: "info", message: "" };
    } else if (event.data.type === "array.jsonApplied") {
      this.resource = structuredClone(event.data.resource);
      this.content = JSON.stringify(this.resource.items, null, 2);
      this.jsonDocument = null;
      this.autoSave.activity();
    } else {
      this.notice = { tone: event.data.tone, message: event.data.message };
      if (event.data.tone === "error") { this.awaitingSaveTransition = false; this.pendingTransition = null; this.changingResource = false; }
    }
    this.requestUpdate();
  };

  private readonly closeJsonEditor = (): void => { this.jsonDocument = null; this.autoSave.activity(); this.requestUpdate(); };
  private readonly changeJson = (event: CustomEvent<JsonEditorApplyDetail>): void => { this.jsonDocument = event.detail.serialized; };

  private readonly applyJson = (event: CustomEvent<JsonEditorApplyDetail>): void => {
    if (this.resource === null) return;
    this.post({ type: "array.applyJson", serialized: event.detail.serialized, currentId: this.resource.id });
  };

  private changeName(name: string): void {
    if (this.resource === null) return;
    this.resource = { ...this.resource, name };
    this.autoSave.activity();
    this.requestUpdate();
  }

  private guardTransition(transition: () => void, message: string): void {
    this.autoSave.cancel();
    const begin = () => { this.changingResource = true; this.autoSave.cancel(); transition(); };
    if (!this.hasUnsavedChanges()) { begin(); return; }
    this.pendingTransition = begin;
    this.unsavedMessage = message;
    this.requestUpdate();
  }

  private readonly resolveUnsavedChoice = (event: CustomEvent<UnsavedChangesChoice>): void => {
    this.unsavedMessage = null;
    if (event.detail === "cancel") this.pendingTransition = null;
    else if (event.detail === "discard") { const transition = this.pendingTransition; this.pendingTransition = null; transition?.(); }
    else if (this.save()) this.awaitingSaveTransition = true;
    else this.pendingTransition = null;
    this.autoSave.schedule();
    this.requestUpdate();
  };

  private readonly changeContent = (event: Event): void => {
    if (!(event.currentTarget instanceof HTMLTextAreaElement)) return;
    const candidate = event.currentTarget.value;
    const size = assessDocumentSize(candidate);
    if (size.exceedsLimit) {
      event.currentTarget.value = this.content;
      this.notice = { tone: "error", message: documentSizeLimitMessage(size.bytes) };
    } else {
      this.content = candidate;
      this.autoSave.activity();
      this.notice = size.shouldWarn
        ? { tone: "warning", message: `El array ocupa ${formatBytes(size.bytes)} de ${formatBytes(MAX_DOCUMENT_BYTES)}.` }
        : { tone: "info", message: "" };
    }
    this.requestUpdate();
  };

  private readonly validate = (): void => {
    const validation = parseArrayContent(this.content);
    this.notice = validation.ok
      ? { tone: "success", message: `JSON válido · ${validation.value.length} elementos.` }
      : { tone: "error", message: validation.error };
    this.requestUpdate();
  };

  private readonly save = (): boolean => {
    if (this.resource === null) return false;
    if (this.saves.pending) return true;
    const validation = parseArrayContent(this.content);
    if (!validation.ok) { this.notice = { tone: "error", message: validation.error }; this.requestUpdate(); return false; }
    this.autoSave.cancel();
    const request = this.saves.start({ resource: { ...this.resource, items: validation.value }, content: this.content });
    if (request === null) return false;
    this.post({ type: "array.save", resource: request.value.resource, requestId: request.requestId });
    this.requestUpdate();
    return true;
  };

  private hasUnsavedChanges(): boolean { return this.resource !== null && (isResourceDirty(this.resource, this.savedResource) || this.content !== this.savedContent); }

  private finishSaveTransition(): void {
    if (!this.awaitingSaveTransition) return;
    if (this.hasUnsavedChanges()) { this.save(); return; }
    const transition = this.pendingTransition;
    this.awaitingSaveTransition = false;
    this.pendingTransition = null;
    transition?.();
  }

  private readonly toggleAutoSave = (): void => {
    if (this.resource === null) return;
    this.resource = { ...this.resource, preferences: { ...this.resource.preferences, autoSaveEnabled: !this.resource.preferences?.autoSaveEnabled } };
    this.autoSave.activity();
    this.requestUpdate();
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

  private readonly viewJson = (): void => {
    if (this.resource === null) return;
    const validation = parseArrayContent(this.content);
    if (!validation.ok) { this.notice = { tone: "error", message: validation.error }; this.requestUpdate(); return; }
    this.post({ type: "array.viewJson", resource: { ...this.resource, items: validation.value } });
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
