import { LitElement, html, nothing } from "lit";
import type { BrowserActionTarget } from "../../../application/manual/browserActionsService";
import type { ArrayResource } from "../../../domain/arrays/arrayResource";
import type { BrowserSessionSnapshot } from "../../../domain/browser/browserBridge";
import {
  createCookie,
  createGeneratorBinding,
  createHeader,
  createQueryParam,
  createRequestOverride,
  createStorageEntry,
  type GeneratorBinding,
  type GeneratorType,
  type HeaderEntry,
  type ManualProfile,
  type ProfileSummary,
  type RequestOverrideEntry,
  type StorageEntry,
  type StorageValueType,
  type ViewportPresetId,
  VIEWPORT_PRESETS
} from "../../../domain/manual/manualProfile";
import { isProfileDirty } from "../../../domain/manual/dirtyState";
import { buildUrlWithQueryParams } from "../../../domain/manual/queryParams";
import { parseStorageValue } from "../../../domain/manual/storageValue";
import type { GlobalResourceSummary } from "../../../domain/resources/globalResource";
import type { ExtensionToManualMessage, ManualToExtensionMessage } from "../../../shared/messages/manualMessages";
import type { NoticeTone } from "../../components/statusNotice";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./components/validationMessage";
import "./manual.css";

const generatorLabels: Readonly<Record<GeneratorType, string>> = {
  firstName: "Nombre",
  lastName: "Apellido",
  email: "Email",
  phone: "Teléfono",
  number: "Número",
  dni: "DNI",
  nie: "NIE",
  cif: "CIF",
  formula: "Fórmula",
  array: "Array"
};

const inputValue = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    ? target.value
    : "";
};

const inputChecked = (event: Event): boolean =>
  event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;

class ManualApp extends LitElement {
  private profile: ManualProfile | null = null;
  private savedProfile: ManualProfile | null = null;
  private profiles: readonly ProfileSummary[] = [];
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };
  private previews: Readonly<Record<string, string>> = {};
  private formulas: readonly GlobalResourceSummary[] = [];
  private arrays: readonly ArrayResource[] = [];
  private browser: BrowserSessionSnapshot = { lifecycle: "stopped", pages: [], activePageId: null };

  public override createRenderRoot(): this { return this; }

  public override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("message", this.onMessage);
    this.post({ type: "manual.ready" });
  }

  public override disconnectedCallback(): void {
    window.removeEventListener("message", this.onMessage);
    super.disconnectedCallback();
  }

  protected override render() {
    if (this.profile === null) {
      return html`<main class="manual-shell loading">Cargando perfil…</main>`;
    }
    const dirty = isProfileDirty(this.profile, this.savedProfile);
    const composedUrl = buildUrlWithQueryParams(this.profile.url, this.profile.queryParams);

    return html`
      <main class="manual-shell">
        <header class="page-header">
          <div>
            <h1>Manual Browser</h1>
            <p>Prepara y modifica una sesión aislada de Chromium controlada por Playwright.</p>
          </div>
          <span class=${`browser-badge ${this.browser.lifecycle}`}><span aria-hidden="true"></span>${this.browser.lifecycle}</span>
        </header>

        <section class="browser-toolbar" aria-label="Control de Chromium">
          <div class="toolbar-actions">
            <button class="primary" ?disabled=${this.browser.lifecycle === "running" || this.browser.lifecycle === "starting"} @click=${this.startBrowser}>Iniciar</button>
            <button ?disabled=${this.browser.lifecycle !== "running"} @click=${() => this.post({ type: "browser.stop", force: false })}>Detener</button>
            <button class="danger" ?disabled=${this.browser.lifecycle === "stopped"} @click=${() => this.post({ type: "browser.stop", force: true })}>Forzar cierre</button>
            <button ?disabled=${this.browser.lifecycle === "starting" || this.browser.lifecycle === "stopping"} @click=${this.restartBrowser}>Reinicio limpio</button>
          </div>
          <div class="tabs" role="tablist">
            ${this.browser.pages.map((page) => html`<div class=${page.active ? "browser-tab active" : "browser-tab"}>
              <button role="tab" title=${page.url} @click=${() => this.post({ type: "browser.selectPage", pageId: page.id })}>${page.title || page.url || "Nueva pestaña"}</button>
              <button class="tab-close" title="Cerrar pestaña" @click=${() => this.post({ type: "browser.closePage", pageId: page.id })}>×</button>
            </div>`)}
            ${this.browser.pages.length === 0 ? html`<span class="no-tabs">Sin pestañas abiertas</span>` : nothing}
          </div>
        </section>

        <section class="profile-toolbar" aria-label="Gestión del perfil">
          <label>Perfil
            <select @change=${this.selectProfile} .value=${this.profile.id}>
              ${!this.profiles.some(({ id }) => id === this.profile?.id)
                ? html`<option value=${this.profile.id}>${this.profile.name} (sin guardar)</option>`
                : nothing}
              ${this.profiles.map((profile) => html`<option value=${profile.id}>${profile.name}</option>`)}
            </select>
          </label>
          <label class="profile-name">Nombre
            <input .value=${this.profile.name} @input=${(event: Event) => this.mutate((profile) => { profile.name = inputValue(event); })}>
          </label>
          <div class="toolbar-actions">
            <button @click=${this.newProfile}>Nuevo</button>
            <button class="primary" @click=${this.saveProfile}>Guardar</button>
            <button class="danger" @click=${this.deleteProfile}>Eliminar</button>
            <button @click=${this.exportProfile}>Exportar</button>
            <button @click=${this.importProfile}>Importar</button>
          </div>
          <span class=${dirty ? "save-state dirty" : "save-state saved"}>${dirty ? "Cambios sin guardar" : "Guardado"}</span>
        </section>

        <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>

        <div class="sections-grid">
          <section-card heading="URL" description="La URL final se compone con los query params activos.">
            <div class="url-row">
              <label class="grow"><span>URL base</span><input type="url" .value=${this.profile.url} @input=${(event: Event) => this.mutate((profile) => { profile.url = inputValue(event); })}></label>
              <button class="primary" @click=${this.openBrowser}>Abrir</button>
            </div>
            <p class=${composedUrl.ok ? "url-preview" : "field-error"}>${composedUrl.ok ? composedUrl.value : composedUrl.error}</p>
            <h3>Query params</h3>
            <div class="rows">
              ${this.profile.queryParams.map((entry) => html`
                <div class="data-row query-row">
                  <label><span class="sr-only">Clave</span><input placeholder="Key" .value=${entry.key} @input=${(event: Event) => this.mutate((profile) => { const item = profile.queryParams.find(({ id }) => id === entry.id); if (item) item.key = inputValue(event); })}></label>
                  <label><span class="sr-only">Valor</span><input placeholder="Value" .value=${entry.value} @input=${(event: Event) => this.mutate((profile) => { const item = profile.queryParams.find(({ id }) => id === entry.id); if (item) item.value = inputValue(event); })}></label>
                  ${this.enabledToggle(entry.enabled, (enabled) => this.mutate((profile) => { const item = profile.queryParams.find(({ id }) => id === entry.id); if (item) item.enabled = enabled; }))}
                  <button class="icon-button danger" title="Eliminar query param" @click=${() => this.mutate((profile) => { profile.queryParams = profile.queryParams.filter(({ id }) => id !== entry.id); })}>Eliminar</button>
                </div>
              `)}
              ${this.profile.queryParams.length === 0 ? html`<empty-state message="No hay query params."></empty-state>` : nothing}
            </div>
            <button slot="actions" @click=${() => this.mutate((profile) => { profile.queryParams.push(createQueryParam(crypto.randomUUID())); })}>+ Añadir</button>
          </section-card>

          ${this.renderHeaders()}
          ${this.renderCookies()}
          ${this.renderStorage("localStorage", "Local Storage")}
          ${this.renderStorage("sessionStorage", "Session Storage")}
          ${this.renderOverrides()}
          ${this.renderViewport()}
          ${this.renderGenerators()}
        </div>
      </main>
    `;
  }

  private renderHeaders() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading="Headers" description="Cabeceras que se aplicarán al contexto del navegador.">
        <div class="rows">
          ${profile.headers.map((entry) => html`
            <div class="data-row key-value-row">
              <input aria-label="Clave" placeholder="Key" .value=${entry.key} @input=${(event: Event) => this.mutate((draft) => { const item = draft.headers.find(({ id }) => id === entry.id); if (item) item.key = inputValue(event); })}>
              <input aria-label="Valor" placeholder="Value" .value=${entry.value} @input=${(event: Event) => this.mutate((draft) => { const item = draft.headers.find(({ id }) => id === entry.id); if (item) item.value = inputValue(event); })}>
              ${this.enabledToggle(entry.enabled, (enabled) => this.mutate((draft) => { const item = draft.headers.find(({ id }) => id === entry.id); if (item) item.enabled = enabled; }))}
              <button @click=${() => this.apply("headers", entry.id)}>Aplicar</button>
              <button class="danger" @click=${() => this.mutate((draft) => { draft.headers = draft.headers.filter(({ id }) => id !== entry.id); })}>Eliminar</button>
            </div>
          `)}
          ${profile.headers.length === 0 ? html`<empty-state message="No hay headers."></empty-state>` : nothing}
        </div>
        <div slot="actions" class="slot-actions">
          <button @click=${() => this.mutate((draft) => { draft.headers.push(createHeader(crypto.randomUUID())); })}>+ Añadir</button>
          <button @click=${() => this.apply("headers", null)}>Aplicar todos</button>
        </div>
      </section-card>
    `;
  }

  private renderCookies() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading="Cookies" description="Cada cookie mantiene sus atributos completos en los detalles.">
        <div class="rows">
          ${profile.cookies.map((cookie) => html`
            <details class="row-details">
              <summary>
                <span>${cookie.name || "Cookie sin nombre"}</span>
                <small>${cookie.domain || "Dominio pendiente"}</small>
                <span class=${cookie.enabled ? "enabled-mark" : "disabled-mark"}>${cookie.enabled ? "Activa" : "Inactiva"}</span>
              </summary>
              <div class="details-grid cookie-grid">
                ${this.textField("Nombre", cookie.name, (value) => this.updateCookie(cookie.id, (item) => { item.name = value; }))}
                ${this.textField("Valor", cookie.value, (value) => this.updateCookie(cookie.id, (item) => { item.value = value; }))}
                ${this.textField("Dominio", cookie.domain, (value) => this.updateCookie(cookie.id, (item) => { item.domain = value; }))}
                ${this.textField("Path", cookie.path, (value) => this.updateCookie(cookie.id, (item) => { item.path = value; }))}
                <label><span>Expira</span><input type="datetime-local" .value=${cookie.expires ?? ""} @input=${(event: Event) => this.updateCookie(cookie.id, (item) => { item.expires = inputValue(event) || null; })}></label>
                <label><span>SameSite</span><select .value=${cookie.sameSite} @change=${(event: Event) => this.updateCookie(cookie.id, (item) => { item.sameSite = inputValue(event) as "Strict" | "Lax" | "None"; })}><option>Strict</option><option>Lax</option><option>None</option></select></label>
                ${this.enabledToggle(cookie.secure, (value) => this.updateCookie(cookie.id, (item) => { item.secure = value; }), "Secure")}
                ${this.enabledToggle(cookie.httpOnly, (value) => this.updateCookie(cookie.id, (item) => { item.httpOnly = value; }), "HttpOnly")}
                ${this.enabledToggle(cookie.enabled, (value) => this.updateCookie(cookie.id, (item) => { item.enabled = value; }))}
              </div>
              <div class="row-actions"><button @click=${() => this.apply("cookies", cookie.id)}>Aplicar</button><button class="danger" @click=${() => this.mutate((draft) => { draft.cookies = draft.cookies.filter(({ id }) => id !== cookie.id); })}>Eliminar</button></div>
            </details>
          `)}
          ${profile.cookies.length === 0 ? html`<empty-state message="No hay cookies."></empty-state>` : nothing}
        </div>
        <div slot="actions" class="slot-actions"><button @click=${() => this.mutate((draft) => { draft.cookies.push(createCookie(crypto.randomUUID())); })}>+ Añadir</button><button @click=${() => this.apply("cookies", null)}>Aplicar todas</button></div>
      </section-card>
    `;
  }

  private renderStorage(scope: "localStorage" | "sessionStorage", title: string) {
    const profile = this.profile;
    if (profile === null) return nothing;
    const entries = profile[scope];
    return html`
      <section-card heading=${title} description="Valores tipados y validados antes de enviarse al navegador.">
        <div class="rows">
          ${entries.map((entry) => {
            const validation = parseStorageValue(entry.valueType, entry.value);
            return html`
              <div class="data-row storage-row">
                <input aria-label="Clave" placeholder="Key" .value=${entry.key} @input=${(event: Event) => this.updateStorage(scope, entry.id, (item) => { item.key = inputValue(event); })}>
                <select aria-label="Tipo" .value=${entry.valueType} @change=${(event: Event) => this.updateStorage(scope, entry.id, (item) => { item.valueType = inputValue(event) as StorageValueType; if (item.valueType === "null") item.value = "null"; })}>
                  <option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option><option value="json">JSON</option><option value="null">null</option>
                </select>
                <input aria-label="Valor" placeholder="Value" .value=${entry.value} ?disabled=${entry.valueType === "null"} @input=${(event: Event) => this.updateStorage(scope, entry.id, (item) => { item.value = inputValue(event); })}>
                ${this.enabledToggle(entry.enabled, (enabled) => this.updateStorage(scope, entry.id, (item) => { item.enabled = enabled; }))}
                <button @click=${() => this.apply(scope, entry.id)}>Aplicar</button>
                <button class="danger" @click=${() => this.mutate((draft) => { draft[scope] = draft[scope].filter(({ id }) => id !== entry.id); })}>Eliminar</button>
                ${validation.ok ? nothing : html`<validation-message class="row-validation" .message=${validation.error}></validation-message>`}
              </div>
            `;
          })}
          ${entries.length === 0 ? html`<empty-state message="No hay valores definidos."></empty-state>` : nothing}
        </div>
        <div slot="actions" class="slot-actions"><button @click=${() => this.mutate((draft) => { draft[scope].push(createStorageEntry(crypto.randomUUID())); })}>+ Añadir</button><button @click=${() => this.apply(scope, null)}>Aplicar todos</button></div>
      </section-card>
    `;
  }

  private renderOverrides() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading="Request Overrides" description="Interceptores preparados para fulfill, abort y continue-modified.">
        <div class="rows">
          ${profile.requestOverrides.map((override) => html`
            <details class="row-details">
              <summary><span>${override.matcher || "Matcher sin definir"}</span><small>${override.method} · ${override.action}</small><span class=${override.enabled ? "enabled-mark" : "disabled-mark"}>${override.enabled ? "Activo" : "Inactivo"}</span></summary>
              <div class="details-grid override-grid">
                <label><span>Coincidencia</span><select .value=${override.matcherType} @change=${(event: Event) => this.updateOverride(override.id, (item) => { item.matcherType = inputValue(event) as RequestOverrideEntry["matcherType"]; })}><option value="exact">URL exacta</option><option value="glob">Glob</option><option value="regex">Regex</option></select></label>
                ${this.textField("Matcher", override.matcher, (value) => this.updateOverride(override.id, (item) => { item.matcher = value; }))}
                <label><span>Método</span><select .value=${override.method} @change=${(event: Event) => this.updateOverride(override.id, (item) => { item.method = inputValue(event) as RequestOverrideEntry["method"]; })}>${["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => html`<option>${method}</option>`)}</select></label>
                <label><span>Acción</span><select .value=${override.action} @change=${(event: Event) => this.updateOverride(override.id, (item) => { item.action = inputValue(event) as RequestOverrideEntry["action"]; })}><option value="fulfill">fulfill</option><option value="abort">abort</option><option value="continue-modified">continue-modified</option></select></label>
                <label><span>Status</span><input type="number" min="100" max="599" .value=${String(override.status)} @input=${(event: Event) => this.updateOverride(override.id, (item) => { item.status = Number(inputValue(event)); })}></label>
                ${this.textField("Content-Type", override.contentType, (value) => this.updateOverride(override.id, (item) => { item.contentType = value; }))}
                <label class="wide"><span>Body</span><textarea rows="5" .value=${override.body} @input=${(event: Event) => this.updateOverride(override.id, (item) => { item.body = inputValue(event); })}></textarea></label>
              </div>
              <div class="nested-section"><h4>Headers de respuesta</h4>${this.renderOverrideHeaders(override)}</div>
              <div class="row-actions">${this.enabledToggle(override.enabled, (enabled) => this.updateOverride(override.id, (item) => { item.enabled = enabled; }))}<button @click=${() => this.apply("overrides", override.id)}>Aplicar</button><button class="danger" @click=${() => this.deleteOverride(override.id)}>Eliminar</button></div>
            </details>
          `)}
          ${profile.requestOverrides.length === 0 ? html`<empty-state message="No hay overrides."></empty-state>` : nothing}
        </div>
        <div slot="actions" class="slot-actions"><button @click=${() => this.mutate((draft) => { draft.requestOverrides.push(createRequestOverride(crypto.randomUUID())); })}>+ Añadir</button><button @click=${() => this.apply("overrides", null)}>Aplicar todos</button></div>
      </section-card>
    `;
  }

  private renderOverrideHeaders(override: RequestOverrideEntry) {
    return html`
      <div class="rows compact">
        ${override.headers.map((header) => html`<div class="data-row nested-header-row"><input aria-label="Clave" placeholder="Key" .value=${header.key} @input=${(event: Event) => this.updateOverrideHeader(override.id, header.id, (item) => { item.key = inputValue(event); })}><input aria-label="Valor" placeholder="Value" .value=${header.value} @input=${(event: Event) => this.updateOverrideHeader(override.id, header.id, (item) => { item.value = inputValue(event); })}>${this.enabledToggle(header.enabled, (enabled) => this.updateOverrideHeader(override.id, header.id, (item) => { item.enabled = enabled; }))}<button class="danger" @click=${() => this.updateOverride(override.id, (item) => { item.headers = item.headers.filter(({ id }) => id !== header.id); })}>Eliminar</button></div>`)}
        <button class="inline-add" @click=${() => this.updateOverride(override.id, (item) => { item.headers.push(createHeader(crypto.randomUUID())); })}>+ Añadir header</button>
      </div>
    `;
  }

  private renderViewport() {
    const profile = this.profile;
    if (profile === null) return nothing;
    const viewport = profile.viewport;
    return html`
      <section-card heading="Viewport" description="Los cambios se aplican en el siguiente inicio o reinicio limpio.">
        <div class="details-grid viewport-grid">
          <label><span>Preset</span><select .value=${viewport.preset} @change=${(event: Event) => this.changeViewportPreset(inputValue(event) as ViewportPresetId)}>
            <option value="desktop">Desktop 1920×1080</option><option value="laptop">Laptop 1366×768</option>
            <option value="tabletPortrait">Tablet vertical</option><option value="tabletLandscape">Tablet horizontal</option>
            <option value="mobilePortrait">Móvil vertical</option><option value="mobileLandscape">Móvil horizontal</option><option value="custom">Personalizado</option>
          </select></label>
          ${this.numberField("Ancho", viewport.width, (value) => this.updateViewport("width", value))}
          ${this.numberField("Alto", viewport.height, (value) => this.updateViewport("height", value))}
          ${this.numberField("Escala", viewport.deviceScaleFactor, (value) => this.updateViewport("deviceScaleFactor", value), "0.1")}
          ${this.enabledToggle(viewport.hasTouch, (value) => this.mutate((draft) => { draft.viewport.hasTouch = value; draft.viewport.preset = "custom"; }), "Touch")}
          ${this.enabledToggle(viewport.isMobile, (value) => this.mutate((draft) => { draft.viewport.isMobile = value; draft.viewport.preset = "custom"; }), "Modo móvil")}
        </div>
        <button slot="actions" @click=${this.restartBrowser}>Aplicar con reinicio limpio</button>
      </section-card>`;
  }

  private renderGenerators() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading="Inputs / Generadores" description="Generadores puros reutilizables vinculados a un selector y una propiedad.">
        <div class="rows">
          ${profile.generatorBindings.map((binding) => html`
            <details class="row-details" open>
              <summary><span>${generatorLabels[binding.generatorType]}</span><small>${binding.selector || "Selector pendiente"}</small><span class=${binding.enabled ? "enabled-mark" : "disabled-mark"}>${binding.enabled ? "Activo" : "Inactivo"}</span></summary>
              <div class="details-grid generator-grid">
                <label><span>Tipo</span><select .value=${binding.generatorType} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.generatorType = inputValue(event) as GeneratorType; item.resourceId = null; })}>${Object.entries(generatorLabels).map(([value, label]) => html`<option value=${value}>${label}</option>`)}</select></label>
                ${this.textField("Selector CSS", binding.selector, (value) => this.updateBinding(binding.id, (item) => { item.selector = value; }))}
                <label><span>Propiedad</span><select .value=${binding.propertyKind} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.propertyKind = inputValue(event) as GeneratorBinding["propertyKind"]; })}><option value="value">value</option><option value="textContent">textContent</option><option value="innerText">innerText</option><option value="checked">checked</option><option value="attribute">attribute</option><option value="property">custom property</option></select></label>
                ${this.renderResourceSelector(binding)}
                ${binding.propertyKind === "attribute" || binding.propertyKind === "property" ? this.textField("Nombre de propiedad", binding.propertyName, (value) => this.updateBinding(binding.id, (item) => { item.propertyName = value; })) : nothing}
                ${binding.generatorType === "number" ? html`${this.textField("Mínimo", binding.min, (value) => this.updateBinding(binding.id, (item) => { item.min = value; }), "number")}${this.textField("Máximo", binding.max, (value) => this.updateBinding(binding.id, (item) => { item.max = value; }), "number")}` : nothing}
                <label><span>Escritura</span><select .value=${binding.inputMode} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.inputMode = inputValue(event) as GeneratorBinding["inputMode"]; })}><option value="instant">Instantánea</option><option value="sequential">Secuencial</option></select></label>
                ${binding.inputMode === "sequential" ? this.numberField("Retraso por tecla (ms)", binding.delayMs, (value) => this.updateBinding(binding.id, (item) => { item.delayMs = Math.max(0, value); })) : nothing}
              </div>
              ${this.previews[binding.id] ? html`<output class="generator-preview">Muestra: ${this.previews[binding.id]}</output>` : nothing}
              <div class="row-actions">${this.enabledToggle(binding.enabled, (enabled) => this.updateBinding(binding.id, (item) => { item.enabled = enabled; }))}<button @click=${() => this.post({ type: "browser.selectElement", bindingId: binding.id })}>Seleccionar elemento</button><button @click=${() => this.preview(binding)}>Generar muestra</button><button @click=${() => this.apply("generators", binding.id)}>Aplicar</button><button class="danger" @click=${() => this.mutate((draft) => { draft.generatorBindings = draft.generatorBindings.filter(({ id }) => id !== binding.id); })}>Eliminar</button></div>
            </details>
          `)}
          ${profile.generatorBindings.length === 0 ? html`<empty-state message="No hay generadores vinculados."></empty-state>` : nothing}
        </div>
        <div slot="actions" class="slot-actions"><button @click=${() => this.mutate((draft) => { draft.generatorBindings.push(createGeneratorBinding(crypto.randomUUID())); })}>+ Añadir</button><button @click=${() => this.apply("generators", null)}>Aplicar todos</button><button @click=${() => this.post({ type: "browser.resetGenerators" })}>Resetear</button></div>
      </section-card>
    `;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToManualMessage>): void => {
    const message = event.data;
    if (message.type === "manual.state") {
      this.profile = structuredClone(message.state.profile);
      this.savedProfile = message.state.savedProfile === null ? null : structuredClone(message.state.savedProfile);
      this.profiles = message.state.profiles;
      this.formulas = message.state.resources.formulas;
      this.arrays = message.state.resources.arrays;
      this.browser = message.state.browser;
      this.previews = {};
    } else if (message.type === "manual.resources") {
      this.formulas = message.resources.formulas;
      this.arrays = message.resources.arrays;
    } else if (message.type === "manual.notice") {
      this.notice = { tone: message.tone, message: message.message };
    } else if (message.type === "browser.elementSelected") {
      this.updateBinding(message.bindingId, (binding) => { binding.selector = message.selector; });
    } else if (message.type === "browser.generatorPreview") {
      this.previews = { ...this.previews, [message.bindingId]: message.value };
    } else if (message.type === "browser.state") {
      this.browser = message.browser;
    }
    this.requestUpdate();
  };

  private mutate(change: (profile: ManualProfile) => void): void {
    if (this.profile === null) return;
    const draft = structuredClone(this.profile);
    change(draft);
    this.profile = draft;
    this.requestUpdate();
  }

  private readonly selectProfile = (event: Event): void => {
    if (this.profile === null) return;
    if (isProfileDirty(this.profile, this.savedProfile) && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?")) {
      if (event.currentTarget instanceof HTMLSelectElement) event.currentTarget.value = this.profile.id;
      return;
    }
    this.post({ type: "manual.select", id: inputValue(event) });
  };

  private readonly newProfile = (): void => {
    if (this.profile !== null && isProfileDirty(this.profile, this.savedProfile) && !window.confirm("Hay cambios sin guardar. ¿Quieres crear otro perfil y descartarlos?")) return;
    this.post({ type: "manual.new" });
  };

  private readonly saveProfile = (): void => { if (this.profile) this.post({ type: "manual.save", profile: this.profile }); };
  private readonly exportProfile = (): void => { if (this.profile) this.post({ type: "manual.export", profile: this.profile }); };
  private readonly importProfile = (): void => {
    if (this.profile !== null && isProfileDirty(this.profile, this.savedProfile) && !window.confirm("Hay cambios sin guardar. ¿Quieres importar otro perfil y descartarlos?")) return;
    this.post({ type: "manual.import" });
  };
  private readonly deleteProfile = (): void => {
    if (this.profile) this.post({ type: "manual.delete", id: this.profile.id, name: this.profile.name });
  };
  private readonly openBrowser = (): void => { if (this.profile) this.post({ type: "browser.open", profile: this.profile }); };
  private readonly startBrowser = (): void => { if (this.profile) this.post({ type: "browser.start", profile: this.profile }); };
  private readonly restartBrowser = (): void => { if (this.profile) this.post({ type: "browser.restart", profile: this.profile }); };

  private apply(target: BrowserActionTarget, rowId: string | null): void {
    if (this.profile) this.post({ type: "browser.apply", target, rowId, profile: this.profile });
  }

  private preview(binding: GeneratorBinding): void {
    if (this.profile) this.post({ type: "browser.previewGenerator", bindingId: binding.id, profile: this.profile });
  }

  private changeViewportPreset(preset: ViewportPresetId): void {
    this.mutate((profile) => {
      if (preset === "custom") { profile.viewport.preset = preset; return; }
      profile.viewport = { preset, ...VIEWPORT_PRESETS[preset] };
    });
  }

  private updateViewport(field: "width" | "height" | "deviceScaleFactor", value: number): void {
    if (!Number.isFinite(value)) return;
    this.mutate((profile) => { profile.viewport[field] = Math.max(field === "deviceScaleFactor" ? 0.1 : 1, value); profile.viewport.preset = "custom"; });
  }

  private updateCookie(id: string, change: (entry: ManualProfile["cookies"][number]) => void): void { this.mutate((profile) => { const item = profile.cookies.find((entry) => entry.id === id); if (item) change(item); }); }
  private updateStorage(scope: "localStorage" | "sessionStorage", id: string, change: (entry: StorageEntry) => void): void { this.mutate((profile) => { const item = profile[scope].find((entry) => entry.id === id); if (item) change(item); }); }
  private updateOverride(id: string, change: (entry: RequestOverrideEntry) => void): void { this.mutate((profile) => { const item = profile.requestOverrides.find((entry) => entry.id === id); if (item) change(item); }); }
  private deleteOverride(id: string): void {
    if (this.profile === null) return;
    const draft = structuredClone(this.profile);
    draft.requestOverrides = draft.requestOverrides.filter((entry) => entry.id !== id);
    this.profile = draft;
    this.post({ type: "browser.syncOverrides", profile: draft });
    this.requestUpdate();
  }
  private updateOverrideHeader(overrideId: string, headerId: string, change: (entry: HeaderEntry) => void): void { this.updateOverride(overrideId, (override) => { const header = override.headers.find((entry) => entry.id === headerId); if (header) change(header); }); }
  private updateBinding(id: string, change: (entry: GeneratorBinding) => void): void { this.mutate((profile) => { const item = profile.generatorBindings.find((entry) => entry.id === id); if (item) change(item); }); }

  private enabledToggle(value: boolean, change: (enabled: boolean) => void, label = "Activo") {
    return html`<label class="check-label"><input type="checkbox" .checked=${value} @change=${(event: Event) => change(inputChecked(event))}><span>${label}</span></label>`;
  }

  private renderResourceSelector(binding: GeneratorBinding) {
    if (binding.generatorType !== "formula" && binding.generatorType !== "array") return nothing;
    const resources = binding.generatorType === "formula" ? this.formulas : this.arrays;
    const missingReference = binding.resourceId !== null && !resources.some(({ id }) => id === binding.resourceId);
    return html`
      <label class="wide"><span>${binding.generatorType === "formula" ? "Fórmula" : "Array"}</span>
        <select .value=${binding.resourceId ?? ""} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.resourceId = inputValue(event) || null; })}>
          <option value="">Selecciona un recurso</option>
          ${resources.map((resource) => html`<option value=${resource.id}>${resource.name}</option>`)}
        </select>
      </label>
      ${resources.length === 0 ? html`<p class="phase-note wide">No hay recursos guardados de este tipo.</p>` : nothing}
      ${missingReference ? html`<p class="phase-note wide">La referencia guardada ya no está disponible.</p>` : nothing}
    `;
  }

  private textField(label: string, value: string, change: (value: string) => void, type = "text") {
    return html`<label><span>${label}</span><input type=${type} .value=${value} @input=${(event: Event) => change(inputValue(event))}></label>`;
  }

  private numberField(label: string, value: number, change: (value: number) => void, step = "1") {
    return html`<label><span>${label}</span><input type="number" min=${step === "1" ? "1" : "0.1"} step=${step} .value=${String(value)} @input=${(event: Event) => change(Number(inputValue(event)))}></label>`;
  }

  private post(message: ManualToExtensionMessage): void { vscodeApi.postMessage(message); }
}

customElements.define("manual-app", ManualApp);
document.body.append(document.createElement("manual-app"));
