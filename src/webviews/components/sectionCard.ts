import { LitElement, html } from "lit";

export class SectionCard extends LitElement {
  public static override properties = {
    heading: { type: String },
    description: { type: String }
  };

  public heading = "";
  public description = "";

  protected override render() {
    return html`
      <section part="container">
        <header part="header">
          <div part="heading-group">
            <h2 part="heading">${this.heading}</h2>
            ${this.description ? html`<p part="description">${this.description}</p>` : null}
          </div>
          <div part="actions"><slot name="actions"></slot></div>
        </header>
        <div part="content"><slot></slot></div>
      </section>
    `;
  }
}

customElements.define("section-card", SectionCard);
