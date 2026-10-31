import { t } from "../../../localization";
import { browserLifecycleLabel } from "../../../localization/displayLabels";
import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { moveEntry } from "../../../domain/manual/reorderEntries";
import { RowReorderController, renderRowDragHandle, reorderableRow, type RowReorderOptions } from "../../components/rowReorder";
import type { BrowserActionTarget } from "../../../application/manual/browserActionsService";
import type { ArrayResource } from "../../../domain/arrays/arrayResource";
import type { BrowserSessionSnapshot } from "../../../domain/browser/browserBridge";
import type { ManualPortableResources } from "../../../domain/importExport/manualProfileBundle";
import { assessDocumentSize, documentSizeLimitMessage, formatBytes, MAX_DOCUMENT_BYTES } from "../../../domain/importExport/documentSize";
import {
  createCookie,
  createGeneratorBinding,
  createHeader,
  createQueryParam,
  createRequestOverride,
  createStorageEntry,
  DEFAULT_SEQUENTIAL_DELAY_MS,
  type GeneratorBinding,
  type GeneratorType,
  type ManualProfile,
  type ProfileSummary,
  type RequestOverrideEntry,
  type StorageEntry,
  type ViewportPresetId,
  VIEWPORT_PRESETS
} from "../../../domain/manual/manualProfile";
import { isProfileDirty } from "../../../domain/manual/dirtyState";
import { isAutoSaveEnabled } from "../../../domain/resources/editorPreferences";
import { reconcileSavedProfile } from "../../../domain/manual/reconcileSavedProfile";
import { buildUrlWithQueryParams } from "../../../domain/manual/queryParams";
import type { GlobalResourceSummary } from "../../../domain/resources/globalResource";
import type { ExtensionToManualMessage, ManualToExtensionMessage } from "../../../shared/messages/manualMessages";
import type { NoticeTone } from "../../components/statusNotice";
import type { JsonEditorApplyDetail } from "../../components/jsonDocumentEditor";
import type { UnsavedChangesChoice } from "../../components/unsavedChangesDialog";
import "../../components/jsonDocumentEditor";
import { DestructiveConfirmationClient } from "../../components/confirmDestructiveAction";
import { CollapsibleEntryState } from "../../components/collapsibleEntryState";
import { AutoSaveController } from "../../components/autoSaveController";
import { renderAutoSaveControl } from "../../components/autoSaveControl";
import { renderRequestOverrideEditor } from "../../components/requestOverrideEditor";
import { renderCookieEditor, renderHeaderEditor, renderQueryParamEditor, renderStorageEditor } from "../../components/sessionDataEditors";
import { vscodeApi } from "../../vscodeApi";
import "../../components";
import "./components/validationMessage";
import "./manual.css";

const generatorLabels: Readonly<Record<GeneratorType, string>> = {
  string: t("text.fixedText"),
  firstName: t("text.name"),
  lastName: t("text.lastName"),
  email: t("text.email"),
  phone: t("text.phone"),
  number: t("text.number2"),
  dni: t("text.dni"),
  nie: t("text.nie"),
  cif: t("text.cif"),
  formula: t("text.formula"),
  array: t("text.array")
};

const inputValue = (event: Event): string => {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    ? target.value
    : "";
};

const inputChecked = (event: Event): boolean =>
  event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;

type ManualListField = "queryParams" | "headers" | "cookies" | "localStorage" | "sessionStorage" | "requestOverrides" | "generatorBindings";
type ExpandableManualField = "cookies" | "requestOverrides" | "generatorBindings";

class ManualApp extends LitElement {
  private profile: ManualProfile | null = null;
  private savedProfile: ManualProfile | null = null;
  private profiles: readonly ProfileSummary[] = [];
  private notice: { tone: NoticeTone; message: string } = { tone: "info", message: "" };
  private previews: Readonly<Record<string, string>> = {};
  private formulas: readonly GlobalResourceSummary[] = [];
  private arrays: readonly ArrayResource[] = [];
  private browser: BrowserSessionSnapshot = { lifecycle: "stopped", pages: [], activePageId: null };
  private jsonDocument: string | null = null;
  private pendingPortableResources: ManualPortableResources | null = null;
  private pendingTransition: (() => void) | null = null;
  private awaitingSaveTransition = false;
  private unsavedMessage: string | null = null;
  private saveSequence = 0;
  private changingProfile = false;
  private pendingSave: { requestId: string; profile: ManualProfile; resources: ManualPortableResources | null } | null = null;
  private readonly autoSave = new AutoSaveController(this, {
    enabled: () => isAutoSaveEnabled(this.profile?.preferences),
    canSave: () => this.pendingSave === null && this.jsonDocument === null && this.unsavedMessage === null && this.pendingTransition === null && !this.changingProfile,
    dirty: () => this.hasUnsavedChanges(),
    save: () => this.saveProfile()
  });
  private readonly confirmations = new DestructiveConfirmationClient((message) => this.post(message));
  private readonly cookieExpansion = this.createExpansionState("cookies");
  private readonly overrideExpansion = this.createExpansionState("requestOverrides");
  private readonly generatorExpansion = this.createExpansionState("generatorBindings");
  private readonly rowReorder = new RowReorderController();

  public override createRenderRoot(): this { return this; }

  public override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("message", this.onMessage);
    this.post({ type: "manual.ready" });
  }

  public override disconnectedCallback(): void {
    window.removeEventListener("message", this.onMessage);
    this.cancelAutoSave();
    this.confirmations.cancelPending();
    this.rowReorder.cancel();
    super.disconnectedCallback();
  }

  protected override render() {
    if (this.profile === null) {
      return html`<main class="manual-shell loading">${t("text.loadingProfile")}</main>`;
    }
    const dirty = isProfileDirty(this.profile, this.savedProfile) || this.pendingPortableResources !== null;
    const composedUrl = buildUrlWithQueryParams(this.profile.url, this.profile.queryParams);

    return html`
      <main class="manual-shell">
        ${renderAutoSaveControl(isAutoSaveEnabled(this.profile.preferences), this.toggleAutoSave)}
        <header class="page-header">
          <div>
            <h1>${t("text.manualBrowser")}</h1>
            <p>${t("text.prepareAndModifyAnIsolatedSessionOfTheSelectedBrowserControlledByPlaywright")}</p>
          </div>
          <span class=${`browser-badge ${this.browser.lifecycle}`}><span aria-hidden="true"></span>${browserLifecycleLabel(this.browser.lifecycle)}</span>
        </header>

        <section class="browser-toolbar" aria-label=${t("text.browserControls")}>
          <div class="toolbar-actions">
            <button class="primary" ?disabled=${this.browser.lifecycle === "running" || this.browser.lifecycle === "starting"} @click=${this.startBrowser}>${t("text.start")}</button>
            <button ?disabled=${this.browser.lifecycle !== "running"} @click=${() => this.post({ type: "browser.stop", force: false })}>${t("text.stop")}</button>
            <button class="danger" ?disabled=${this.browser.lifecycle === "stopped"} @click=${() => this.post({ type: "browser.stop", force: true })}>${t("text.forceClose")}</button>
            <button ?disabled=${this.browser.lifecycle === "starting" || this.browser.lifecycle === "stopping"} @click=${this.restartBrowser}>${t("text.cleanRestart")}</button>
          </div>
          <div class="tabs" role="tablist">
            ${this.browser.pages.map((page) => html`<div class=${page.active ? "browser-tab active" : "browser-tab"}>
              <button role="tab" title=${page.url} @click=${() => this.post({ type: "browser.selectPage", pageId: page.id })}>${page.title || page.url || t("text.newTab")}</button>
              <button class="tab-close" title=${t("text.closeTab")} @click=${() => this.post({ type: "browser.closePage", pageId: page.id })}>×</button>
            </div>`)}
            ${this.browser.pages.length === 0 ? html`<span class="no-tabs">${t("text.noOpenTabs")}</span>` : nothing}
          </div>
        </section>

        <section class="profile-toolbar" aria-label=${t("text.profileManagement")}>
          <label>${t("text.profile")}
            <select @change=${this.selectProfile} .value=${this.profile.id}>
              ${!this.profiles.some(({ id }) => id === this.profile?.id)
                ? html`<option value=${this.profile.id}>${this.profile.name} ${t("text.unsaved")}</option>`
                : nothing}
              ${this.profiles.map((profile) => html`<option value=${profile.id}>${profile.name}</option>`)}
            </select>
          </label>
          <label class="profile-name">${t("text.name")}
            <input .value=${this.profile.name} @input=${(event: Event) => this.mutate((profile) => { profile.name = inputValue(event); })}>
          </label>
          <div class="toolbar-actions">
            <button @click=${this.newProfile}>${t("text.new")}</button>
            <button class="primary" ?disabled=${this.pendingSave !== null} @click=${this.saveProfile}>${t("actions.save")}</button>
            <button class="danger" ?disabled=${this.pendingSave !== null} @click=${this.deleteProfile}>${t("actions.delete")}</button>
            <button @click=${this.exportProfile}>${t("actions.export")}</button>
            <button @click=${this.viewJson}>${t("actions.viewJson")}</button>
            <button @click=${this.importProfile}>${t("actions.import")}</button>
          </div>
          <span class=${dirty ? "save-state dirty" : "save-state saved"} role="status">${this.pendingSave !== null ? t("saveState.saving") : dirty ? t("saveState.dirty") : t("saveState.saved")}</span>
        </section>

        <status-notice .tone=${this.notice.tone} .message=${this.notice.message}></status-notice>

        <div class="sections-grid">
          <section-card heading=${t("text.url")} icon="url" description=${t("text.theFinalURLIsBuiltUsingTheEnabledQueryParameters")}>
            <div class="url-row">
              <label class="grow"><span>${t("text.baseURL")}</span><input type="url" .value=${this.profile.url} @input=${(event: Event) => this.mutate((profile) => { profile.url = inputValue(event); })}></label>
              <button class="primary" @click=${this.openBrowser}>${t("text.open")}</button>
            </div>
            <p class=${composedUrl.ok ? "url-preview" : "field-error"}>${composedUrl.ok ? composedUrl.value : composedUrl.error}</p>
            <h3>${t("text.queryParams")}</h3>
            ${renderQueryParamEditor(this.profile.queryParams, {
              reorder: this.reorderOptions("queryParams"),
              add: () => this.mutate((profile) => { profile.queryParams.push(createQueryParam(crypto.randomUUID())); }),
              update: (id, change) => this.mutate((profile) => { const item = profile.queryParams.find((entry) => entry.id === id); if (item) change(item); }),
              remove: (id) => this.mutate((profile) => { profile.queryParams = profile.queryParams.filter((entry) => entry.id !== id); }),
              confirmDeletion: this.confirmations.confirm
            })}
          </section-card>

          ${this.renderHeaders()}
          ${this.renderCookies()}
          ${this.renderStorage("localStorage", t("text.localStorage"))}
          ${this.renderStorage("sessionStorage", t("text.sessionStorage"))}
          ${this.renderOverrides()}
          ${this.renderViewport()}
          ${this.renderGenerators()}
        </div>
      </main>
      ${this.jsonDocument === null ? nothing : html`<json-document-editor
        .value=${this.jsonDocument}
        .heading=${t("text.jsonForProfileArg0", { arg0: this.profile.name })}
        .errorMessage=${this.notice.tone === "error" ? this.notice.message : ""}
        @json-editor-change=${this.changeJson}
        @json-editor-close=${this.closeJsonEditor}
        @json-editor-apply=${this.applyJson}
      ></json-document-editor>`}
      ${this.unsavedMessage === null ? nothing : html`<unsaved-changes-dialog .message=${this.unsavedMessage} @unsaved-choice=${this.resolveUnsavedChoice}></unsaved-changes-dialog>`}
    `;
  }

  private renderHeaders() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading=${t("text.headers")} icon="headers" .count=${profile.headers.length} description=${t("text.headersToApplyToTheBrowserContext")}>
        ${renderHeaderEditor(profile.headers, {
          reorder: this.reorderOptions("headers"),
          add: () => this.mutate((draft) => { draft.headers.push(createHeader(crypto.randomUUID())); }),
          update: (id, change) => this.mutate((draft) => { const item = draft.headers.find((entry) => entry.id === id); if (item) change(item); }),
          remove: (id) => this.mutate((draft) => { draft.headers = draft.headers.filter((entry) => entry.id !== id); }),
          confirmDeletion: this.confirmations.confirm,
          apply: (id) => this.apply("headers", id),
          applyAll: () => this.apply("headers", null)
        })}
      </section-card>
    `;
  }

  private renderCookies() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading=${t("text.cookies")} icon="cookies" .count=${profile.cookies.length} description=${t("text.eachCookieKeepsItsFullAttributesInTheDetails")}>
        ${this.renderExpansionControls(this.cookieExpansion, profile.cookies, t("text.cookies"))}
        ${renderCookieEditor(profile.cookies, {
          reorder: this.reorderOptions("cookies"),
          expansion: this.cookieExpansion,
          add: () => this.mutate((draft) => { draft.cookies.push(createCookie(crypto.randomUUID())); }),
          update: (id, change) => this.updateCookie(id, change),
          remove: (id) => this.mutate((draft) => { draft.cookies = draft.cookies.filter((entry) => entry.id !== id); }),
          confirmDeletion: this.confirmations.confirm,
          apply: (id) => this.apply("cookies", id),
          applyAll: () => this.apply("cookies", null)
        })}
      </section-card>
    `;
  }

  private renderStorage(scope: "localStorage" | "sessionStorage", title: string) {
    const profile = this.profile;
    if (profile === null) return nothing;
    const entries = profile[scope];
    return html`
      <section-card heading=${title} icon=${scope} .count=${entries.length} description=${t("text.typedValuesValidatedBeforeBeingSentToTheBrowser")}>
        ${renderStorageEditor(entries, {
          reorder: this.reorderOptions(scope),
          add: () => this.mutate((draft) => { draft[scope].push(createStorageEntry(crypto.randomUUID())); }),
          update: (id, change) => this.updateStorage(scope, id, change),
          remove: (id) => this.mutate((draft) => { draft[scope] = draft[scope].filter((entry) => entry.id !== id); }),
          confirmDeletion: this.confirmations.confirm,
          apply: (id) => this.apply(scope, id),
          applyAll: () => this.apply(scope, null)
        })}
      </section-card>
    `;
  }

  private renderOverrides() {
    const profile = this.profile;
    if (profile === null) return nothing;
    return html`
      <section-card heading=${t("text.requestOverrides")} icon="overrides" .count=${profile.requestOverrides.length} description=${t("text.interceptorsConfiguredForFulfillAbortAndContinueModified")}>
        ${this.renderExpansionControls(this.overrideExpansion, profile.requestOverrides, t("text.requestOverrides"))}
        ${renderRequestOverrideEditor(profile.requestOverrides, {
          reorder: this.reorderOptions("requestOverrides"),
          reorderHeaders: (overrideId) => ({ controller: this.rowReorder, group: `overrideHeaders:${overrideId}`, move: (source, target, position) => this.updateOverride(overrideId, (override) => moveEntry(override.headers, source, target, position)) }),
          expansion: this.overrideExpansion,
          add: () => this.mutate((draft) => { draft.requestOverrides.push(createRequestOverride(crypto.randomUUID())); }),
          update: (id, change) => this.updateOverride(id, change),
          remove: (id) => this.deleteOverride(id),
          confirmDeletion: this.confirmations.confirm,
          apply: (id) => this.apply("overrides", id),
          applyAll: () => this.apply("overrides", null)
        })}
      </section-card>
    `;
  }

  private renderViewport() {
    const profile = this.profile;
    if (profile === null) return nothing;
    const viewport = profile.viewport;
    return html`
      <section-card heading=${t("text.viewport")} icon="viewport" description=${t("text.changesApplyOnTheNextStartOrCleanRestart")}>
        <div class="details-grid viewport-grid">
          <label><span>${t("text.preset")}</span><select .value=${viewport.preset} @change=${(event: Event) => this.changeViewportPreset(inputValue(event) as ViewportPresetId)}>
            <option value="desktop">${t("text.desktop19201080")}</option><option value="laptop">${t("text.laptop1366768")}</option>
            <option value="tabletPortrait">${t("text.tabletPortrait")}</option><option value="tabletLandscape">${t("text.tabletLandscape")}</option>
            <option value="mobilePortrait">${t("text.mobilePortrait")}</option><option value="mobileLandscape">${t("text.mobileLandscape")}</option><option value="custom">${t("text.custom")}</option>
          </select></label>
          ${this.numberField(t("text.width"), viewport.width, (value) => this.updateViewport("width", value))}
          ${this.numberField(t("text.height"), viewport.height, (value) => this.updateViewport("height", value))}
          ${this.numberField(t("text.scale"), viewport.deviceScaleFactor, (value) => this.updateViewport("deviceScaleFactor", value), "0.1")}
          ${this.enabledToggle(viewport.hasTouch, (value) => this.mutate((draft) => { draft.viewport.hasTouch = value; draft.viewport.preset = "custom"; }), t("text.touch"))}
          ${this.enabledToggle(viewport.isMobile, (value) => this.mutate((draft) => { draft.viewport.isMobile = value; draft.viewport.preset = "custom"; }), t("text.mobileMode"))}
        </div>
        <button slot="actions" @click=${this.restartBrowser}>${t("text.applyWithCleanRestart")}</button>
      </section-card>`;
  }

  private renderGenerators() {
    const profile = this.profile;
    if (profile === null) return nothing;
    const reorder = this.reorderOptions("generatorBindings");
    return html`
      <section-card heading=${t("text.inputsGenerators")} icon="generators" .count=${profile.generatorBindings.length} description=${t("text.reusablePureGeneratorsLinkedToASelectorAndAProperty")}>
        ${this.renderExpansionControls(this.generatorExpansion, profile.generatorBindings, t("text.inputsGenerators"))}
        <div class="rows">
          ${repeat(profile.generatorBindings, (binding) => binding.id, (binding) => {
            const expanded = this.generatorExpansion.isOpen(binding.id, true);
            const apply = () => html`<button type="button" @click=${(event: Event) => { event.stopPropagation(); this.apply("generators", binding.id); }}>${t("actions.apply")}</button>`;
            return html`
            <details class="row-details" ${reorderableRow(reorder, binding.id)} .open=${expanded} @toggle=${(event: Event) => this.generatorExpansion.toggle(binding.id, true, event)}>
              <summary class=${!expanded ? "has-collapsed-apply" : ""}>${renderRowDragHandle(reorder, binding.id, binding.selector || "generador")}<span>${generatorLabels[binding.generatorType]}</span><small>${binding.selector || t("text.selectorNotSet")}</small><span class=${binding.enabled ? "enabled-mark" : "disabled-mark"}>${binding.enabled ? t("text.enabled") : t("text.disabled")}</span>${expanded ? nothing : apply()}</summary>
              <div class="details-grid generator-grid">
                <label><span>${t("text.type")}</span><select .value=${binding.generatorType} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.generatorType = inputValue(event) as GeneratorType; item.resourceId = null; })}>${Object.entries(generatorLabels).map(([value, label]) => html`<option value=${value}>${label}</option>`)}</select></label>
                ${this.textField(t("text.cssSelector"), binding.selector, (value) => this.updateBinding(binding.id, (item) => { item.selector = value; }))}
                <label><span>${t("text.property")}</span><select .value=${binding.propertyKind} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.propertyKind = inputValue(event) as GeneratorBinding["propertyKind"]; })}><option value="value">${t("text.value2")}</option><option value="textContent">${t("text.textcontent")}</option><option value="innerText">${t("text.innertext")}</option><option value="checked">${t("text.checked")}</option><option value="attribute">${t("text.attribute")}</option><option value="property">${t("text.customProperty")}</option></select></label>
                ${this.renderResourceSelector(binding)}
                ${binding.generatorType === "string" ? this.textField(t("text.text"), binding.literalValue ?? "", (value) => this.updateBinding(binding.id, (item) => { item.literalValue = value; })) : nothing}
                ${binding.propertyKind === "attribute" || binding.propertyKind === "property" ? this.textField(t("text.propertyName"), binding.propertyName, (value) => this.updateBinding(binding.id, (item) => { item.propertyName = value; })) : nothing}
                ${binding.generatorType === "number" ? html`${this.textField(t("text.minimum"), binding.min, (value) => this.updateBinding(binding.id, (item) => { item.min = value; }), "number")}${this.textField(t("text.maximum"), binding.max, (value) => this.updateBinding(binding.id, (item) => { item.max = value; }), "number")}` : nothing}
                <label><span>${t("text.typing")}</span><select .value=${binding.inputMode} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { const mode = inputValue(event) as GeneratorBinding["inputMode"]; if (mode === "sequential" && item.inputMode !== "sequential" && item.delayMs === 0) item.delayMs = DEFAULT_SEQUENTIAL_DELAY_MS; item.inputMode = mode; })}><option value="instant">${t("text.instant")}</option><option value="sequential">${t("text.sequential")}</option></select></label>
                ${binding.inputMode === "sequential" ? this.numberField(t("text.delayPerKeyMs"), binding.delayMs, (value) => this.updateBinding(binding.id, (item) => { item.delayMs = Math.max(0, value); })) : nothing}
              </div>
              ${this.previews[binding.id] ? html`<output class="generator-preview">${t("text.sample")} ${this.previews[binding.id]}</output>` : nothing}
              <div class="row-actions">${this.enabledToggle(binding.enabled, (enabled) => this.updateBinding(binding.id, (item) => { item.enabled = enabled; }))}<button type="button" @click=${() => this.post({ type: "browser.selectElement", bindingId: binding.id })}>${t("text.selectElement")}</button><button type="button" @click=${() => this.preview(binding)}>${t("text.generateSample")}</button>${expanded ? apply() : nothing}<button type="button" class="danger" @click=${async () => { if (await this.confirmations.confirm({ question: t("text.deleteGeneratorArg0", { arg0: generatorLabels[binding.generatorType] }) })) this.mutate((draft) => { draft.generatorBindings = draft.generatorBindings.filter(({ id }) => id !== binding.id); }); }}>${t("actions.delete")}</button></div>
            </details>
          `; })}
          ${profile.generatorBindings.length === 0 ? html`<empty-state message="No hay generadores vinculados."></empty-state>` : nothing}
        </div>
        <div slot="actions" class="slot-actions"><button @click=${() => this.mutate((draft) => { draft.generatorBindings.push(createGeneratorBinding(crypto.randomUUID())); })}>${t("text.add")}</button><button @click=${() => this.apply("generators", null)}>${t("actions.applyAll")}</button><button @click=${() => this.post({ type: "browser.resetGenerators" })}>${t("text.reset")}</button></div>
      </section-card>
    `;
  }

  private reorderOptions(field: ManualListField): RowReorderOptions {
    return { controller: this.rowReorder, group: field, move: (source, target, position) => this.mutate((profile) => moveEntry(profile[field], source, target, position)) };
  }

  private createExpansionState(field: ExpandableManualField): CollapsibleEntryState {
    return new CollapsibleEntryState(() => this.requestUpdate(), {
      read: (id) => this.profile?.[field].find((entry) => entry.id === id)?.expanded,
      write: (ids, open) => this.mutate((profile) => {
        const selected = new Set(ids);
        for (const entry of profile[field]) if (selected.has(entry.id)) entry.expanded = open;
      })
    });
  }

  private renderExpansionControls(expansion: CollapsibleEntryState, entries: readonly { readonly id: string }[], label: string) {
    const ids = entries.map(({ id }) => id);
    return html`<div slot="actions" class="section-expansion-controls" role="group" aria-label=${t("text.expandRowsInArg0", { arg0: label })}>
      <button type="button" ?disabled=${ids.length === 0} @click=${() => expansion.setAll(ids, true)}>${t("text.expandAll")}</button>
      <button type="button" ?disabled=${ids.length === 0} @click=${() => expansion.setAll(ids, false)}>${t("text.collapseAll")}</button>
    </div>`;
  }

  private readonly onMessage = (event: MessageEvent<ExtensionToManualMessage>): void => {
    const message = event.data;
    if (message.type === "ui.destructiveActionConfirmed") {
      this.confirmations.resolve(message);
    } else if (message.type === "manual.state") {
      this.cancelAutoSave();
      this.pendingSave = null;
      this.changingProfile = false;
      this.profile = structuredClone(message.state.profile);
      this.savedProfile = message.state.savedProfile === null ? null : structuredClone(message.state.savedProfile);
      this.profiles = message.state.profiles;
      this.formulas = message.state.resources.formulas;
      this.arrays = message.state.resources.arrays;
      this.browser = message.state.browser;
      this.previews = {};
      this.pendingPortableResources = null;
      if (this.awaitingSaveTransition) {
        const transition = this.pendingTransition;
        this.awaitingSaveTransition = false;
        this.pendingTransition = null;
        transition?.();
      }
    } else if (message.type === "manual.saved") {
      const pending = this.pendingSave;
      if (pending === null || pending.requestId !== message.requestId) return;
      this.pendingSave = null;
      if (this.profile?.id === pending.profile.id) {
        const sameResources = JSON.stringify(this.pendingPortableResources) === JSON.stringify(pending.resources);
        this.profile = reconcileSavedProfile(this.profile, pending.profile, message.state.profile, sameResources);
        this.savedProfile = structuredClone(message.state.savedProfile);
        this.profiles = message.state.profiles;
        this.formulas = message.state.resources.formulas;
        this.arrays = message.state.resources.arrays;
        if (sameResources) this.pendingPortableResources = null;
        if (this.awaitingSaveTransition) {
          if (this.hasUnsavedChanges()) this.saveProfile();
          else {
            const transition = this.pendingTransition;
            this.awaitingSaveTransition = false;
            this.pendingTransition = null;
            transition?.();
          }
        }
        this.scheduleAutoSave();
      }
    } else if (message.type === "manual.saveFailed") {
      if (message.requestId !== this.pendingSave?.requestId) return;
      this.pendingSave = null;
      this.cancelAutoSave();
      this.awaitingSaveTransition = false;
      this.pendingTransition = null;
      this.notice = { tone: "error", message: message.error };
    } else if (message.type === "manual.operationCanceled") {
      this.changingProfile = false;
      this.onUserActivity();
    } else if (message.type === "manual.resources") {
      this.formulas = message.resources.formulas;
      this.arrays = message.resources.arrays;
    } else if (message.type === "manual.notice") {
      this.notice = { tone: message.tone, message: message.message };
      if (message.tone === "error") { this.awaitingSaveTransition = false; this.pendingTransition = null; this.changingProfile = false; }
    } else if (message.type === "manual.jsonDocument") {
      this.cancelAutoSave();
      this.jsonDocument = message.serialized;
      this.notice = { tone: "info", message: "" };
    } else if (message.type === "manual.jsonApplied") {
      this.profile = structuredClone(message.bundle.profile);
      this.pendingPortableResources = {
        formulas: structuredClone(message.bundle.formulas),
        arrays: structuredClone(message.bundle.arrays)
      };
      this.jsonDocument = null;
      this.previews = {};
      this.onUserActivity();
    } else if (message.type === "browser.elementSelected") {
      this.updateBinding(message.bindingId, (binding) => { binding.selector = message.selector; });
    } else if (message.type === "browser.generatorPreview") {
      this.previews = { ...this.previews, [message.bindingId]: message.value };
    } else if (message.type === "browser.state") {
      this.browser = message.browser;
    }
    this.requestUpdate();
  };

  private readonly closeJsonEditor = (): void => { this.jsonDocument = null; this.onUserActivity(); this.requestUpdate(); };
  private readonly changeJson = (event: CustomEvent<JsonEditorApplyDetail>): void => { this.jsonDocument = event.detail.serialized; };

  private readonly applyJson = (event: CustomEvent<JsonEditorApplyDetail>): void => {
    if (this.profile === null) return;
    this.post({ type: "manual.applyJson", serialized: event.detail.serialized, currentId: this.profile.id });
  };

  private mutate(change: (profile: ManualProfile) => void): void {
    if (this.profile === null) return;
    const draft = structuredClone(this.profile);
    change(draft);
    const size = assessDocumentSize(JSON.stringify(draft));
    if (size.exceedsLimit) {
      this.notice = { tone: "error", message: documentSizeLimitMessage(size.bytes) };
      this.requestUpdate();
      return;
    }
    this.profile = draft;
    this.onUserActivity();
    if (size.shouldWarn) this.notice = { tone: "warning", message: t("text.theProfileUsesArg0OfArg1", { arg0: formatBytes(size.bytes), arg1: formatBytes(MAX_DOCUMENT_BYTES) }) };
    this.requestUpdate();
  }

  private readonly selectProfile = (event: Event): void => {
    if (this.profile === null) return;
    const id = inputValue(event);
    if (event.currentTarget instanceof HTMLSelectElement) event.currentTarget.value = this.profile.id;
    this.guardTransition(() => this.post({ type: "manual.select", id }), t("text.saveTheProfileBeforeChangingTheSelection"));
  };

  private readonly newProfile = (): void => {
    this.guardTransition(() => this.post({ type: "manual.new" }), t("text.saveTheProfileBeforeCreatingAnotherOne"));
  };

  private readonly saveProfile = (): void => {
    if (this.profile === null || this.pendingSave !== null) return;
    this.cancelAutoSave();
    const requestId = `manual-save-${++this.saveSequence}`;
    this.pendingSave = { requestId, profile: structuredClone(this.profile), resources: structuredClone(this.pendingPortableResources) };
    this.post({ type: "manual.save", ...this.pendingSave });
    this.requestUpdate();
  };

  private readonly toggleAutoSave = (): void => {
    this.mutate((profile) => { profile.preferences = { ...profile.preferences, autoSaveEnabled: !isAutoSaveEnabled(profile.preferences) }; });
  };

  private readonly onUserActivity = (): void => { this.autoSave.activity(); };

  private cancelAutoSave(): void {
    this.autoSave.cancel();
  }

  private scheduleAutoSave(): void {
    this.autoSave.schedule();
  }
  private readonly exportProfile = (): void => { if (this.profile) this.post({ type: "manual.export", profile: this.profile, resources: this.pendingPortableResources }); };
  private readonly viewJson = (): void => { if (this.profile) this.post({ type: "manual.viewJson", profile: this.profile, resources: this.pendingPortableResources }); };
  private readonly importProfile = (): void => {
    this.guardTransition(() => this.post({ type: "manual.import" }), t("text.saveTheProfileBeforeImporting"));
  };
  private hasUnsavedChanges(): boolean { return this.profile !== null && (isProfileDirty(this.profile, this.savedProfile) || this.pendingPortableResources !== null); }
  private guardTransition(transition: () => void, message: string): void {
    this.cancelAutoSave();
    const beginTransition = () => { this.changingProfile = true; this.cancelAutoSave(); transition(); };
    if (!this.hasUnsavedChanges()) { beginTransition(); return; }
    this.pendingTransition = beginTransition;
    this.unsavedMessage = message;
    this.requestUpdate();
  }
  private readonly resolveUnsavedChoice = (event: CustomEvent<UnsavedChangesChoice>): void => {
    this.unsavedMessage = null;
    if (event.detail === "cancel") this.pendingTransition = null;
    else if (event.detail === "discard") { const transition = this.pendingTransition; this.pendingTransition = null; transition?.(); }
    else { this.awaitingSaveTransition = true; this.saveProfile(); }
    this.scheduleAutoSave();
    this.requestUpdate();
  };
  private readonly deleteProfile = (): void => {
    this.cancelAutoSave();
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
    this.onUserActivity();
    this.post({ type: "browser.syncOverrides", profile: draft });
    this.requestUpdate();
  }
  private updateBinding(id: string, change: (entry: GeneratorBinding) => void): void { this.mutate((profile) => { const item = profile.generatorBindings.find((entry) => entry.id === id); if (item) change(item); }); }

  private enabledToggle(value: boolean, change: (enabled: boolean) => void, label = t("text.enabled")) {
    return html`<label class="check-label"><input type="checkbox" .checked=${value} @change=${(event: Event) => change(inputChecked(event))}><span>${label}</span></label>`;
  }

  private renderResourceSelector(binding: GeneratorBinding) {
    if (binding.generatorType !== "formula" && binding.generatorType !== "array") return nothing;
    const resources = binding.generatorType === "formula" ? this.formulas : this.arrays;
    const missingReference = binding.resourceId !== null && !resources.some(({ id }) => id === binding.resourceId);
    return html`
      <label class="wide"><span>${binding.generatorType === "formula" ? t("text.formula") : t("text.array")}</span>
        <select .value=${binding.resourceId ?? ""} @change=${(event: Event) => this.updateBinding(binding.id, (item) => { item.resourceId = inputValue(event) || null; })}>
          <option value="">${t("text.selectAResource")}</option>
          ${resources.map((resource) => html`<option value=${resource.id}>${resource.name}</option>`)}
        </select>
      </label>
      ${resources.length === 0 ? html`<p class="phase-note wide">${t("text.noSavedResourcesOfThisType")}</p>` : nothing}
      ${missingReference ? html`<p class="phase-note wide">${t("text.theSavedReferenceIsNoLongerAvailable")}</p>` : nothing}
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
