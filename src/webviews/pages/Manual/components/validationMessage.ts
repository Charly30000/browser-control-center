import { LitElement, html } from "lit";

export class ValidationMessage extends LitElement {
  public static override properties = { message: { type: String } };
  public message = "";

  protected override render() {
    return this.message ? html`<span part="message" role="alert">${this.message}</span>` : null;
  }
}

customElements.define("validation-message", ValidationMessage);
