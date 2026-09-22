import { LitElement, html } from "lit";

export type NoticeTone = "info" | "success" | "warning" | "error";

export class StatusNotice extends LitElement {
  public static override properties = {
    tone: { type: String, reflect: true },
    message: { type: String }
  };

  public tone: NoticeTone = "info";
  public message = "";

  protected override render() {
    return this.message ? html`<div part="notice" role="status" aria-live="polite">${this.message}</div>` : null;
  }
}

customElements.define("status-notice", StatusNotice);
