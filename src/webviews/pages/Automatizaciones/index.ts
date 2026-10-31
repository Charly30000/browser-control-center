import { t } from "../../../localization";
import { viewportPresetLabel } from "../../../localization/displayLabels";
import { LitElement, html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import type { NodeDescriptor } from "../../../application/automations/nodeRegistry";
import { createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationDocument, type AutomationEdge, type AutomationGroup, type AutomationNode, type AutomationNodeType, type AutomationProcess } from "../../../domain/automations/automation";
import { applyAutomationDocumentSelection, selectAutomationDocument } from "../../../domain/automations/automationSelection";
import { AUTOMATION_EXAMPLE_URL, createCompleteAutomationExample } from "../../../domain/automations/exampleAutomation";
import type { GroupExecutionSummary, NodeExecutionState, ProcessExecutionSnapshot } from "../../../domain/automations/executionState";
import type { JsonValue } from "../../../domain/manual/storageValue";
import { VIEWPORT_PRESETS, type ViewportPresetId } from "../../../domain/manual/manualProfile";
import type { AutomationJsonScope, AutomationResourceCatalogs, AutomationToExtensionMessage, ExtensionToAutomationMessage } from "../../../shared/messages/automationMessages";
import { assessDocumentSize, documentSizeLimitMessage, formatBytes, MAX_DOCUMENT_BYTES } from "../../../domain/importExport/documentSize";
import type { NoticeTone } from "../../components/statusNotice";
import type { JsonEditorApplyDetail } from "../../components/jsonDocumentEditor";
import type { UnsavedChangesChoice } from "../../components/unsavedChangesDialog";
import { isResourceDirty } from "../../../domain/resources/resourceDirtyState";
import { isAutoSaveEnabled } from "../../../domain/resources/editorPreferences";
import { reconcileSavedResource } from "../../../domain/resources/reconcileSavedResource";
import { AutoSaveController } from "../../components/autoSaveController";
import { renderAutoSaveControl } from "../../components/autoSaveControl";
import { SaveRequestTracker } from "../../components/saveRequestTracker";
import { RowReorderController } from "../../components/rowReorder";
import { moveEntry, type EntryDropPosition } from "../../../domain/manual/reorderEntries";
import { moveAutomationProcess } from "../../../domain/automations/reorderAutomation";
import "../../components/jsonDocumentEditor";
import { DestructiveConfirmationClient } from "../../components/confirmDestructiveAction";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./canvas/FlowCanvas";
import "./canvas/interaction.css";
import type { FlowCanvas } from "./canvas/FlowCanvas";
import { renderAutomationTree, type AutomationTreeCallbacks } from "./components/AutomationTree";
import { renderNodeInspector } from "./components/NodeInspector";
import { renderNodePalette } from "./components/NodePalette";
import { renderExampleGuide } from "./components/ExampleGuide";
import "./automatizaciones.css";

const inputValue = (event: Event): string => { const target = event.currentTarget; return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : ""; };
const controlValue = (event: Event): string => { const target = event.currentTarget; return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.value : ""; };
const checkedValue = (event: Event): boolean => event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;
const NEW_NODE_POSITION = Object.freeze({ x: 80, y: 70 });
const cloneProcess = (process: AutomationProcess, name: string): AutomationProcess => {
  const nodeIds = new Map(process.nodes.map((node) => [node.id, crypto.randomUUID()]));
  return { ...structuredClone(process), id: crypto.randomUUID(), name, nodes: process.nodes.map((node) => ({ ...structuredClone(node), id: nodeIds.get(node.id) ?? crypto.randomUUID() })), edges: process.edges.map((edge) => ({ ...structuredClone(edge), id: crypto.randomUUID(), sourceNodeId: nodeIds.get(edge.sourceNodeId) ?? edge.sourceNodeId, targetNodeId: nodeIds.get(edge.targetNodeId) ?? edge.targetNodeId })) };
};

class AutomationsApp extends LitElement {
  private document: AutomationDocument | null = null;
  private savedDocument: AutomationDocument | null = null;
  private descriptors: readonly NodeDescriptor[] = [];
  private resources: AutomationResourceCatalogs = { formulas: [], arrays: [] };
  private selectedGroupId: string | null = null;
  private selectedProcessId: string | null = null;
  private selectionKind: AutomationJsonScope["kind"] = "group";
  private selectedNodeIds: readonly string[] = [];
  private nodeValidationError: string | null = null;
  private validationRequestId: string | null = null;
  private copiedProcess: AutomationProcess | null = null;
  private processStates: Readonly<Record<string, ProcessExecutionSnapshot>> = {};
  private groupStates: Readonly<Record<string, GroupExecutionSummary>> = {};
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };
  private jsonDocument: string | null = null;
  private jsonScope: AutomationJsonScope | null = null;
  private readonly confirmations = new DestructiveConfirmationClient((message) => this.post(message));
  private pendingTransition: (() => void) | null = null;
  private awaitingSaveTransition = false;
  private unsavedMessage: string | null = null;
  private changingDocument = false;
  private readonly saves = new SaveRequestTracker<AutomationDocument>("automation");
  private readonly treeReorder = new RowReorderController();
  private readonly autoSave = new AutoSaveController(this, {
    enabled: () => isAutoSaveEnabled(this.document?.preferences),
    canSave: () => !this.saves.pending && !this.changingDocument && this.jsonDocument === null && this.unsavedMessage === null && this.pendingTransition === null,
    dirty: () => this.hasUnsavedChanges(),
    save: () => this.save()
  });
  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "automation.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); this.confirmations.cancelPending(); this.treeReorder.cancel(); super.disconnectedCallback(); }

  protected override render() {
    const document = this.document;
    if (document === null) return html`<main class="automations-shell loading">${t("text.loadingAutomations")}</main>`;
    const group = this.selectedGroup(); const process = this.selectedProcess(); const selectedNode = this.selectedNode(); const descriptor = selectedNode === null ? null : this.descriptors.find(({ type }) => type === selectedNode.type) ?? null;
    const isCompleteExample = process?.nodes.some(({ type, config }) => type === "navigate" && config.url === AUTOMATION_EXAMPLE_URL) === true;
    const processState = process === null ? undefined : this.processStates[process.id]; const nodeStates = Object.fromEntries((processState?.nodes ?? []).map(({ nodeId, state }) => [nodeId, state])) as Record<string, NodeExecutionState>;
    const waitingNode = processState?.nodes.find(({ state }) => state === "waiting-user"); const dirty = JSON.stringify(document) !== JSON.stringify(this.savedDocument);
    const callbacks: AutomationTreeCallbacks = {
      groupReorder: { controller: this.treeReorder, group: "automation-groups", move: (source, target, position) => this.mutate((draft) => moveEntry(draft.groups, source, target, position)) },
      processReorder: { controller: this.treeReorder, group: "automation-processes", move: (source, target, position) => {
        const owner = this.document?.groups.find(({ processes }) => processes.some(({ id }) => id === target));
        if (owner !== undefined) this.placeProcess(source, owner.id, target, position);
      } },
      processDropZone: (groupId) => ({ controller: this.treeReorder, group: "automation-processes", drop: (processId) => this.placeProcess(processId, groupId) }),
      setGroupExpanded: (groupId, expanded) => this.mutate((draft) => { const group = draft.groups.find(({ id }) => id === groupId); if (group !== undefined) group.expanded = expanded; }),
      selectGroup: (id) => this.selectGroup(id), selectProcess: (groupId, processId) => this.selectProcess(groupId, processId), addProcess: (id) => this.addProcess(id),
      renameGroup: (id, name) => this.renameGroup(id, name), removeGroup: (id) => { void this.removeGroup(id); },
      renameProcess: (groupId, processId, name) => this.renameProcess(groupId, processId, name),
      runGroup: (id) => { this.selectGroup(id); this.post({ type: "automation.runGroup", groupId: id, document }); }, runProcess: (groupId, processId) => { this.selectProcess(groupId, processId); this.post({ type: "automation.runProcess", groupId, processId, document }); },
      stop: () => this.post({ type: "automation.stop", force: false }),
      duplicateProcess: (groupId, processId) => this.duplicateProcess(groupId, processId), copyProcess: (groupId, processId) => this.copyProcess(groupId, processId),
      moveProcess: (source, processId, target) => this.moveProcess(source, processId, target), removeProcess: (groupId, processId) => { void this.removeProcess(groupId, processId); }
    };
    return html`<main class="automations-shell">
      ${renderAutoSaveControl(isAutoSaveEnabled(document.preferences), this.toggleAutoSave)}
      <header class="automation-header"><div><h1>${t("navigation.automations")}</h1><p>${t("text.visualProcessesRunInCleanIndependentSessionsOfTheSelectedBrowser")}</p></div><div class="toolbar">
        <button class="primary" @click=${this.newGroup}>${t("text.newGroup")}</button><button @click=${this.addExample}>${t("text.addExample")}</button><button @click=${() => this.guardTransition(() => this.post({ type: "automation.import" }), t("text.saveTheAutomationBeforeImporting"))}>${t("actions.import")}</button><button @click=${this.exportSelection}>${t("actions.export")}</button><button @click=${this.viewJson}>${t("actions.viewJson")}</button>
        ${this.copiedProcess !== null && group !== null ? html`<button @click=${() => this.pasteProcess(group.id)}>${t("text.pasteProcess")}</button>` : nothing}
        <button class="primary" ?disabled=${this.saves.pending} @click=${this.save}>${t("actions.save")}</button><span class=${dirty ? "dirty-state dirty" : "dirty-state"} role="status">${this.saves.pending ? t("saveState.saving") : dirty ? t("saveState.dirty") : t("saveState.saved")}</span>
      </div></header>
      <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
      ${waitingNode === undefined ? nothing : html`<section class="waiting-banner"><strong>${t("text.waitingForUserAction")}</strong><span>${t("text.completeCAPTCHA2FAOrOAuthInTheBrowser")}</span><button class="primary" @click=${() => this.post({ type: "automation.continueUser", nodeId: waitingNode.nodeId })}>${t("text.continue")}</button><button @click=${() => this.post({ type: "automation.retryUser", nodeId: waitingNode.nodeId })}>${t("text.retry")}</button><button class="danger" @click=${() => this.post({ type: "automation.stop", force: false })}>${t("text.stop")}</button></section>`}
      <div class="automation-layout">
        ${renderAutomationTree(document, this.selectedGroupId, this.selectedProcessId, this.selectionKind, this.processStates, this.groupStates, callbacks)}
        <section class="workspace">
          ${process === null ? html`<div class="workspace-empty"><h2>${t("text.selectOrCreateAProcess")}</h2></div>` : html`
            <div class="process-toolbar">
              <div class="process-identity">
                <label>${t("text.groupName")}<input .value=${live(group?.name ?? "")} title=${group?.name ?? ""} @input=${(event: Event) => { if (group) this.renameGroup(group.id, inputValue(event)); }}></label>
                <label>${t("text.processName")}<input .value=${live(process.name)} title=${process.name} @input=${(event: Event) => { if (group) this.renameProcess(group.id, process.id, inputValue(event)); }}></label>
              </div>
              <div class="process-execution-actions">
              <button class="primary" @click=${() => group && this.post({ type: "automation.runProcess", groupId: group.id, processId: process.id, document })}>${t("text.run")}</button>
              <button @click=${() => this.post({ type: "automation.pause" })}>${t("text.pause")}</button><button @click=${() => this.post({ type: "automation.resume" })}>${t("text.continue")}</button>
              <button @click=${() => this.post({ type: "automation.stop", force: false })}>${t("text.stop")}</button><button class="danger" @click=${() => this.post({ type: "automation.stop", force: true })}>${t("text.forceStop")}</button>
              </div>
            </div>
            <details class="process-settings"><summary>${t("text.viewportAndInitialVariables")}</summary><div>
              <label class="variables-field"><span>${t("text.jsonVariables")}</span><textarea rows="3" .value=${live(JSON.stringify(process.variables, null, 2))} @change=${(event: Event) => this.updateVariables(inputValue(event))}></textarea></label>
              <div class="viewport-fields">
                <label><span>${t("text.preset")}</span><select .value=${live(process.viewport.preset)} @change=${(event: Event) => this.updateViewportPreset(controlValue(event) as ViewportPresetId)}>${(["desktop", "laptop", "tabletPortrait", "tabletLandscape", "mobilePortrait", "mobileLandscape", "custom"] as const).map((preset) => html`<option value=${preset} .selected=${preset === process.viewport.preset}>${viewportPresetLabel(preset)}</option>`)}</select></label>
                <label><span>${t("text.width")}</span><input type="number" min="1" .value=${live(String(process.viewport.width))} @change=${(event: Event) => this.updateViewportNumber("width", controlValue(event))}></label>
                <label><span>${t("text.height")}</span><input type="number" min="1" .value=${live(String(process.viewport.height))} @change=${(event: Event) => this.updateViewportNumber("height", controlValue(event))}></label>
                <label><span>${t("text.scale")}</span><input type="number" min="0.1" step="0.1" .value=${live(String(process.viewport.deviceScaleFactor))} @change=${(event: Event) => this.updateViewportNumber("deviceScaleFactor", controlValue(event))}></label>
                <label class="check-field"><input type="checkbox" .checked=${live(process.viewport.hasTouch)} @change=${(event: Event) => this.updateProcess((draft) => { draft.viewport = { ...draft.viewport, preset: "custom", hasTouch: checkedValue(event) }; })}> ${t("text.touch")}</label>
                <label class="check-field"><input type="checkbox" .checked=${live(process.viewport.isMobile)} @change=${(event: Event) => this.updateProcess((draft) => { draft.viewport = { ...draft.viewport, preset: "custom", isMobile: checkedValue(event) }; })}> ${t("text.mobile")}</label>
              </div>
            </div></details>
            ${isCompleteExample ? renderExampleGuide(process.name) : nothing}
            <div class="canvas-workspace">
              ${renderNodePalette(this.descriptors, (type) => this.addNode(type))}
              <flow-canvas .nodes=${process.nodes} .edges=${process.edges} .descriptors=${this.descriptors} .states=${nodeStates} @flow-change=${this.onFlowChange} @selection-change=${this.onSelectionChange}></flow-canvas>
            </div>`}
        </section>
      </div>
      ${renderNodeInspector(
        selectedNode,
        descriptor,
        this.resources,
        this.nodeValidationError,
        (change) => this.updateNode(selectedNode?.id ?? "", change),
        (fieldKey) => { if (selectedNode !== null) this.post({ type: "automation.selectElement", nodeId: selectedNode.id, fieldKey }); },
        this.confirmations.confirm
      )}
    </main>
    ${this.jsonDocument === null ? nothing : html`<json-document-editor
      .value=${this.jsonDocument}
      .heading=${this.jsonScope?.kind === "process" ? t("text.jsonForFlowArg0", { arg0: process?.name ?? t("text.selected") }) : t("text.jsonForGroupArg0", { arg0: group?.name ?? t("text.selected") })}
      .errorMessage=${this.notice.tone === "error" ? this.notice.message : ""}
      @json-editor-change=${this.changeJson}
      @json-editor-close=${this.closeJsonEditor}
      @json-editor-apply=${this.applyJson}
    ></json-document-editor>`}
    ${this.unsavedMessage === null ? nothing : html`<unsaved-changes-dialog .message=${this.unsavedMessage} @unsaved-choice=${this.resolveUnsavedChoice}></unsaved-changes-dialog>`}`;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToAutomationMessage>): void => {
    const message = event.data;
    if (message.type === "ui.destructiveActionConfirmed") {
      this.confirmations.resolve(message);
    } else if (message.type === "automation.state") {
      this.autoSave.cancel();
      this.saves.reset();
      this.changingDocument = false;
      this.applyDocumentState(message.document);
      this.descriptors = message.descriptors;
      this.resources = message.resources;
      if (this.awaitingSaveTransition) {
        const transition = this.pendingTransition;
        this.awaitingSaveTransition = false;
        this.pendingTransition = null;
        transition?.();
      }
    } else if (message.type === "automation.saved") {
      const submitted = this.saves.complete(message.requestId);
      if (submitted === null || this.document?.id !== message.document.id) return;
      this.document = reconcileSavedResource(this.document, submitted, message.document);
      this.savedDocument = structuredClone(message.document);
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
    } else if (message.type === "automation.saveFailed") {
      if (this.saves.complete(message.requestId) === null) return;
      this.autoSave.cancel();
      this.awaitingSaveTransition = false;
      this.pendingTransition = null;
      this.notice = { tone: "error", message: message.error };
    } else if (message.type === "automation.operationCanceled") { this.changingDocument = false; this.autoSave.activity(); }
    else if (message.type === "automation.resources") this.resources = message.resources;
    else if (message.type === "automation.jsonDocument") { this.autoSave.cancel(); this.jsonDocument = message.serialized; this.jsonScope = message.scope; this.notice = { tone: "info", message: "" }; }
    else if (message.type === "automation.jsonApplied") {
      this.applyScopedJson(message.document, message.scope);
      this.jsonDocument = null;
      this.jsonScope = null;
      this.autoSave.activity();
    }
    else if (message.type === "automation.nodeValidation") { if (message.requestId === this.validationRequestId && this.selectedNodeIds.includes(message.nodeId)) this.nodeValidationError = message.error; }
    else if (message.type === "automation.elementSelected") {
      this.updateNode(message.nodeId, (node) => { node.config[message.fieldKey] = message.selector; });
      this.notice = { tone: "success", message: t("text.selectorCapturedFromTheBrowser") };
    }
    else if (message.type === "automation.notice") {
      this.notice = { tone: message.tone, message: message.message };
      if (message.tone === "error") { this.awaitingSaveTransition = false; this.pendingTransition = null; this.changingDocument = false; }
    }
    else if (message.type === "automation.processState") {
      this.processStates = { ...this.processStates, [message.snapshot.processId]: message.snapshot };
      if (["queued", "running", "paused", "waiting-user"].includes(message.snapshot.state)) this.showProcess(message.snapshot.processId);
    }
    else if (message.type === "automation.groupState") {
      this.groupStates = { ...this.groupStates, [message.summary.groupId]: message.summary };
      if (message.summary.runningProcessId !== null) this.showProcess(message.summary.runningProcessId);
    }
    this.requestUpdate();
  };

  private readonly closeJsonEditor = (): void => { this.jsonDocument = null; this.jsonScope = null; this.autoSave.activity(); this.requestUpdate(); };
  private readonly changeJson = (event: CustomEvent<JsonEditorApplyDetail>): void => { this.jsonDocument = event.detail.serialized; };

  private readonly applyJson = (event: CustomEvent<JsonEditorApplyDetail>): void => {
    if (this.document === null || this.jsonScope === null) return;
    this.post({ type: "automation.applyJson", serialized: event.detail.serialized, scope: this.jsonScope });
  };

  private selectedJsonDocument(): { readonly document: AutomationDocument; readonly scope: AutomationJsonScope } | null {
    const document = this.document;
    const group = this.selectedGroup();
    if (document === null || group === null) return null;
    if (this.selectionKind === "process") {
      const process = this.selectedProcess();
      if (process === null) return null;
      const scope = { kind: "process" as const, groupId: group.id, processId: process.id };
      return { document: selectAutomationDocument(document, scope), scope };
    }
    const scope = { kind: "group" as const, groupId: group.id };
    return { document: selectAutomationDocument(document, scope), scope };
  }

  private readonly exportSelection = (): void => {
    const selected = this.selectedJsonDocument();
    if (selected === null) { this.notice = { tone: "warning", message: t("text.selectAGroupOrFlowToExport") }; this.requestUpdate(); return; }
    this.post({ type: "automation.export", document: selected.document });
  };

  private readonly viewJson = (): void => {
    const selected = this.selectedJsonDocument();
    if (selected === null) { this.notice = { tone: "warning", message: t("text.selectAGroupOrFlowToViewItsJSON") }; this.requestUpdate(); return; }
    this.jsonScope = selected.scope;
    this.post({ type: "automation.viewJson", document: selected.document, scope: selected.scope });
  };

  private applyScopedJson(scopedDocument: AutomationDocument, scope: AutomationJsonScope): void {
    const scopedGroup = scopedDocument.groups[0];
    if (scopedGroup === undefined) return;
    if (this.document === null) return;
    this.document = applyAutomationDocumentSelection(this.document, scopedDocument, scope, () => crypto.randomUUID());
    if (scopedDocument.preferences !== undefined) this.document.preferences = structuredClone(scopedDocument.preferences);
    this.selectedGroupId = scope.groupId;
    this.selectedProcessId = scope.kind === "process" ? scope.processId : scopedGroup.processes[0]?.id ?? null;
    this.selectionKind = scope.kind;
    this.selectedNodeIds = [];
    this.requestUpdate();
  }

  private applyDocumentState(document: AutomationDocument): void {
    const nextDocument = structuredClone(document);
    const processOwner = this.selectedProcessId === null
      ? undefined
      : nextDocument.groups.find(({ processes }) => processes.some(({ id }) => id === this.selectedProcessId));
    const selectedGroup = processOwner
      ?? nextDocument.groups.find(({ id }) => id === this.selectedGroupId)
      ?? nextDocument.groups[0];
    const selectedProcess = selectedGroup?.processes.find(({ id }) => id === this.selectedProcessId)
      ?? selectedGroup?.processes[0];
    const nodeIds = new Set(selectedProcess?.nodes.map(({ id }) => id) ?? []);

    this.document = nextDocument;
    this.savedDocument = structuredClone(document);
    this.selectedGroupId = selectedGroup?.id ?? null;
    this.selectedProcessId = selectedProcess?.id ?? null;
    this.selectedNodeIds = this.selectedNodeIds.filter((id) => nodeIds.has(id));
    this.nodeValidationError = null;
  }

  private mutate(change: (document: AutomationDocument) => void): void {
    if (this.document === null) return;
    const draft = structuredClone(this.document);
    change(draft);
    const size = assessDocumentSize(JSON.stringify(draft));
    if (size.exceedsLimit) {
      this.notice = { tone: "error", message: documentSizeLimitMessage(size.bytes) };
      this.requestUpdate();
      return;
    }
    this.document = draft;
    this.autoSave.activity();
    if (size.shouldWarn) this.notice = { tone: "warning", message: t("text.theAutomationUsesArg0OfArg1", { arg0: formatBytes(size.bytes), arg1: formatBytes(MAX_DOCUMENT_BYTES) }) };
    this.requestUpdate();
  }
  private readonly save = (): void => {
    if (this.document === null) return;
    const request = this.saves.start(this.document);
    if (request === null) return;
    this.autoSave.cancel();
    this.post({ type: "automation.save", document: request.value, requestId: request.requestId });
    this.requestUpdate();
  };

  private hasUnsavedChanges(): boolean { return this.document !== null && isResourceDirty(this.document, this.savedDocument); }

  private readonly toggleAutoSave = (): void => {
    this.mutate((document) => { document.preferences = { ...document.preferences, autoSaveEnabled: !isAutoSaveEnabled(document.preferences) }; });
  };
  private guardTransition(transition: () => void, message: string): void {
    this.autoSave.cancel();
    const begin = () => { this.changingDocument = true; this.autoSave.cancel(); transition(); };
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
  private selectedGroup(): AutomationGroup | null { return this.document?.groups.find(({ id }) => id === this.selectedGroupId) ?? null; }
  private selectedProcess(): AutomationProcess | null { return this.selectedGroup()?.processes.find(({ id }) => id === this.selectedProcessId) ?? null; }
  private selectedNode(): AutomationNode | null { const process = this.selectedProcess(); return this.selectedNodeIds.length === 1 ? process?.nodes.find(({ id }) => id === this.selectedNodeIds[0]) ?? null : null; }
  private readonly newGroup = (): void => { const group = createAutomationGroup(crypto.randomUUID(), t("text.groupArg0", { arg0: (this.document?.groups.length ?? 0) + 1 })); this.mutate((draft) => draft.groups.push(group)); this.selectedGroupId = group.id; this.selectedProcessId = null; this.selectionKind = "group"; };
  private readonly addExample = (): void => {
    const group = createCompleteAutomationExample(() => crypto.randomUUID());
    this.mutate((draft) => draft.groups.push(group));
    this.selectedGroupId = group.id;
    this.selectedProcessId = group.processes[0]?.id ?? null;
    this.selectionKind = "group";
    this.selectedNodeIds = [];
    this.notice = { tone: "success", message: t("text.completeExampleAddedSaveOrRunItToSeeItWorkOffline") };
    this.requestUpdate();
  };
  private renameGroup(groupId: string, name: string): void { this.mutate((draft) => { const group = draft.groups.find(({ id }) => id === groupId); if (group !== undefined) group.name = name; }); }
  private renameProcess(groupId: string, processId: string, name: string): void {
    this.mutate((draft) => { const process = draft.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId); if (process !== undefined) process.name = name; });
  }
  private async removeGroup(groupId: string): Promise<void> {
    const group = this.document?.groups.find(({ id }) => id === groupId);
    if (group === undefined || !(await this.confirmations.confirm({
      question: t("text.deleteGroupArg0", { arg0: group.name }),
      detail: t("text.itsArg0Arg1WillAlsoBeDeletedThisActionCannotBeUndoneFromTheEditor", { arg0: group.processes.length, arg1: group.processes.length === 1 ? t("text.process2") : t("text.processes") })
    }))) return;
    this.mutate((draft) => { draft.groups = draft.groups.filter(({ id }) => id !== groupId); });
    if (this.selectedGroupId === groupId) { const first = this.document?.groups[0]; this.selectedGroupId = first?.id ?? null; this.selectedProcessId = first?.processes[0]?.id ?? null; this.selectionKind = "group"; this.selectedNodeIds = []; }
  }
  private addProcess(groupId: string): void {
    const process = createAutomationProcess(crypto.randomUUID(), t("text.newProcess"));
    this.mutate((draft) => {
      const group = draft.groups.find(({ id }) => id === groupId);
      if (group !== undefined) { group.processes.push(process); group.expanded = true; }
    });
    this.selectedGroupId = groupId;
    this.selectedProcessId = process.id;
    this.selectionKind = "process";
    this.selectedNodeIds = [];
    void this.updateComplete.then(() => {
      const row = [...this.querySelectorAll<HTMLElement>(".process-row")].find((entry) => entry.dataset.processId === process.id);
      const input = row?.querySelector<HTMLInputElement>(".process-name");
      input?.focus();
      input?.select();
    });
  }
  private selectGroup(id: string): void { this.selectedGroupId = id; this.selectedProcessId = this.document?.groups.find((group) => group.id === id)?.processes[0]?.id ?? null; this.selectionKind = "group"; this.selectedNodeIds = []; this.nodeValidationError = null; this.requestUpdate(); }
  private selectProcess(groupId: string, processId: string): void { this.selectedGroupId = groupId; this.selectedProcessId = processId; this.selectionKind = "process"; this.selectedNodeIds = []; this.nodeValidationError = null; this.requestUpdate(); }
  private showProcess(processId: string): void {
    const group = this.document?.groups.find(({ processes }) => processes.some(({ id }) => id === processId));
    if (group === undefined) return;
    const changed = this.selectedProcessId !== processId;
    if (changed) { this.selectedNodeIds = []; this.nodeValidationError = null; }
    this.selectedGroupId = group.id;
    this.selectedProcessId = processId;
    this.selectionKind = "process";
    if (changed) {
      this.requestUpdate();
      void this.updateComplete.then(() => this.querySelector<HTMLElement>(".process-row.selected")?.scrollIntoView({ block: "nearest" }));
    }
  }
  private duplicateProcess(groupId: string, processId: string): void { const source = this.document?.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId); if (source === undefined) return; const copy = cloneProcess(source, t("names.processCopy", { name: source.name })); this.mutate((draft) => draft.groups.find(({ id }) => id === groupId)?.processes.push(copy)); this.selectedProcessId = copy.id; this.selectionKind = "process"; }
  private copyProcess(groupId: string, processId: string): void { const source = this.document?.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId); if (source !== undefined) { this.copiedProcess = structuredClone(source); this.notice = { tone: "info", message: t("text.processCopiedSelectAGroupAndClickPasteProcess") }; this.requestUpdate(); } }
  private pasteProcess(groupId: string): void { if (this.copiedProcess === null) return; const copy = cloneProcess(this.copiedProcess, t("names.processCopy", { name: this.copiedProcess.name })); this.mutate((draft) => draft.groups.find(({ id }) => id === groupId)?.processes.push(copy)); this.selectedProcessId = copy.id; this.selectionKind = "process"; }
  private moveProcess(sourceGroupId: string, processId: string, targetGroupId: string): void {
    if (this.document?.groups.find(({ id }) => id === sourceGroupId)?.processes.some(({ id }) => id === processId)) this.placeProcess(processId, targetGroupId);
  }
  private placeProcess(processId: string, targetGroupId: string, targetProcessId: string | null = null, position: EntryDropPosition = "after"): void {
    let moved = false;
    this.mutate((draft) => { moved = moveAutomationProcess(draft, processId, targetGroupId, targetProcessId, position); });
    if (moved) {
      this.selectedGroupId = targetGroupId;
      this.selectedProcessId = processId;
      this.selectionKind = "process";
      this.selectedNodeIds = [];
      this.nodeValidationError = null;
    }
  }
  private async removeProcess(groupId: string, processId: string): Promise<void> {
    const process = this.document?.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId);
    if (process === undefined || !(await this.confirmations.confirm({
      question: t("text.deleteProcessArg0", { arg0: process.name }),
      detail: t("text.itsArg0Arg1AndAllTheirConnectionsWillBeDeletedThisActionCannotBeUndoneFromThe", { arg0: process.nodes.length, arg1: process.nodes.length === 1 ? t("text.node2") : t("text.nodes2") })
    }))) return;
    this.mutate((draft) => { const group = draft.groups.find(({ id }) => id === groupId); if (group) group.processes = group.processes.filter(({ id }) => id !== processId); });
    if (this.selectedProcessId === processId) this.selectedProcessId = this.selectedGroup()?.processes[0]?.id ?? null;
  }
  private updateProcess(change: (process: AutomationProcess) => void): void { const id = this.selectedProcessId; this.mutate((document) => { for (const group of document.groups) { const process = group.processes.find((item) => item.id === id); if (process) { change(process); return; } } }); }
  private updateVariables(raw: string): void { try { const parsed: unknown = JSON.parse(raw); if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(); this.updateProcess((process) => { process.variables = parsed as Record<string, JsonValue>; }); this.notice = { tone: "success", message: t("text.initialVariablesUpdated") }; } catch { this.notice = { tone: "error", message: t("text.variablesMustBeAJSONObject") }; } this.requestUpdate(); }
  private updateViewportPreset(preset: ViewportPresetId): void { this.updateProcess((process) => { if (preset === "custom") process.viewport = { ...process.viewport, preset }; else process.viewport = { preset, ...VIEWPORT_PRESETS[preset] }; }); }
  private updateViewportNumber(field: "width" | "height" | "deviceScaleFactor", raw: string): void { const value = Number(raw); if (!Number.isFinite(value) || value <= 0) { this.notice = { tone: "error", message: t("text.viewportDimensionsMustBeNumbersGreaterThanZero") }; this.requestUpdate(); return; } this.updateProcess((process) => { process.viewport = { ...process.viewport, preset: "custom", [field]: value }; }); }
  private addNode(type: AutomationNodeType): void { const process = this.selectedProcess(); if (process === null) return; const node = createAutomationNode(crypto.randomUUID(), type, { ...NEW_NODE_POSITION }); this.updateProcess((draft) => draft.nodes.push(node)); this.selectedNodeIds = [node.id]; this.validateNode(node.id); }
  private updateNode(id: string, change: (node: AutomationNode) => void): void { this.updateProcess((process) => { const node = process.nodes.find((item) => item.id === id); if (node) change(node); }); this.validateNode(id); }
  private readonly onFlowChange = (event: CustomEvent<{ nodes: readonly AutomationNode[]; edges: readonly AutomationEdge[] }>): void => { this.updateProcess((process) => { process.nodes = [...structuredClone(event.detail.nodes)]; process.edges = [...structuredClone(event.detail.edges)]; }); };
  private readonly onSelectionChange = (event: CustomEvent<{ ids: readonly string[] }>): void => { this.selectedNodeIds = event.detail.ids; this.nodeValidationError = null; if (event.detail.ids.length === 1) this.validateNode(event.detail.ids[0] ?? ""); this.requestUpdate(); };
  private validateNode(nodeId: string): void { const node = this.selectedProcess()?.nodes.find(({ id }) => id === nodeId); if (node === undefined) return; const requestId = crypto.randomUUID(); this.validationRequestId = requestId; this.post({ type: "automation.validateNode", requestId, nodeId, nodeType: node.type, config: node.config }); }
  private post(message: AutomationToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("automations-app", AutomationsApp);
document.body.append(document.createElement("automations-app"));

declare global { interface HTMLElementTagNameMap { "flow-canvas": FlowCanvas; } }
