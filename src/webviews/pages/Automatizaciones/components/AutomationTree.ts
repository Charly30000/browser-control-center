import { html, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import { renderRowDragHandle, reorderableRow, rowDropZone, type RowReorderOptions, type RowDropZoneOptions } from "../../../components/rowReorder";
import type { AutomationDocument } from "../../../../domain/automations/automation";
import type { GroupExecutionSummary, ProcessExecutionSnapshot } from "../../../../domain/automations/executionState";

export interface AutomationTreeCallbacks {
  readonly groupReorder: RowReorderOptions;
  readonly processReorder: RowReorderOptions;
  processDropZone(groupId: string): RowDropZoneOptions;
  setGroupExpanded(groupId: string, expanded: boolean): void;
  selectGroup(id: string): void; selectProcess(groupId: string, processId: string): void;
  renameGroup(groupId: string, name: string): void; removeGroup(groupId: string): void; addProcess(groupId: string): void;
  renameProcess(groupId: string, processId: string, name: string): void;
  runGroup(groupId: string): void; runProcess(groupId: string, processId: string): void; stop(): void;
  duplicateProcess(groupId: string, processId: string): void; copyProcess(groupId: string, processId: string): void;
  moveProcess(sourceGroupId: string, processId: string, targetGroupId: string): void; removeProcess(groupId: string, processId: string): void;
}

export const renderAutomationTree = (document: AutomationDocument, selectedGroupId: string | null, selectedProcessId: string | null, selectionKind: "group" | "process", processes: Readonly<Record<string, ProcessExecutionSnapshot>>, groups: Readonly<Record<string, GroupExecutionSummary>>, callbacks: AutomationTreeCallbacks): TemplateResult => html`
  <aside class="automation-tree">
    <h2>Grupos y procesos</h2>
    ${document.groups.length === 0 ? html`<p class="empty-hint">Crea un grupo para comenzar.</p>` : repeat(document.groups, (group) => group.id, (group) => {
      const summary = groups[group.id];
      const expanded = group.expanded ?? true;
      const listId = `automation-group-processes-${encodeURIComponent(group.id)}`;
      return html`<section class=${group.id === selectedGroupId && selectionKind === "group" ? "tree-group selected" : "tree-group"} ${reorderableRow(callbacks.groupReorder, group.id)} data-group-id=${group.id} aria-label=${`Grupo ${group.name}`}>
        <header class="tree-group-header" ${rowDropZone(callbacks.processDropZone(group.id))}>
          <div class="tree-group-heading">
            ${renderRowDragHandle(callbacks.groupReorder, group.id, `grupo ${group.name}`)}
            <button type="button" class="group-expansion-toggle" aria-expanded=${String(expanded)} aria-controls=${listId} aria-label=${expanded ? "Contraer grupo" : "Expandir grupo"} title=${expanded ? "Contraer grupo" : "Expandir grupo"} @click=${() => callbacks.setGroupExpanded(group.id, !expanded)}><span aria-hidden="true">${expanded ? "▾" : "▸"}</span></button>
            <span class="tree-kind"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 7V5h7l2 3h9v12H3Z"/></svg>Grupo</span><span class="tree-count">${group.processes.length} ${group.processes.length === 1 ? "proceso" : "procesos"}</span>
          </div>
          <input class="tree-name" aria-label="Nombre del grupo" title=${group.name} placeholder="Nombre del grupo" .value=${live(group.name)} @focus=${() => callbacks.selectGroup(group.id)} @input=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLInputElement) callbacks.renameGroup(group.id, target.value); }}>
          <div class="tree-group-actions">
            <button title="Ejecutar grupo" aria-label="Ejecutar grupo" @click=${() => callbacks.runGroup(group.id)}>▶ Ejecutar</button><button title="Detener ejecución" aria-label="Detener ejecución" @click=${() => callbacks.stop()}>■</button>
            <button title="Añadir proceso" aria-label="Añadir proceso" @click=${() => callbacks.addProcess(group.id)}>＋ Proceso</button><button class="danger" title="Eliminar grupo" aria-label="Eliminar grupo" @click=${() => callbacks.removeGroup(group.id)}>×</button>
          </div>
        </header>
        ${summary === undefined ? null : html`<small class="group-summary">${summary.completed}/${summary.total} · ${summary.failed} fallidos</small>`}
        <div class="process-list" id=${listId} ?hidden=${!expanded} ${rowDropZone(callbacks.processDropZone(group.id))}>${group.processes.length === 0 ? html`<p class="empty-hint">Añade o arrastra un proceso a este grupo.</p>` : repeat(group.processes, (process) => process.id, (process) => html`<div class=${process.id === selectedProcessId && selectionKind === "process" ? "process-row selected" : "process-row"} ${reorderableRow(callbacks.processReorder, process.id)} data-process-id=${process.id}>
          <div class="process-heading">${renderRowDragHandle(callbacks.processReorder, process.id, `proceso ${process.name}`)}<span class="tree-kind">Proceso</span><span class=${`state-dot ${processes[process.id]?.state ?? "idle"}`} role="img" aria-label=${`Estado: ${processes[process.id]?.state ?? "idle"}`}></span></div>
          <input class="tree-name process-name" aria-label="Nombre del proceso" title=${process.name} placeholder="Nombre del proceso" .value=${live(process.name)} @focus=${() => callbacks.selectProcess(group.id, process.id)} @input=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLInputElement) callbacks.renameProcess(group.id, process.id, target.value); }}>
          <div class="process-actions">
            <button title="Ejecutar proceso" aria-label="Ejecutar proceso" @click=${() => callbacks.runProcess(group.id, process.id)}>▶</button>
            <button title="Detener ejecución" aria-label="Detener ejecución" @click=${() => callbacks.stop()}>■</button>
            <button title="Duplicar" aria-label="Duplicar proceso" @click=${() => callbacks.duplicateProcess(group.id, process.id)}>⧉</button>
            <button title="Copiar" aria-label="Copiar proceso" @click=${() => callbacks.copyProcess(group.id, process.id)}>⎘</button>
            <button class="danger" title="Eliminar" aria-label="Eliminar proceso" @click=${() => callbacks.removeProcess(group.id, process.id)}>×</button>
            <select title="Mover a grupo" aria-label="Mover proceso a grupo" @change=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLSelectElement) { if (target.value) callbacks.moveProcess(group.id, process.id, target.value); target.value = ""; } }}><option value="">Mover a grupo…</option>${document.groups.filter(({ id }) => id !== group.id).map((target) => html`<option value=${target.id}>${target.name}</option>`)}</select>
          </div>
        </div>`)}</div>
      </section>`;
    })}
  </aside>`;
