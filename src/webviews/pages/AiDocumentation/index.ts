import { LitElement, html } from "lit";
import { live } from "lit/directives/live.js";
import { AI_DOCUMENTATION_AREAS, getAiDocumentation, getAllAiDocumentation, type AiDocumentationArea } from "../../documentation/aiDocumentation";
import "../../components/resourceEditor.css";
import "./aiDocumentation.css";

type DocumentationScope = "all" | AiDocumentationArea;

class AiDocumentationApp extends LitElement {
  private scope: DocumentationScope = "all";
  private content = getAllAiDocumentation();
  private copyMessage = "";

  public override createRenderRoot(): this { return this; }

  protected override render() {
    return html`<main class="ai-doc-page">
      <header class="page-header"><div><h1>Documentación para IA</h1>
        <p>Copia esta guía en tu chat para pedir ayuda con la aplicación o generar JSON que puedas pegar en ella.</p>
      </div></header>
      <section class="ai-doc-controls" aria-label="Opciones de documentación">
        <label>Documentación
          <select aria-label="Sección de documentación" .value=${live(this.scope)} @change=${this.changeScope}>
            <option value="all">Toda la aplicación</option>
            ${Object.entries(AI_DOCUMENTATION_AREAS).map(([area, title]) => html`<option value=${area}>${title}</option>`)}
          </select>
        </label>
        <button type="button" @click=${this.selectAll}>Seleccionar todo</button>
        <button type="button" class="primary" @click=${this.copy}>Copiar documentación</button>
      </section>
      <p class="ai-doc-hint">Incluye instrucciones de uso, opciones, formatos y ejemplos JSON. Para adaptar un elemento existente, añade también su documento de Ver JSON a tu chat.</p>
      <p class="ai-doc-status" role="status" aria-live="polite">${this.copyMessage}</p>
      <textarea class="ai-doc-content" aria-label="Documentación para IA copiable" readonly spellcheck="false" .value=${this.content}></textarea>
    </main>`;
  }

  private readonly changeScope = (event: Event): void => {
    if (!(event.currentTarget instanceof HTMLSelectElement)) return;
    const scope = event.currentTarget.value;
    if (scope !== "all" && !Object.hasOwn(AI_DOCUMENTATION_AREAS, scope)) return;
    this.scope = scope as DocumentationScope;
    this.content = this.scope === "all" ? getAllAiDocumentation() : getAiDocumentation(this.scope);
    this.copyMessage = "";
    this.requestUpdate();
  };

  private readonly selectAll = (): void => {
    const textarea = this.querySelector<HTMLTextAreaElement>(".ai-doc-content");
    textarea?.focus();
    textarea?.select();
  };

  private readonly copy = async (): Promise<void> => {
    const content = this.content;
    try {
      await navigator.clipboard.writeText(content);
      this.copyMessage = "Documentación copiada. Ya puedes pegarla en tu chat.";
    } catch {
      this.selectAll();
      this.copyMessage = document.execCommand("copy") ? "Documentación copiada." : "Texto seleccionado; usa Ctrl+C o Cmd+C para copiarlo.";
    }
    this.requestUpdate();
  };
}

customElements.define("browser-control-ai-documentation", AiDocumentationApp);
document.body.append(document.createElement("browser-control-ai-documentation"));
