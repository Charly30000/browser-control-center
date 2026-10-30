import { LitElement, html, nothing } from "lit";
import { renderSectionIcon, type SectionIcon } from "./sectionIcon";

export class SectionCard extends LitElement {
  public static override properties = {
    heading: { type: String },
    description: { type: String },
    icon: { type: String },
    count: { type: Number }
  };

  public declare heading: string;
  public declare description: string;
  public declare icon: SectionIcon | "";
  public declare count: number;

  public constructor() {
    super();
    this.heading = "";
    this.description = "";
    this.icon = "";
    this.count = -1;
  }

  protected override render() {
    return html`
      <section part="container">
        <header part="header">
          <div part="identity">
            ${this.icon === "" ? nothing : html`<span part="icon">${renderSectionIcon(this.icon)}</span>`}
            <div part="heading-group">
              <div part="title-row"><h2 part="heading">${this.heading}</h2>${this.count < 0 ? nothing : html`<span part="count" aria-label=${`${this.count} ${this.count === 1 ? "elemento" : "elementos"}`}>${this.count}</span>`}</div>
              ${this.description ? html`<p part="description">${this.description}</p>` : nothing}
            </div>
          </div>
          <div part="actions"><slot name="actions"></slot></div>
        </header>
        <div part="content"><slot></slot></div>
      </section>
    `;
  }
}

customElements.define("section-card", SectionCard);
