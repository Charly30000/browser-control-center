import { LitElement, html, nothing } from "lit";
import type { FormulaResource } from "../../../domain/formulas/formula";
import { isResourceDirty } from "../../../domain/resources/resourceDirtyState";
import type { GlobalResourceSummary } from "../../../domain/resources/globalResource";
import type { ExtensionToFormulaMessage, FormulaToExtensionMessage } from "../../../shared/messages/formulaMessages";
import type { NoticeTone } from "../../components/statusNotice";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./formulas.css";

const fieldValue = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : "";
};

class FormulasApp extends LitElement {
  private resource: FormulaResource | null = null;
  private savedResource: FormulaResource | null = null;
  private resources: readonly GlobalResourceSummary[] = [];
  private selectedIds = new Set<string>();
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };

  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "formula.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }

  protected override render() {
    if (this.resource === null) return html`<main class="resource-shell loading">Cargando fórmulas…</main>`;
    const dirty = isResourceDirty(this.resource, this.savedResource);
    return html`
      <main class="resource-shell">
        <header class="page-header">
          <div><h1>Fórmulas</h1><p>Funciones JavaScript reutilizables. La ejecución permanece aislada y deshabilitada en esta fase.</p></div>
          <div class="toolbar">
            <button @click=${() => this.post({ type: "formula.new" })}>Agregar</button>
            <button class="danger" @click=${() => this.post({ type: "formula.deleteSelected", ids: [...this.selectedIds] })}>Eliminar seleccionadas</button>
            <button title="Carga una fórmula de ejemplo sin ejecutarla" @click=${() => this.post({ type: "formula.generateExample" })}>Generar ejemplo</button>
            <button @click=${() => this.post({ type: "formula.import" })}>Importar</button>
          </div>
        </header>
        <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
        <div class="resource-layout">
          <aside class="resource-list">
            <h2>Lista</h2>
            ${this.resources.length === 0 ? html`<p class="empty-list">No hay fórmulas guardadas.</p>` : html`
              <ul>${this.resources.map((item) => html`<li>
                <input type="checkbox" aria-label=${`Seleccionar ${item.name}`} .checked=${this.selectedIds.has(item.id)} @change=${(event: Event) => this.toggleSelection(item.id, event)}>
                <button class=${item.id === this.resource?.id ? "resource-name current" : "resource-name"} @click=${() => this.post({ type: "formula.select", id: item.id })}>${item.name}</button>
              </li>`)}</ul>
            `}
          </aside>
          <section class="resource-editor">
            <h2>Editor</h2>
            <div class="editor-content">
              <label><span>Nombre</span><input .value=${this.resource.name} @input=${(event: Event) => this.change((resource) => { resource.name = fieldValue(event); })}></label>
              <label><span>Código — contrato: function generate() sin parámetros</span><textarea class="code-editor" spellcheck="false" .value=${this.resource.code} @input=${(event: Event) => this.change((resource) => { resource.code = fieldValue(event); })}></textarea></label>
              <p class="execution-note">Generar ejemplo carga una plantilla. Probar no ejecutará código hasta disponer de aislamiento seguro.</p>
              <div class="editor-actions">
                <button @click=${() => this.post({ type: "formula.test", resource: this.resource! })}>Probar</button>
                <button class="primary" @click=${() => this.post({ type: "formula.save", resource: this.resource! })}>Guardar</button>
                <button @click=${() => this.post({ type: "formula.export", resource: this.resource! })}>Exportar</button>
                <span class=${dirty ? "dirty-state dirty" : "dirty-state"}>${dirty ? "Cambios sin guardar" : "Guardado"}</span>
              </div>
              ${this.notice.message ? html`<div class=${this.notice.tone === "error" ? "result-panel error" : this.notice.tone === "success" ? "result-panel success" : "result-panel"}>${this.notice.message}</div>` : nothing}
            </div>
          </section>
        </div>
      </main>
    `;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToFormulaMessage>): void => {
    if (event.data.type === "formula.state") {
      this.resource = structuredClone(event.data.state.resource);
      this.savedResource = event.data.state.savedResource === null ? null : structuredClone(event.data.state.savedResource);
      this.resources = event.data.state.resources;
      this.selectedIds = new Set([...this.selectedIds].filter((id) => this.resources.some((resource) => resource.id === id)));
    } else {
      this.notice = { tone: event.data.tone, message: event.data.message };
    }
    this.requestUpdate();
  };

  private change(change: (resource: FormulaResource) => void): void {
    if (this.resource === null) return;
    const resource = structuredClone(this.resource);
    change(resource);
    this.resource = resource;
    this.requestUpdate();
  }

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
