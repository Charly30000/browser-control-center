import { html, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { AutomationDocument } from "../../../../domain/automations/automation";
import type { GroupExecutionSummary, ProcessExecutionSnapshot } from "../../../../domain/automations/executionState";

export interface AutomationTreeCallbacks {
  selectGroup(id: string): void; selectProcess(groupId: string, processId: string): void;
  renameGroup(groupId: string, name: string): void; removeGroup(groupId: string): void; addProcess(groupId: string): void;
  runGroup(groupId: string): void; runProcess(groupId: string, processId: string): void; stop(): void;
  duplicateProcess(groupId: string, processId: string): void; copyProcess(groupId: string, processId: string): void;
  moveProcess(sourceGroupId: string, processId: string, targetGroupId: string): void; removeProcess(groupId: string, processId: string): void;
}

export const renderAutomationTree = (document: AutomationDocument, selectedGroupId: string | null, selectedProcessId: string | null, selectionKind: "group" | "process", processes: Readonly<Record<string, ProcessExecutionSnapshot>>, groups: Readonly<Record<string, GroupExecutionSummary>>, callbacks: AutomationTreeCallbacks): TemplateResult => html`
  <aside class="automation-tree">
    <h2>Grupos y procesos</h2>
    ${document.groups.length === 0 ? html`<p class="empty-hint">Crea un grupo para comenzar.</p>` : document.groups.map((group) => {
      const summary = groups[group.id];
      return html`<section class=${group.id === selectedGroupId && selectionKind === "group" ? "tree-group selected" : "tree-group"}>
        <header>
          <input class="tree-name" aria-label="Nombre del grupo" .value=${live(group.name)} @focus=${() => callbacks.selectGroup(group.id)} @input=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLInputElement) callbacks.renameGroup(group.id, target.value); }}>
          <button title="Ejecutar grupo" @click=${() => callbacks.runGroup(group.id)}>▶</button><button title="Detener ejecución" @click=${() => callbacks.stop()}>■</button>
          <button title="Añadir proceso" @click=${() => callbacks.addProcess(group.id)}>＋</button><button class="danger" title="Eliminar grupo" @click=${() => callbacks.removeGroup(group.id)}>×</button>
        </header>
        ${summary === undefined ? null : html`<small class="group-summary">${summary.completed}/${summary.total} · ${summary.failed} fallidos</small>`}
        <div class="process-list">${group.processes.map((process) => html`<div class=${process.id === selectedProcessId && selectionKind === "process" ? "process-row selected" : "process-row"}>
          <button class="process-name" @click=${() => callbacks.selectProcess(group.id, process.id)}><span class=${`state-dot ${processes[process.id]?.state ?? "idle"}`}></span>${process.name}</button>
          <button title="Ejecutar proceso" @click=${() => callbacks.runProcess(group.id, process.id)}>▶</button>
          <button title="Detener ejecución" @click=${() => callbacks.stop()}>■</button>
          <button title="Duplicar" @click=${() => callbacks.duplicateProcess(group.id, process.id)}>⧉</button>
          <button title="Copiar" @click=${() => callbacks.copyProcess(group.id, process.id)}>⎘</button>
          <select title="Mover a grupo" @change=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLSelectElement) { if (target.value) callbacks.moveProcess(group.id, process.id, target.value); target.value = ""; } }}><option value="">Mover…</option>${document.groups.filter(({ id }) => id !== group.id).map((target) => html`<option value=${target.id}>${target.name}</option>`)}</select>
          <button class="danger" title="Eliminar" @click=${() => callbacks.removeProcess(group.id, process.id)}>×</button>
        </div>`)}</div>
      </section>`;
    })}
  </aside>`;
