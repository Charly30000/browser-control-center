import { html } from "lit";
import { live } from "lit/directives/live.js";
import "./autoSaveControl.css";

export const renderAutoSaveControl = (enabled: boolean, toggle: () => void) => html`
  <div class="auto-save-bar">
    <label class="auto-save-control">
      <span>Guardado automático</span>
      <input class="auto-save-switch" type="checkbox" role="switch" aria-label="Guardado automático" .checked=${live(enabled)} @change=${toggle}>
      <span class="auto-save-value">${enabled ? "Activado" : "Desactivado"}</span>
    </label>
    <span class="auto-save-hint">Tras 5 segundos sin actividad</span>
  </div>`;
