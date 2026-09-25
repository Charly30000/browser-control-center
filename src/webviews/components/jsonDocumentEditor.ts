import { LitElement, html, nothing } from "lit";
import "./jsonDocumentEditor.css";

export interface JsonEditorApplyDetail { readonly serialized: string; }

export class JsonDocumentEditor extends LitElement {
  public static override properties = {
    value: { type: String },
    heading: { type: String },
    errorMessage: { type: String }
  };

  public value = "";
  public heading = "Ver JSON";
  public errorMessage = "";
  private copyMessage = "";

  public override createRenderRoot(): this { return this; }

  protected override render() {
    return html`
      <div class="json-editor-backdrop" @mousedown=${this.closeFromBackdrop}>
        <section class="json-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="json-editor-heading" @mousedown=${(event: Event) => event.stopPropagation()}>
          <header>
            <div>
              <h2 id="json-editor-heading">${this.heading}</h2>
              <p>Edita el documento versionado o cópialo. Los cambios se validarán antes de volver al editor.</p>
            </div>
            <button type="button" aria-label="Cerrar editor JSON" title="Cerrar" @click=${this.close}>×</button>
          </header>
          <textarea class="json-document-content" spellcheck="false" aria-label="Documento JSON" .value=${this.value} @input=${this.updateValue}></textarea>
          <footer>
            ${this.errorMessage !== ""
              ? html`<span class="json-editor-error" role="alert">${this.errorMessage}</span>`
              : this.copyMessage === "" ? nothing : html`<span role="status">${this.copyMessage}</span>`}
            <button type="button" @click=${this.selectAll}>Seleccionar todo</button>
            <button type="button" @click=${this.copy}>Copiar</button>
            <button type="button" @click=${this.close}>Cerrar</button>
            <button type="button" class="primary" @click=${this.apply}>Aplicar cambios</button>
          </footer>
        </section>
      </div>
    `;
  }

  private readonly updateValue = (event: Event): void => {
    if (event.currentTarget instanceof HTMLTextAreaElement) this.value = event.currentTarget.value;
    this.copyMessage = "";
    this.dispatchEvent(new CustomEvent<JsonEditorApplyDetail>("json-editor-change", {
      detail: { serialized: this.value },
      bubbles: true,
      composed: true
    }));
  };

  private readonly selectAll = (): void => {
    const textarea = this.querySelector<HTMLTextAreaElement>(".json-document-content");
    textarea?.focus();
    textarea?.select();
  };

  private readonly copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(this.value);
      this.copyMessage = "JSON copiado.";
    } catch {
      this.selectAll();
      this.copyMessage = document.execCommand("copy") ? "JSON copiado." : "No se pudo copiar automáticamente; usa Ctrl+C.";
    }
    this.requestUpdate();
  };

  private readonly apply = (): void => {
    this.dispatchEvent(new CustomEvent<JsonEditorApplyDetail>("json-editor-apply", {
      detail: { serialized: this.value },
      bubbles: true,
      composed: true
    }));
  };

  private readonly close = (): void => {
    this.dispatchEvent(new CustomEvent("json-editor-close", { bubbles: true, composed: true }));
  };

  private readonly closeFromBackdrop = (event: Event): void => {
    if (event.target === event.currentTarget) this.close();
  };
}

customElements.define("json-document-editor", JsonDocumentEditor);
