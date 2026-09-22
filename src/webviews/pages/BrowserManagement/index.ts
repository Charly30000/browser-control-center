import { LitElement, html } from "lit";
import type { BrowserInstallationSnapshot } from "../../../infrastructure/browser/browserBinaryManager";
import type { BrowserLifecycleState } from "../../../domain/browser/browserBridge";
import type { BrowserManagementToExtensionMessage, ExtensionToBrowserManagementMessage } from "../../../shared/messages/browserManagementMessages";
import type { NoticeTone } from "../../components/statusNotice";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./browserManagement.css";

const labels: Record<BrowserInstallationSnapshot["state"], string> = { missing: "No instalado", installing: "Instalando", ready: "Preparado", corrupted: "Dañado", incompatible: "Incompatible" };

class BrowserManagementApp extends LitElement {
  private installation: BrowserInstallationSnapshot | null = null;
  private lifecycle: BrowserLifecycleState = "stopped";
  private busy = false;
  private progress = "";
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };
  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "browserManagement.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }

  protected override render() {
    const installation = this.installation;
    return html`<main class="manager-shell">
      <header><h1>Chromium administrado</h1><p>El navegador se almacena fuera del VSIX y se usa exclusivamente mediante Playwright.</p></header>
      <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>
      ${installation === null ? html`<p>Cargando estado…</p>` : html`
        <section class="status-card">
          <div><span>Instalación</span><strong class=${installation.state}>${labels[installation.state]}</strong></div>
          <div><span>Sesión</span><strong>${this.lifecycle}</strong></div>
          <div><span>Playwright</span><code>${installation.playwrightVersion}</code></div>
          <div><span>Revisión requerida</span><code>${installation.requiredRevision}</code></div>
          <div><span>Chromium</span><code>${installation.browserVersion ?? "—"}</code></div>
          <div class="wide"><span>Ubicación</span><code>${installation.executablePath ?? "Todavía no disponible"}</code></div>
          <p class="wide detail">${installation.detail}</p>
          ${this.progress ? html`<p class="wide progress">${this.progress}</p>` : null}
        </section>
        <div class="actions">
          <button class="primary" ?disabled=${this.busy || installation.state === "ready"} @click=${() => this.post({ type: "browserManagement.install" })}>Instalar</button>
          <button ?disabled=${this.busy || installation.state === "missing"} @click=${() => this.post({ type: "browserManagement.verify" })}>Verificar</button>
          <button ?disabled=${this.busy} @click=${() => this.post({ type: "browserManagement.reinstall" })}>Reinstalar</button>
          <button class="danger" ?disabled=${this.busy || installation.state === "missing"} @click=${() => this.post({ type: "browserManagement.remove" })}>Eliminar</button>
        </div>
        <p class="help">Reinstalar detiene cualquier sesión abierta, elimina solo los binarios administrados y vuelve a verificarlos. Los perfiles y recursos no se ven afectados.</p>
      `}
    </main>`;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToBrowserManagementMessage>): void => {
    if (event.data.type === "browserManagement.state") {
      this.installation = event.data.installation; this.lifecycle = event.data.lifecycle; this.busy = event.data.busy; this.progress = event.data.progress;
    } else this.notice = { tone: event.data.tone, message: event.data.message };
    this.requestUpdate();
  };
  private post(message: BrowserManagementToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("browser-management-app", BrowserManagementApp);
document.body.append(document.createElement("browser-management-app"));
