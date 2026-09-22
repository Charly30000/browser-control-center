import { LitElement, html } from "lit";

export class EmptyState extends LitElement {
  public static override properties = { message: { type: String } };
  public message = "No hay elementos.";

  protected override render() {
    return html`<p part="message">${this.message}</p>`;
  }
}

customElements.define("empty-state", EmptyState);
