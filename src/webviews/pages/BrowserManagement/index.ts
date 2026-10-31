import { t } from "../../../localization";
import { browserLifecycleLabel } from "../../../localization/displayLabels";
import { LitElement, html } from "lit";
import { live } from "lit/directives/live.js";
import type { BrowserLifecycleState } from "../../../domain/browser/browserBridge";
import type { BrowserProviderId, BrowserProviderSnapshot, BrowserProviderState } from "../../../domain/browser/browserProvider";
import type { BrowserInstallationSnapshot } from "../../../infrastructure/browser/providers/browserBinaryManager";
import type { BrowserManagementToExtensionMessage, ExtensionToBrowserManagementMessage } from "../../../shared/messages/browserManagementMessages";
import type { NoticeTone } from "../../components/statusNotice";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./browserManagement.css";

const labels: Record<BrowserProviderState, string> = {
  missing: t("text.unavailable"),
  installing: t("text.installing"),
  ready: t("text.ready"),
  corrupted: t("text.corrupted"),
  incompatible: t("text.incompatible")
};

class BrowserManagementApp extends LitElement {
  private providers: readonly BrowserProviderSnapshot[] = [];
  private selectedProviderId: BrowserProviderId = "managed-chromium";
  private managedInstallation: BrowserInstallationSnapshot | null = null;
  private lifecycle: BrowserLifecycleState = "stopped";
  private busy = false;
  private progress = "";
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };

  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "browserManagement.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }

  protected override render() {
    const selected = this.providers.find(({ id }) => id === this.selectedProviderId);
    const installation = this.managedInstallation;
    return html`<main class="manager-shell">
      <header><h1>${t("navigation.manageBrowser")}</h1><p>${t("text.selectTheBrowserToUseInManualFormulasAndAutomations")}</p></header>
      <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>

      <section class="browser-selector">
        <label><span>${t("text.activeBrowser")}</span><select ?disabled=${this.busy} @change=${this.changeProvider}>
          ${this.providers.map((provider) => html`<option value=${provider.id} .selected=${live(provider.id === this.selectedProviderId)}>${provider.displayName}</option>`)}
        </select></label>
        <button ?disabled=${this.busy || selected === undefined} @click=${() => this.post({ type: "browserManagement.verify" })}>${t("text.verifySelected")}</button>
      </section>

      ${selected === undefined ? html`<p>${t("text.loadingStatus")}</p>` : html`
        <section class="status-card selected-browser">
          <div><span>${t("text.browser")}</span><strong>${selected.displayName}</strong></div>
          <div><span>${t("text.availability")}</span><strong class=${selected.state}>${labels[selected.state]}</strong></div>
          <div><span>${t("text.session")}</span><strong>${browserLifecycleLabel(this.lifecycle)}</strong></div>
          <div><span>${t("text.version")}</span><code>${selected.browserVersion ?? "—"}</code></div>
          <div class="wide"><span>${t("text.executable")}</span><code>${selected.executablePath ?? (selected.id === "system-chrome" ? t("text.chromeStableChannelDetectedByPlaywright") : t("text.notAvailableYet"))}</code></div>
          <p class="wide detail">${selected.detail}</p>
        </section>
        <p class="isolation-note"><strong>${t("text.isolatedSession")}</strong> ${t("text.aNewNonPersistentContextEquivalentToIncognitoModeIsAlwaysCreatedYourPersonalChromeProfileCookies")}</p>
      `}

      ${installation === null ? null : html`
        <section class="managed-section">
          <h2>${t("text.managedChromium")}</h2>
          <p>${t("text.optionalInstallationManagedByTheExtensionAndStoredOutsideTheVSIX")}</p>
          <div class="status-card compact">
            <div><span>${t("text.installation")}</span><strong class=${installation.state}>${labels[installation.state]}</strong></div>
            <div><span>${t("text.playwright")}</span><code>${installation.playwrightVersion}</code></div>
            <div><span>${t("text.requiredRevision")}</span><code>${installation.requiredRevision}</code></div>
            <div><span>${t("text.chromium")}</span><code>${installation.browserVersion ?? "—"}</code></div>
            <div class="wide"><span>${t("text.location")}</span><code>${installation.executablePath ?? t("text.notAvailableYet")}</code></div>
            ${this.progress ? html`<p class="wide progress">${this.progress}</p>` : null}
          </div>
          <div class="actions">
            <button class="primary" ?disabled=${this.busy || installation.state === "ready"} @click=${() => this.post({ type: "browserManagement.install" })}>${t("text.install")}</button>
            <button ?disabled=${this.busy} @click=${() => this.post({ type: "browserManagement.reinstall" })}>${t("text.reinstall")}</button>
            <button class="danger" ?disabled=${this.busy || installation.state === "missing"} @click=${() => this.post({ type: "browserManagement.remove" })}>${t("actions.delete")}</button>
          </div>
          <p class="help">${t("text.theseActionsOnlyAffectManagedChromiumTheyNeverInstallUninstallOrModifyGoogleChrome")}</p>
        </section>
      `}
    </main>`;
  }

  private readonly changeProvider = (event: Event): void => {
    const value = event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : "";
    if (value === "managed-chromium" || value === "system-chrome") {
      this.post({ type: "browserManagement.selectProvider", providerId: value });
    }
  };

  private readonly onMessage = (event: MessageEvent<ExtensionToBrowserManagementMessage>): void => {
    if (event.data.type === "browserManagement.state") {
      this.providers = event.data.providers;
      this.selectedProviderId = event.data.selectedProviderId;
      this.managedInstallation = event.data.managedInstallation;
      this.lifecycle = event.data.lifecycle;
      this.busy = event.data.busy;
      this.progress = event.data.progress;
    } else this.notice = { tone: event.data.tone, message: event.data.message };
    this.requestUpdate();
  };

  private post(message: BrowserManagementToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("browser-management-app", BrowserManagementApp);
document.body.append(document.createElement("browser-management-app"));
