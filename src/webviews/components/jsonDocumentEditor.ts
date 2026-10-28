import { LitElement, html, nothing } from "lit";
import {
  assessDocumentSize,
  documentSizeLimitMessage,
  formatBytes,
  MAX_DOCUMENT_BYTES
} from "../../domain/importExport/documentSize";
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
  private sizeMessage = "";
  private previousFocus: HTMLElement | null = null;

  public override createRenderRoot(): this { return this; }

  public override connectedCallback(): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    super.connectedCallback();
  }

  public override disconnectedCallback(): void {
    this.previousFocus?.focus({ preventScroll: true });
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void { this.querySelector<HTMLTextAreaElement>(".json-document-content")?.focus(); }

  protected override render() {
    return html`
      <div class="json-editor-backdrop" @mousedown=${this.closeFromBackdrop} @keydown=${this.onKeyDown}>
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
              : this.sizeMessage !== "" ? html`<span class="json-editor-error" role="status">${this.sizeMessage}</span>`
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
    if (!(event.currentTarget instanceof HTMLTextAreaElement)) return;
    const candidate = event.currentTarget.value;
    const size = assessDocumentSize(candidate);
    if (size.exceedsLimit) {
      event.currentTarget.value = this.value;
      this.sizeMessage = documentSizeLimitMessage(size.bytes);
      this.requestUpdate();
      return;
    }
    this.value = candidate;
    this.sizeMessage = size.shouldWarn
      ? `El documento ocupa ${formatBytes(size.bytes)} de ${formatBytes(MAX_DOCUMENT_BYTES)}.`
      : "";
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

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { this.close(); event.preventDefault(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...this.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
    else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
  };
}

customElements.define("json-document-editor", JsonDocumentEditor);
