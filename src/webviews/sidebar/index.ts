import { t } from "../../localization";
import { LitElement, html } from "lit";
import type { BrowserLifecycleState } from "../../domain/browser/browserBridge";
import type { BrowserProviderId, BrowserProviderState } from "../../domain/browser/browserProvider";
import type { ExtensionToSidebarMessage, SidebarToExtensionMessage } from "../../shared/messages/sidebarMessages";
import { pageCatalog } from "../pages/pageCatalog";
import { vscodeApi } from "../vscodeApi";
import "./sidebar.css";

const providerLabels: Record<BrowserProviderState, string> = { missing: t("text.unavailable"), installing: t("text.installing"), ready: t("text.ready"), corrupted: t("text.corrupted"), incompatible: t("text.incompatible") };
const lifecycleLabels: Record<BrowserLifecycleState, string> = { stopped: t("text.stopped"), starting: t("text.starting"), running: t("text.running"), stopping: t("text.stopping"), crashed: t("text.closedUnexpectedly") };

class SidebarApp extends LitElement {
  private providerId: BrowserProviderId = "managed-chromium";
  private providerName = t("text.managedChromium");
  private providerState: BrowserProviderState = "missing";
  private lifecycle: BrowserLifecycleState = "stopped";

  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "sidebar.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }

  protected override render() {
    return html`<main class="sidebar-shell">
      <nav class="page-navigation" aria-label=${t("text.browserControlAreas")}>${pageCatalog.map((page) => html`
        <button class=${page.available ? "page-button active" : "page-button"} aria-disabled=${page.available ? "false" : "true"} title=${page.available ? t("text.openArg0", { arg0: page.title }) : t("text.arg0ComingSoon", { arg0: page.title })} @click=${() => this.openPage(page.id)}>
          <span>${page.title}</span>${page.available ? null : html`<small>${t("text.comingSoon")}</small>`}
        </button>`)}</nav>
      <section class="browser-status" aria-label=${t("text.browserStatus")} data-provider=${this.providerId}>
        <h2>${t("text.browser")}</h2>
        <p class=${this.providerState}><span class="status-dot" aria-hidden="true"></span>${this.providerName} · ${providerLabels[this.providerState]}</p>
        <p class="runtime-state">${lifecycleLabels[this.lifecycle]}</p>
        <button class="manage-button" @click=${() => this.post({ type: "sidebar.manageBrowser" })}>${t("navigation.manageBrowser")}</button>
      </section>
    </main>`;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToSidebarMessage>): void => {
    if (event.data.type !== "sidebar.state") return;
    this.providerId = event.data.providerId;
    this.providerName = event.data.providerName;
    this.providerState = event.data.providerState;
    this.lifecycle = event.data.lifecycle;
    this.requestUpdate();
  };

  private openPage(pageId: (typeof pageCatalog)[number]["id"]): void { this.post({ type: "sidebar.openPage", pageId }); }
  private post(message: SidebarToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("browser-control-sidebar", SidebarApp);
document.body.append(document.createElement("browser-control-sidebar"));
