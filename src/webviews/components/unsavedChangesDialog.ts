import { LitElement, html } from "lit";
import "./unsavedChangesDialog.css";

export type UnsavedChangesChoice = "save" | "discard" | "cancel";

export class UnsavedChangesDialog extends LitElement {
  public static override properties = { message: { type: String } };
  public message = "Hay cambios sin guardar.";
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

  protected override firstUpdated(): void {
    this.querySelector<HTMLButtonElement>(".unsaved-save")?.focus();
  }

  protected override render() {
    return html`<div class="unsaved-backdrop" @keydown=${this.onKeyDown}>
      <section class="unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-message">
        <h2 id="unsaved-title">Cambios sin guardar</h2>
        <p id="unsaved-message">${this.message}</p>
        <footer>
          <button type="button" @click=${() => this.choose("cancel")}>Cancelar</button>
          <button type="button" @click=${() => this.choose("discard")}>Descartar</button>
          <button type="button" class="primary unsaved-save" @click=${() => this.choose("save")}>Guardar</button>
        </footer>
      </section>
    </div>`;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { this.choose("cancel"); event.preventDefault(); return; }
    if (event.key !== "Tab") return;
    const buttons = [...this.querySelectorAll<HTMLButtonElement>("button")];
    const first = buttons[0]; const last = buttons.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
    else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
  };

  private choose(choice: UnsavedChangesChoice): void {
    this.dispatchEvent(new CustomEvent<UnsavedChangesChoice>("unsaved-choice", {
      detail: choice,
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define("unsaved-changes-dialog", UnsavedChangesDialog);
