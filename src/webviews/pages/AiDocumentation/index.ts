import { t } from "../../../localization";
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
      <header class="page-header"><div><h1>${t("navigation.aiDocumentation")}</h1>
        <p>${t("text.copyThisGuideIntoYourChatToGetHelpUsingTheApplicationOrGenerateJSONYouCan")}</p>
      </div></header>
      <section class="ai-doc-controls" aria-label=${t("text.documentationOptions")}>
        <label>${t("text.documentation")}
          <select aria-label=${t("text.documentationSection")} .value=${live(this.scope)} @change=${this.changeScope}>
            <option value="all">${t("text.entireApplication")}</option>
            ${Object.entries(AI_DOCUMENTATION_AREAS).map(([area, title]) => html`<option value=${area}>${title}</option>`)}
          </select>
        </label>
        <button type="button" @click=${this.selectAll}>${t("text.selectAll")}</button>
        <button type="button" class="primary" @click=${this.copy}>${t("text.copyDocumentation")}</button>
      </section>
      <p class="ai-doc-hint">${t("text.includesUsageInstructionsOptionsFormatsAndJSONExamplesToAdaptAnExistingItemAlsoAddItsView")}</p>
      <p class="ai-doc-status" role="status" aria-live="polite">${this.copyMessage}</p>
      <textarea class="ai-doc-content" aria-label=${t("text.copyableAIDocumentation")} readonly spellcheck="false" .value=${this.content}></textarea>
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
      this.copyMessage = t("text.documentationCopiedYouCanNowPasteItIntoYourChat");
    } catch {
      this.selectAll();
      this.copyMessage = document.execCommand("copy") ? t("text.documentationCopied") : t("text.textSelectedUseCtrlCOrCmdCToCopyIt");
    }
    this.requestUpdate();
  };
}

customElements.define("browser-control-ai-documentation", AiDocumentationApp);
document.body.append(document.createElement("browser-control-ai-documentation"));
