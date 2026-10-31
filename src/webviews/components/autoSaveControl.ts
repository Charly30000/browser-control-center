import { t } from "../../localization";
import { html } from "lit";
import { live } from "lit/directives/live.js";
import "./autoSaveControl.css";

export const renderAutoSaveControl = (enabled: boolean, toggle: () => void) => html`
  <div class="auto-save-bar">
    <label class="auto-save-control">
      <span>${t("autoSave.title")}</span>
      <input class="auto-save-switch" type="checkbox" role="switch" aria-label=${t("autoSave.title")} .checked=${live(enabled)} @change=${toggle}>
      <span class="auto-save-value">${enabled ? t("autoSave.on") : t("autoSave.off")}</span>
    </label>
    <span class="auto-save-hint">${t("autoSave.description")}</span>
  </div>`;
