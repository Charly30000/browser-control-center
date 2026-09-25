import { LitElement, html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import type { NodeDescriptor } from "../../../application/automations/nodeRegistry";
import { createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationDocument, type AutomationEdge, type AutomationGroup, type AutomationNode, type AutomationNodeType, type AutomationProcess } from "../../../domain/automations/automation";
import { AUTOMATION_EXAMPLE_URL, createCompleteAutomationExample } from "../../../domain/automations/exampleAutomation";
import type { GroupExecutionSummary, NodeExecutionState, ProcessExecutionSnapshot } from "../../../domain/automations/executionState";
import type { JsonValue } from "../../../domain/manual/storageValue";
import { VIEWPORT_PRESETS, type ViewportPresetId } from "../../../domain/manual/manualProfile";
import type { AutomationResourceCatalogs, AutomationToExtensionMessage, ExtensionToAutomationMessage } from "../../../shared/messages/automationMessages";
import type { NoticeTone } from "../../components/statusNotice";
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
  private selectedNodeIds: readonly string[] = [];
  private nodeValidationError: string | null = null;
  private validationRequestId: string | null = null;
  private copiedProcess: AutomationProcess | null = null;
  private processStates: Readonly<Record<string, ProcessExecutionSnapshot>> = {};
  private groupStates: Readonly<Record<string, GroupExecutionSummary>> = {};
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };
  private readonly confirmations = new DestructiveConfirmationClient((message) => this.post(message));
  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "automation.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); this.confirmations.cancelPending(); super.disconnectedCallback(); }

  protected override render() {
    const document = this.document;
    if (document === null) return html`<main class="automations-shell loading">Cargando automatizaciones…</main>`;
    const group = this.selectedGroup(); const process = this.selectedProcess(); const selectedNode = this.selectedNode(); const descriptor = selectedNode === null ? null : this.descriptors.find(({ type }) => type === selectedNode.type) ?? null;
    const isCompleteExample = process?.nodes.some(({ type, config }) => type === "navigate" && config.url === AUTOMATION_EXAMPLE_URL) === true;
    const processState = process === null ? undefined : this.processStates[process.id]; const nodeStates = Object.fromEntries((processState?.nodes ?? []).map(({ nodeId, state }) => [nodeId, state])) as Record<string, NodeExecutionState>;
    const waitingNode = processState?.nodes.find(({ state }) => state === "waiting-user"); const dirty = JSON.stringify(document) !== JSON.stringify(this.savedDocument);
    const callbacks: AutomationTreeCallbacks = {
      selectGroup: (id) => this.selectGroup(id), selectProcess: (groupId, processId) => this.selectProcess(groupId, processId), addProcess: (id) => this.addProcess(id),
      renameGroup: (id, name) => this.renameGroup(id, name), removeGroup: (id) => { void this.removeGroup(id); },
      runGroup: (id) => { this.selectGroup(id); this.post({ type: "automation.runGroup", groupId: id, document }); }, runProcess: (groupId, processId) => { this.selectProcess(groupId, processId); this.post({ type: "automation.runProcess", groupId, processId, document }); },
      stop: () => this.post({ type: "automation.stop", force: false }),
      duplicateProcess: (groupId, processId) => this.duplicateProcess(groupId, processId), copyProcess: (groupId, processId) => this.copyProcess(groupId, processId),
      moveProcess: (source, processId, target) => this.moveProcess(source, processId, target), removeProcess: (groupId, processId) => { void this.removeProcess(groupId, processId); }
    };
    return html`<main class="automations-shell">
      <header class="automation-header"><div><h1>Automatizaciones</h1><p>Procesos visuales ejecutados en sesiones limpias e independientes de Chromium.</p></div><div class="toolbar">
        <button class="primary" @click=${this.addExample}>Añadir ejemplo</button><button @click=${this.newGroup}>Nuevo grupo</button><button @click=${() => this.post({ type: "automation.import" })}>Importar</button><button @click=${() => this.post({ type: "automation.export", document })}>Exportar</button>
        ${this.copiedProcess !== null && group !== null ? html`<button @click=${() => this.pasteProcess(group.id)}>Pegar proceso</button>` : nothing}
        <button class="primary" @click=${() => this.post({ type: "automation.save", document })}>Guardar</button><span class=${dirty ? "dirty-state dirty" : "dirty-state"}>${dirty ? "Cambios sin guardar" : "Guardado"}</span>
      </div></header>
      <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
      ${waitingNode === undefined ? nothing : html`<section class="waiting-banner"><strong>Esperando acción del usuario</strong><span>Completa CAPTCHA, 2FA u OAuth en Chromium.</span><button class="primary" @click=${() => this.post({ type: "automation.continueUser", nodeId: waitingNode.nodeId })}>Continuar</button><button @click=${() => this.post({ type: "automation.retryUser", nodeId: waitingNode.nodeId })}>Reintentar</button><button class="danger" @click=${() => this.post({ type: "automation.stop", force: false })}>Detener</button></section>`}
      <div class="automation-layout">
        ${renderAutomationTree(document, this.selectedGroupId, this.selectedProcessId, this.processStates, this.groupStates, callbacks)}
        <section class="workspace">
          ${process === null ? html`<div class="workspace-empty"><h2>Selecciona o crea un proceso</h2></div>` : html`
            <div class="process-toolbar">
              <label>Grupo<input .value=${live(group?.name ?? "")} @input=${(event: Event) => this.mutate((draft) => { const item = draft.groups.find(({ id }) => id === group?.id); if (item) item.name = inputValue(event); })}></label>
              <label>Proceso<input .value=${live(process.name)} @input=${(event: Event) => this.updateProcess((draft) => { draft.name = inputValue(event); })}></label>
              <button class="primary" @click=${() => group && this.post({ type: "automation.runProcess", groupId: group.id, processId: process.id, document })}>▶ Run</button>
              <button @click=${() => this.post({ type: "automation.pause" })}>Pausar</button><button @click=${() => this.post({ type: "automation.resume" })}>Continuar</button>
              <button @click=${() => this.post({ type: "automation.stop", force: false })}>Stop</button><button class="danger" @click=${() => this.post({ type: "automation.stop", force: true })}>Force stop</button>
            </div>
            <details class="process-settings"><summary>Viewport y variables iniciales</summary><div>
              <label class="variables-field"><span>Variables JSON</span><textarea rows="3" .value=${live(JSON.stringify(process.variables, null, 2))} @change=${(event: Event) => this.updateVariables(inputValue(event))}></textarea></label>
              <div class="viewport-fields">
                <label><span>Preset</span><select .value=${live(process.viewport.preset)} @change=${(event: Event) => this.updateViewportPreset(controlValue(event) as ViewportPresetId)}>${["desktop", "laptop", "tabletPortrait", "tabletLandscape", "mobilePortrait", "mobileLandscape", "custom"].map((preset) => html`<option value=${preset} .selected=${preset === process.viewport.preset}>${preset}</option>`)}</select></label>
                <label><span>Ancho</span><input type="number" min="1" .value=${live(String(process.viewport.width))} @change=${(event: Event) => this.updateViewportNumber("width", controlValue(event))}></label>
                <label><span>Alto</span><input type="number" min="1" .value=${live(String(process.viewport.height))} @change=${(event: Event) => this.updateViewportNumber("height", controlValue(event))}></label>
                <label><span>Escala</span><input type="number" min="0.1" step="0.1" .value=${live(String(process.viewport.deviceScaleFactor))} @change=${(event: Event) => this.updateViewportNumber("deviceScaleFactor", controlValue(event))}></label>
                <label class="check-field"><input type="checkbox" .checked=${live(process.viewport.hasTouch)} @change=${(event: Event) => this.updateProcess((draft) => { draft.viewport = { ...draft.viewport, preset: "custom", hasTouch: checkedValue(event) }; })}> Táctil</label>
                <label class="check-field"><input type="checkbox" .checked=${live(process.viewport.isMobile)} @change=${(event: Event) => this.updateProcess((draft) => { draft.viewport = { ...draft.viewport, preset: "custom", isMobile: checkedValue(event) }; })}> Móvil</label>
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
    </main>`;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToAutomationMessage>): void => {
    const message = event.data;
    if (message.type === "ui.destructiveActionConfirmed") {
      this.confirmations.resolve(message);
    } else if (message.type === "automation.state") {
      this.applyDocumentState(message.document);
      this.descriptors = message.descriptors;
      this.resources = message.resources;
    } else if (message.type === "automation.resources") this.resources = message.resources;
    else if (message.type === "automation.nodeValidation") { if (message.requestId === this.validationRequestId && this.selectedNodeIds.includes(message.nodeId)) this.nodeValidationError = message.error; }
    else if (message.type === "automation.elementSelected") {
      this.updateNode(message.nodeId, (node) => { node.config[message.fieldKey] = message.selector; });
      this.notice = { tone: "success", message: "Selector capturado desde Chromium." };
    }
    else if (message.type === "automation.notice") this.notice = { tone: message.tone, message: message.message };
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

  private mutate(change: (document: AutomationDocument) => void): void { if (this.document === null) return; const draft = structuredClone(this.document); change(draft); this.document = draft; this.requestUpdate(); }
  private selectedGroup(): AutomationGroup | null { return this.document?.groups.find(({ id }) => id === this.selectedGroupId) ?? null; }
  private selectedProcess(): AutomationProcess | null { return this.selectedGroup()?.processes.find(({ id }) => id === this.selectedProcessId) ?? null; }
  private selectedNode(): AutomationNode | null { const process = this.selectedProcess(); return this.selectedNodeIds.length === 1 ? process?.nodes.find(({ id }) => id === this.selectedNodeIds[0]) ?? null : null; }
  private readonly newGroup = (): void => { const group = createAutomationGroup(crypto.randomUUID(), `Grupo ${(this.document?.groups.length ?? 0) + 1}`); this.mutate((draft) => draft.groups.push(group)); this.selectedGroupId = group.id; this.selectedProcessId = null; };
  private readonly addExample = (): void => {
    const group = createCompleteAutomationExample(() => crypto.randomUUID());
    this.mutate((draft) => draft.groups.push(group));
    this.selectedGroupId = group.id;
    this.selectedProcessId = group.processes[0]?.id ?? null;
    this.selectedNodeIds = [];
    this.notice = { tone: "success", message: "Ejemplo completo añadido. Guárdalo o ejecútalo para verlo funcionar sin conexión a Internet." };
    this.requestUpdate();
  };
  private renameGroup(groupId: string, name: string): void { this.mutate((draft) => { const group = draft.groups.find(({ id }) => id === groupId); if (group !== undefined) group.name = name; }); }
  private async removeGroup(groupId: string): Promise<void> {
    const group = this.document?.groups.find(({ id }) => id === groupId);
    if (group === undefined || !(await this.confirmations.confirm({
      question: `¿Eliminar el grupo «${group.name}»?`,
      detail: `También se eliminarán sus ${group.processes.length} ${group.processes.length === 1 ? "proceso" : "procesos"}. Esta acción no se puede deshacer desde el editor.`
    }))) return;
    this.mutate((draft) => { draft.groups = draft.groups.filter(({ id }) => id !== groupId); });
    if (this.selectedGroupId === groupId) { const first = this.document?.groups[0]; this.selectedGroupId = first?.id ?? null; this.selectedProcessId = first?.processes[0]?.id ?? null; this.selectedNodeIds = []; }
  }
  private addProcess(groupId: string): void { const process = createAutomationProcess(crypto.randomUUID(), "Nuevo proceso"); this.mutate((draft) => draft.groups.find(({ id }) => id === groupId)?.processes.push(process)); this.selectedGroupId = groupId; this.selectedProcessId = process.id; this.selectedNodeIds = []; }
  private selectGroup(id: string): void { this.selectedGroupId = id; this.selectedProcessId = this.document?.groups.find((group) => group.id === id)?.processes[0]?.id ?? null; this.selectedNodeIds = []; this.nodeValidationError = null; this.requestUpdate(); }
  private selectProcess(groupId: string, processId: string): void { this.selectedGroupId = groupId; this.selectedProcessId = processId; this.selectedNodeIds = []; this.nodeValidationError = null; this.requestUpdate(); }
  private showProcess(processId: string): void {
    const group = this.document?.groups.find(({ processes }) => processes.some(({ id }) => id === processId));
    if (group === undefined) return;
    const changed = this.selectedProcessId !== processId;
    if (changed) { this.selectedNodeIds = []; this.nodeValidationError = null; }
    this.selectedGroupId = group.id;
    this.selectedProcessId = processId;
    if (changed) {
      this.requestUpdate();
      void this.updateComplete.then(() => this.querySelector<HTMLElement>(".process-row.selected")?.scrollIntoView({ block: "nearest" }));
    }
  }
  private duplicateProcess(groupId: string, processId: string): void { const source = this.document?.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId); if (source === undefined) return; const copy = cloneProcess(source, `${source.name} copia`); this.mutate((draft) => draft.groups.find(({ id }) => id === groupId)?.processes.push(copy)); this.selectedProcessId = copy.id; }
  private copyProcess(groupId: string, processId: string): void { const source = this.document?.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId); if (source !== undefined) { this.copiedProcess = structuredClone(source); this.notice = { tone: "info", message: "Proceso copiado. Selecciona un grupo y pulsa Pegar proceso." }; this.requestUpdate(); } }
  private pasteProcess(groupId: string): void { if (this.copiedProcess === null) return; const copy = cloneProcess(this.copiedProcess, `${this.copiedProcess.name} copia`); this.mutate((draft) => draft.groups.find(({ id }) => id === groupId)?.processes.push(copy)); this.selectedProcessId = copy.id; }
  private moveProcess(sourceGroupId: string, processId: string, targetGroupId: string): void { this.mutate((draft) => { const source = draft.groups.find(({ id }) => id === sourceGroupId); const target = draft.groups.find(({ id }) => id === targetGroupId); const process = source?.processes.find(({ id }) => id === processId); if (source && target && process) { source.processes = source.processes.filter(({ id }) => id !== processId); target.processes.push(process); } }); this.selectedGroupId = targetGroupId; this.selectedProcessId = processId; }
  private async removeProcess(groupId: string, processId: string): Promise<void> {
    const process = this.document?.groups.find(({ id }) => id === groupId)?.processes.find(({ id }) => id === processId);
    if (process === undefined || !(await this.confirmations.confirm({
      question: `¿Eliminar el proceso «${process.name}»?`,
      detail: `Se eliminarán sus ${process.nodes.length} ${process.nodes.length === 1 ? "nodo" : "nodos"} y todas sus conexiones. Esta acción no se puede deshacer desde el editor.`
    }))) return;
    this.mutate((draft) => { const group = draft.groups.find(({ id }) => id === groupId); if (group) group.processes = group.processes.filter(({ id }) => id !== processId); });
    if (this.selectedProcessId === processId) this.selectedProcessId = this.selectedGroup()?.processes[0]?.id ?? null;
  }
  private updateProcess(change: (process: AutomationProcess) => void): void { const id = this.selectedProcessId; this.mutate((document) => { for (const group of document.groups) { const process = group.processes.find((item) => item.id === id); if (process) { change(process); return; } } }); }
  private updateVariables(raw: string): void { try { const parsed: unknown = JSON.parse(raw); if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(); this.updateProcess((process) => { process.variables = parsed as Record<string, JsonValue>; }); this.notice = { tone: "success", message: "Variables iniciales actualizadas." }; } catch { this.notice = { tone: "error", message: "Las variables deben ser un objeto JSON." }; } this.requestUpdate(); }
  private updateViewportPreset(preset: ViewportPresetId): void { this.updateProcess((process) => { if (preset === "custom") process.viewport = { ...process.viewport, preset }; else process.viewport = { preset, ...VIEWPORT_PRESETS[preset] }; }); }
  private updateViewportNumber(field: "width" | "height" | "deviceScaleFactor", raw: string): void { const value = Number(raw); if (!Number.isFinite(value) || value <= 0) { this.notice = { tone: "error", message: "Las medidas del viewport deben ser números mayores que cero." }; this.requestUpdate(); return; } this.updateProcess((process) => { process.viewport = { ...process.viewport, preset: "custom", [field]: value }; }); }
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
