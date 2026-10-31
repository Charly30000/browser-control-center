import { t } from "../../../localization";
import { LitElement, html, nothing } from "lit";
import type { FormulaResource } from "../../../domain/formulas/formula";
import { assessDocumentSize, documentSizeLimitMessage, formatBytes, MAX_DOCUMENT_BYTES } from "../../../domain/importExport/documentSize";
import { isResourceDirty } from "../../../domain/resources/resourceDirtyState";
import { isAutoSaveEnabled } from "../../../domain/resources/editorPreferences";
import { reconcileSavedResource } from "../../../domain/resources/reconcileSavedResource";
import type { GlobalResourceSummary } from "../../../domain/resources/globalResource";
import type { ExtensionToFormulaMessage, FormulaToExtensionMessage } from "../../../shared/messages/formulaMessages";
import type { NoticeTone } from "../../components/statusNotice";
import type { JsonEditorApplyDetail } from "../../components/jsonDocumentEditor";
import type { UnsavedChangesChoice } from "../../components/unsavedChangesDialog";
import "../../components/jsonDocumentEditor";
import { vscodeApi } from "../../vscodeApi";
import { AutoSaveController } from "../../components/autoSaveController";
import { renderAutoSaveControl } from "../../components/autoSaveControl";
import { SaveRequestTracker } from "../../components/saveRequestTracker";
import { renderSectionIcon } from "../../components/sectionIcon";
import "../../components";
import "./formulas.css";

const fieldValue = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : "";
};

class FormulasApp extends LitElement {
  private resource: FormulaResource | null = null;
  private savedResource: FormulaResource | null = null;
  private baselineResource: FormulaResource | null = null;
  private resources: readonly GlobalResourceSummary[] = [];
  private selectedIds = new Set<string>();
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };
  private jsonDocument: string | null = null;
  private pendingTransition: (() => void) | null = null;
  private awaitingSaveTransition = false;
  private unsavedMessage: string | null = null;
  private changingResource = false;
  private readonly saves = new SaveRequestTracker<FormulaResource>("formula");
  private readonly autoSave = new AutoSaveController(this, {
    enabled: () => isAutoSaveEnabled(this.resource?.preferences),
    canSave: () => !this.saves.pending && !this.changingResource && this.jsonDocument === null && this.unsavedMessage === null && this.pendingTransition === null,
    dirty: () => this.hasUnsavedChanges(),
    save: () => this.save()
  });

  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "formula.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }

  protected override render() {
    if (this.resource === null) return html`<main class="resource-shell loading">${t("text.loadingFormulas")}</main>`;
    const dirty = this.hasUnsavedChanges();
    return html`
      <main class="resource-shell formulas-page">
        ${renderAutoSaveControl(isAutoSaveEnabled(this.resource.preferences), this.toggleAutoSave)}
        <header class="page-header">
          <div class="page-title"><span class="resource-icon">${renderSectionIcon("formulas")}</span><div><h1>${t("navigation.formulas")}</h1><p>${t("text.reusableJavaScriptFunctionsRunInTheSelectedBrowserInAnIsolatedHeadlessSession")}</p></div></div>
          <div class="toolbar">
            <button class="primary" @click=${() => this.guardTransition(() => this.post({ type: "formula.new" }), t("text.saveTheFormulaBeforeCreatingAnotherOne"))}>${t("text.add2")}</button>
            <button class="danger" @click=${() => this.guardTransition(() => this.post({ type: "formula.deleteSelected", ids: [...this.selectedIds] }), t("text.saveTheCurrentFormulaBeforeDeletingTheSelection"))}>${t("text.deleteSelected")}</button>
            <button title=${t("text.loadAnExampleFormulaWithoutRunningIt")} @click=${() => this.guardTransition(() => this.post({ type: "formula.generateExample" }), t("text.saveTheFormulaBeforeLoadingTheExample"))}>${t("text.generateExample")}</button>
            <button @click=${() => this.guardTransition(() => this.post({ type: "formula.import" }), t("text.saveTheFormulaBeforeImporting"))}>${t("actions.import")}</button>
          </div>
        </header>
        <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
        <div class="resource-layout">
          <aside class="resource-list">
            <header class="resource-section-header"><div><h2>${t("text.myFormulas")}</h2><p>${t("text.savedFunctions")}</p></div><span class="resource-count" aria-label=${t("text.arg0SavedFormulas", { arg0: this.resources.length })}>${this.resources.length}</span></header>
            ${this.resources.length === 0 ? html`<p class="empty-list">${t("text.noSavedFormulas")}</p>` : html`
              <ul>${this.resources.map((item) => html`<li class=${item.id === this.resource?.id ? "resource-item current" : "resource-item"}>
                <input type="checkbox" aria-label=${t("text.selectArg0", { arg0: item.name })} .checked=${this.selectedIds.has(item.id)} @change=${(event: Event) => this.toggleSelection(item.id, event)}>
                <button class="resource-name" title=${item.name} aria-current=${item.id === this.resource?.id ? "true" : nothing} @click=${() => this.guardTransition(() => this.post({ type: "formula.select", id: item.id }), t("text.saveTheFormulaBeforeChangingTheSelection"))}><span class="resource-item-icon">${renderSectionIcon("formulas")}</span><span class="resource-item-title">${item.name}</span></button>
              </li>`)}</ul>
            `}
            ${this.selectedIds.size === 0 ? nothing : html`<p class="selection-summary">${this.selectedIds.size} ${this.selectedIds.size === 1 ? t("text.selectedFormula") : t("text.selectedFormulas")}</p>`}
          </aside>
          <section class="resource-editor">
            <header class="resource-section-header editor-header"><div><h2>${t("text.formulaEditor")}</h2><p>${t("text.generateDataWithYourJavaScriptFunction")}</p></div><div class="editor-header-meta"><span class="resource-type">${t("text.javascript")}</span><span class=${dirty ? "dirty-state dirty" : "dirty-state"} role="status">${this.saves.pending ? t("saveState.saving") : dirty ? t("saveState.dirty") : this.savedResource === null ? t("saveState.new") : t("saveState.saved")}</span></div></header>
            <div class="editor-content">
              <label class="resource-name-field"><span>${t("text.formulaName")}</span><input .value=${this.resource.name} @input=${(event: Event) => this.change((resource) => { resource.name = fieldValue(event); })}></label>
              <label class="resource-code-field"><span>${t("text.codeContractFunctionGenerateWithNoParameters")}</span><textarea class="code-editor" spellcheck="false" .value=${this.resource.code} @input=${this.changeCode}></textarea></label>
              <p class="execution-note">${t("text.testRunsTheFormulaWithoutNetworkOrNodeVSCodeAccessWithAStrict2SecondTimeout")}</p>
              <div class="editor-actions">
                <button @click=${() => this.post({ type: "formula.test", resource: this.resource! })}>${t("text.test")}</button>
                <button class="primary" ?disabled=${this.saves.pending} @click=${this.save}>${t("actions.save")}</button>
                <button @click=${() => this.post({ type: "formula.export", resource: this.resource! })}>${t("actions.export")}</button>
                <button @click=${() => this.post({ type: "formula.viewJson", resource: this.resource! })}>${t("actions.viewJson")}</button>
              </div>
              ${this.notice.message ? html`<div class=${this.notice.tone === "error" ? "result-panel error" : this.notice.tone === "success" ? "result-panel success" : "result-panel"}>${this.notice.message}</div>` : nothing}
            </div>
          </section>
        </div>
      </main>
      ${this.jsonDocument === null ? nothing : html`<json-document-editor
        .value=${this.jsonDocument}
        .heading=${t("text.jsonForArg0", { arg0: this.resource.name })}
        .errorMessage=${this.notice.tone === "error" ? this.notice.message : ""}
        @json-editor-change=${this.changeJson}
        @json-editor-close=${this.closeJsonEditor}
        @json-editor-apply=${this.applyJson}
      ></json-document-editor>`}
      ${this.unsavedMessage === null ? nothing : html`<unsaved-changes-dialog .message=${this.unsavedMessage} @unsaved-choice=${this.resolveUnsavedChoice}></unsaved-changes-dialog>`}
    `;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToFormulaMessage>): void => {
    if (event.data.type === "formula.state") {
      this.autoSave.cancel();
      this.saves.reset();
      this.changingResource = false;
      this.resource = structuredClone(event.data.state.resource);
      this.baselineResource = structuredClone(event.data.state.resource);
      this.savedResource = event.data.state.savedResource === null ? null : structuredClone(event.data.state.savedResource);
      this.resources = event.data.state.resources;
      this.selectedIds = new Set([...this.selectedIds].filter((id) => this.resources.some((resource) => resource.id === id)));
      if (this.awaitingSaveTransition) {
        const transition = this.pendingTransition;
        this.awaitingSaveTransition = false;
        this.pendingTransition = null;
        transition?.();
      }
    } else if (event.data.type === "formula.saved") {
      const submitted = this.saves.complete(event.data.requestId);
      const saved = event.data.state.resource;
      if (submitted === null || this.resource?.id !== saved.id) return;
      this.resource = reconcileSavedResource(this.resource, submitted, saved);
      this.savedResource = structuredClone(event.data.state.savedResource);
      this.baselineResource = structuredClone(saved);
      this.resources = event.data.state.resources;
      if (this.awaitingSaveTransition) {
        if (this.hasUnsavedChanges()) this.save();
        else {
          const transition = this.pendingTransition;
          this.awaitingSaveTransition = false;
          this.pendingTransition = null;
          transition?.();
        }
      }
      this.autoSave.schedule();
    } else if (event.data.type === "formula.saveFailed") {
      if (this.saves.complete(event.data.requestId) === null) return;
      this.autoSave.cancel();
      this.awaitingSaveTransition = false;
      this.pendingTransition = null;
      this.notice = { tone: "error", message: event.data.error };
    } else if (event.data.type === "formula.resources") {
      this.resources = event.data.resources;
    } else if (event.data.type === "formula.operationCanceled") {
      this.changingResource = false;
      this.autoSave.activity();
    } else if (event.data.type === "formula.jsonDocument") {
      this.autoSave.cancel();
      this.jsonDocument = event.data.serialized;
      this.notice = { tone: "info", message: "" };
    } else if (event.data.type === "formula.jsonApplied") {
      this.resource = structuredClone(event.data.resource);
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
    this.post({ type: "formula.applyJson", serialized: event.detail.serialized, currentId: this.resource.id });
  };

  private change(change: (resource: FormulaResource) => void): void {
    if (this.resource === null) return;
    const resource = structuredClone(this.resource);
    change(resource);
    this.resource = resource;
    this.autoSave.activity();
    this.requestUpdate();
  }

  private readonly save = (): void => {
    if (this.resource === null) return;
    const request = this.saves.start(this.resource);
    if (request === null) return;
    this.autoSave.cancel();
    this.post({ type: "formula.save", resource: request.value, requestId: request.requestId });
    this.requestUpdate();
  };

  private hasUnsavedChanges(): boolean { return this.resource !== null && isResourceDirty(this.resource, this.baselineResource); }

  private readonly toggleAutoSave = (): void => {
    this.change((resource) => { resource.preferences = { ...resource.preferences, autoSaveEnabled: !isAutoSaveEnabled(resource.preferences) }; });
  };

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
    else { this.awaitingSaveTransition = true; this.save(); }
    this.autoSave.schedule();
    this.requestUpdate();
  };

  private readonly changeCode = (event: Event): void => {
    if (this.resource === null || !(event.currentTarget instanceof HTMLTextAreaElement)) return;
    const candidate = event.currentTarget.value;
    const size = assessDocumentSize(candidate);
    if (size.exceedsLimit) {
      event.currentTarget.value = this.resource.code;
      this.notice = { tone: "error", message: documentSizeLimitMessage(size.bytes) };
    } else {
      this.change((resource) => { resource.code = candidate; });
      this.notice = size.shouldWarn
        ? { tone: "warning", message: t("text.theFormulaUsesArg0OfArg1", { arg0: formatBytes(size.bytes), arg1: formatBytes(MAX_DOCUMENT_BYTES) }) }
        : { tone: "info", message: "" };
    }
    this.requestUpdate();
  };

  private toggleSelection(id: string, event: Event): void {
    const checked = event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;
    this.selectedIds = new Set(this.selectedIds);
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    this.requestUpdate();
  }

  private post(message: FormulaToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("formulas-app", FormulasApp);
document.body.append(document.createElement("formulas-app"));
