import { LitElement, html } from "lit";
import { pageCatalog } from "../pages/pageCatalog";
import type { ExtensionToSidebarMessage, SidebarToExtensionMessage } from "../../shared/messages/sidebarMessages";
import { vscodeApi } from "../vscodeApi";
import "./sidebar.css";

class SidebarApp extends LitElement {
  public override createRenderRoot(): this { return this; }

  public override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("message", this.onMessage);
    this.post({ type: "sidebar.ready" });
  }

  public override disconnectedCallback(): void {
    window.removeEventListener("message", this.onMessage);
    super.disconnectedCallback();
  }

  protected override render() {
    return html`
      <main class="sidebar-shell">
        <nav class="page-navigation" aria-label="Áreas de Browser Control">
          ${pageCatalog.map((page) => html`
            <button
              class=${page.available ? "page-button active" : "page-button"}
              aria-disabled=${page.available ? "false" : "true"}
              title=${page.available ? `Abrir ${page.title}` : `${page.title}: próximamente`}
              @click=${() => this.openPage(page.id)}
            >
              <span>${page.title}</span>
              ${page.available ? null : html`<small>Próximamente</small>`}
            </button>
          `)}
        </nav>
        <section class="browser-status" aria-label="Estado del navegador">
          <h2>Navegador</h2>
          <p><span class="status-dot" aria-hidden="true"></span>No configurado</p>
        </section>
      </main>
    `;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToSidebarMessage>): void => {
    if (event.data.type === "sidebar.state") this.requestUpdate();
  };

  private openPage(pageId: (typeof pageCatalog)[number]["id"]): void {
    this.post({ type: "sidebar.openPage", pageId });
  }

  private post(message: SidebarToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("browser-control-sidebar", SidebarApp);
document.body.append(document.createElement("browser-control-sidebar"));
