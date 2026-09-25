import { LitElement, html } from "lit";
import type { BrowserLifecycleState } from "../../domain/browser/browserBridge";
import type { BrowserProviderId, BrowserProviderState } from "../../domain/browser/browserProvider";
import type { ExtensionToSidebarMessage, SidebarToExtensionMessage } from "../../shared/messages/sidebarMessages";
import { pageCatalog } from "../pages/pageCatalog";
import { vscodeApi } from "../vscodeApi";
import "./sidebar.css";

const providerLabels: Record<BrowserProviderState, string> = { missing: "No disponible", installing: "Instalando", ready: "Preparado", corrupted: "Dañado", incompatible: "Incompatible" };
const lifecycleLabels: Record<BrowserLifecycleState, string> = { stopped: "Detenido", starting: "Iniciando", running: "En ejecución", stopping: "Deteniendo", crashed: "Cerrado inesperadamente" };

class SidebarApp extends LitElement {
  private providerId: BrowserProviderId = "managed-chromium";
  private providerName = "Chromium administrado";
  private providerState: BrowserProviderState = "missing";
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
      <section class="browser-status" aria-label="Estado del navegador" data-provider=${this.providerId}>
        <h2>Navegador</h2>
        <p class=${this.providerState}><span class="status-dot" aria-hidden="true"></span>${this.providerName} · ${providerLabels[this.providerState]}</p>
        <p class="runtime-state">${lifecycleLabels[this.lifecycle]}</p>
        <button class="manage-button" @click=${() => this.post({ type: "sidebar.manageBrowser" })}>Gestionar navegador</button>
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
