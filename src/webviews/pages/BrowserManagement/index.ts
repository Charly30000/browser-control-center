import { LitElement, html } from "lit";
import type { BrowserLifecycleState } from "../../../domain/browser/browserBridge";
import type { BrowserProviderId, BrowserProviderSnapshot, BrowserProviderState } from "../../../domain/browser/browserProvider";
import type { BrowserInstallationSnapshot } from "../../../infrastructure/browser/providers/browserBinaryManager";
import type { BrowserManagementToExtensionMessage, ExtensionToBrowserManagementMessage } from "../../../shared/messages/browserManagementMessages";
import type { NoticeTone } from "../../components/statusNotice";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./browserManagement.css";

const labels: Record<BrowserProviderState, string> = {
  missing: "No disponible",
  installing: "Instalando",
  ready: "Preparado",
  corrupted: "Dañado",
  incompatible: "Incompatible"
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
      <header><h1>Gestionar navegador</h1><p>Selecciona el navegador que utilizarán Manual, Fórmulas y Automatizaciones.</p></header>
      <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>

      <section class="browser-selector">
        <label><span>Navegador activo</span><select ?disabled=${this.busy} .value=${this.selectedProviderId} @change=${this.changeProvider}>
          ${this.providers.map((provider) => html`<option value=${provider.id}>${provider.displayName}</option>`)}
        </select></label>
        <button ?disabled=${this.busy || selected === undefined} @click=${() => this.post({ type: "browserManagement.verify" })}>Verificar seleccionado</button>
      </section>

      ${selected === undefined ? html`<p>Cargando estado…</p>` : html`
        <section class="status-card selected-browser">
          <div><span>Navegador</span><strong>${selected.displayName}</strong></div>
          <div><span>Disponibilidad</span><strong class=${selected.state}>${labels[selected.state]}</strong></div>
          <div><span>Sesión</span><strong>${this.lifecycle}</strong></div>
          <div><span>Versión</span><code>${selected.browserVersion ?? "—"}</code></div>
          <div class="wide"><span>Ejecutable</span><code>${selected.executablePath ?? (selected.id === "system-chrome" ? "Canal estable de Chrome detectado por Playwright" : "Todavía no disponible")}</code></div>
          <p class="wide detail">${selected.detail}</p>
        </section>
        <p class="isolation-note"><strong>Sesión aislada:</strong> siempre se crea un contexto nuevo, no persistente y equivalente a incógnito. No se abre ni modifica el perfil personal, las cookies, el historial o el almacenamiento habitual de Chrome.</p>
      `}

      ${installation === null ? null : html`
        <section class="managed-section">
          <h2>Chromium administrado</h2>
          <p>Instalación opcional gestionada por la extensión y almacenada fuera del VSIX.</p>
          <div class="status-card compact">
            <div><span>Instalación</span><strong class=${installation.state}>${labels[installation.state]}</strong></div>
            <div><span>Playwright</span><code>${installation.playwrightVersion}</code></div>
            <div><span>Revisión requerida</span><code>${installation.requiredRevision}</code></div>
            <div><span>Chromium</span><code>${installation.browserVersion ?? "—"}</code></div>
            <div class="wide"><span>Ubicación</span><code>${installation.executablePath ?? "Todavía no disponible"}</code></div>
            ${this.progress ? html`<p class="wide progress">${this.progress}</p>` : null}
          </div>
          <div class="actions">
            <button class="primary" ?disabled=${this.busy || installation.state === "ready"} @click=${() => this.post({ type: "browserManagement.install" })}>Instalar</button>
            <button ?disabled=${this.busy} @click=${() => this.post({ type: "browserManagement.reinstall" })}>Reinstalar</button>
            <button class="danger" ?disabled=${this.busy || installation.state === "missing"} @click=${() => this.post({ type: "browserManagement.remove" })}>Eliminar</button>
          </div>
          <p class="help">Estas acciones solo afectan a Chromium administrado. Nunca instalan, desinstalan ni modifican Google Chrome.</p>
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
