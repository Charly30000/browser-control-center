import { LitElement, html, nothing, type PropertyValues } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { t } from "../../localization";
import type { ConfirmDestructiveAction } from "./confirmDestructiveAction";
import "./sessionDataEditors.css";

interface NameRow { readonly id: string; value: string; }

/** Presents a newline-delimited configuration value as individual editable rows. */
export class NameListEditor extends LitElement {
  public static override properties = {
    value: { type: String }, identity: { type: String }, label: { type: String },
    onValueChange: { attribute: false }, confirmDeletion: { attribute: false }
  };

  public declare value: string;
  public declare identity: string;
  public declare label: string;
  public declare onValueChange: ((value: string) => void) | undefined;
  public declare confirmDeletion: ConfirmDestructiveAction | undefined;
  private rows: NameRow[] = [];
  private synchronizedValue: string | null = null;
  private synchronizedIdentity: string | null = null;

  public constructor() {
    super();
    this.value = "";
    this.identity = "";
    this.label = "";
    this.onValueChange = undefined;
    this.confirmDeletion = undefined;
  }

  public override createRenderRoot(): this { return this; }

  protected override willUpdate(_changed: PropertyValues): void {
    if (this.identity !== this.synchronizedIdentity || this.value !== this.synchronizedValue) {
      this.rows = this.value === "" ? [] : this.value.split(/\r?\n/).map((value) => ({ id: crypto.randomUUID(), value }));
      this.synchronizedIdentity = this.identity;
      this.synchronizedValue = this.value;
    }
  }

  protected override render() {
    return html`<div class="session-editor" role="group" aria-label=${this.label}>
      <div class="session-list">
        ${repeat(this.rows, (row) => row.id, (row) => html`<div class="session-row name-list-row">
          <input aria-label=${t("sessionRemoval.item")} placeholder=${t("sessionRemoval.item")} .value=${live(row.value)}
            @input=${(event: Event) => { if (event.currentTarget instanceof HTMLInputElement) { row.value = event.currentTarget.value; this.commit(); } }}>
          <button type="button" class="danger" @click=${async () => {
            if (await this.confirmDeletion?.({ question: t("sessionRemoval.deleteEntry", { name: row.value || t("sessionRemoval.unnamedEntry") }) })) {
              this.rows = this.rows.filter(({ id }) => id !== row.id);
              this.commit();
            }
          }}>${t("actions.delete")}</button>
        </div>`)}
        ${this.rows.length === 0 ? html`<p class="session-empty">${t("text.noItems")}</p>` : nothing}
      </div>
      <div class="session-toolbar"><button type="button" @click=${() => {
        this.rows = [...this.rows, { id: crypto.randomUUID(), value: "" }];
        this.commit();
        void this.updateComplete.then(() => this.querySelector<HTMLInputElement>(".name-list-row:last-child input")?.focus());
      }}>${t("text.add")}</button></div>
    </div>`;
  }

  private commit(): void {
    this.value = this.rows.map(({ value }) => value).join("\n");
    this.synchronizedValue = this.value;
    this.onValueChange?.(this.value);
    this.requestUpdate();
  }
}

customElements.define("name-list-editor", NameListEditor);
