import { LitElement, html } from "lit";
import { pageCatalog } from "../pages/pageCatalog";
import type { BrowserLifecycleState } from "../../domain/browser/browserBridge";
import type { BrowserInstallationState } from "../../infrastructure/browser/browserBinaryManager";
import type { ExtensionToSidebarMessage, SidebarToExtensionMessage } from "../../shared/messages/sidebarMessages";
import { vscodeApi } from "../vscodeApi";
import "./sidebar.css";

const installationLabels: Record<BrowserInstallationState, string> = { missing: "No instalado", installing: "Instalando", ready: "Preparado", corrupted: "Dañado", incompatible: "Incompatible" };
const lifecycleLabels: Record<BrowserLifecycleState, string> = { stopped: "Detenido", starting: "Iniciando", running: "En ejecución", stopping: "Deteniendo", crashed: "Cerrado inesperadamente" };

class SidebarApp extends LitElement {
  private installation: BrowserInstallationState = "missing";
  private lifecycle: BrowserLifecycleState = "stopped";
  public override createRenderRoot(): this { return this; }
  public override connectedCallback(): void { super.connectedCallback(); window.addEventListener("message", this.onMessage); this.post({ type: "sidebar.ready" }); }
  public override disconnectedCallback(): void { window.removeEventListener("message", this.onMessage); super.disconnectedCallback(); }
  protected override render() {
    return html`<main class="sidebar-shell">
      <nav class="page-navigation" aria-label="Áreas de Browser Control">${pageCatalog.map((page) => html`
        <button class=${page.available ? "page-button active" : "page-button"} aria-disabled=${page.available ? "false" : "true"} title=${page.available ? `Abrir ${page.title}` : `${page.title}: próximamente`} @click=${() => this.openPage(page.id)}>
          <span>${page.title}</span>${page.available ? null : html`<small>Próximamente</small>`}
        </button>`)}</nav>
      <section class="browser-status" aria-label="Estado del navegador">
        <h2>Navegador</h2>
        <p class=${this.installation}><span class="status-dot" aria-hidden="true"></span>${installationLabels[this.installation]}</p>
        <p class="runtime-state">${lifecycleLabels[this.lifecycle]}</p>
        <button class="manage-button" @click=${() => this.post({ type: "sidebar.manageBrowser" })}>Gestionar Chromium</button>
      </section>
    </main>`;
  }
  private readonly onMessage = (event: MessageEvent<ExtensionToSidebarMessage>): void => {
    if (event.data.type === "sidebar.state") { this.installation = event.data.installation; this.lifecycle = event.data.lifecycle; this.requestUpdate(); }
  };
  private openPage(pageId: (typeof pageCatalog)[number]["id"]): void { this.post({ type: "sidebar.openPage", pageId }); }
  private post(message: SidebarToExtensionMessage): void { vscodeApi.postMessage(message); }
}
customElements.define("browser-control-sidebar", SidebarApp);
document.body.append(document.createElement("browser-control-sidebar"));
