import { t } from "../../../../localization";
import { executionStateLabel } from "../../../../localization/displayLabels";
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

const selectProcessCard = (event: MouseEvent, select: () => void): void => {
  if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a, [contenteditable]")) return;
  select();
};

const activateProcessCard = (event: KeyboardEvent, select: () => void): void => {
  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  select();
};

export const renderAutomationTree = (document: AutomationDocument, selectedGroupId: string | null, selectedProcessId: string | null, selectionKind: "group" | "process", processes: Readonly<Record<string, ProcessExecutionSnapshot>>, groups: Readonly<Record<string, GroupExecutionSummary>>, callbacks: AutomationTreeCallbacks): TemplateResult => html`
  <aside class="automation-tree">
    <h2>${t("text.groupsAndProcesses")}</h2>
    ${document.groups.length === 0 ? html`<p class="empty-hint">${t("text.createAGroupToGetStarted")}</p>` : repeat(document.groups, (group) => group.id, (group) => {
      const summary = groups[group.id];
      const expanded = group.expanded ?? true;
      const listId = `automation-group-processes-${encodeURIComponent(group.id)}`;
      return html`<section class=${group.id === selectedGroupId && selectionKind === "group" ? "tree-group selected" : "tree-group"} ${reorderableRow(callbacks.groupReorder, group.id)} data-group-id=${group.id} aria-label=${t("text.groupArg0", { arg0: group.name })}>
        <header class="tree-group-header" ${rowDropZone(callbacks.processDropZone(group.id))}>
          <div class="tree-group-heading">
            ${renderRowDragHandle(callbacks.groupReorder, group.id, t("text.groupArg02", { arg0: group.name }))}
            <button type="button" class="group-expansion-toggle" aria-expanded=${String(expanded)} aria-controls=${listId} aria-label=${expanded ? t("text.collapseGroup") : t("text.expandGroup")} title=${expanded ? t("text.collapseGroup") : t("text.expandGroup")} @click=${() => callbacks.setGroupExpanded(group.id, !expanded)}><span aria-hidden="true">${expanded ? "▾" : "▸"}</span></button>
            <span class="tree-kind"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 7V5h7l2 3h9v12H3Z"/></svg>${t("text.group")}</span><span class="tree-count">${group.processes.length} ${group.processes.length === 1 ? t("text.process2") : t("text.processes")}</span>
          </div>
          <input class="tree-name" aria-label=${t("text.groupName")} title=${group.name} placeholder=${t("text.groupName")} .value=${live(group.name)} @focus=${() => callbacks.selectGroup(group.id)} @input=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLInputElement) callbacks.renameGroup(group.id, target.value); }}>
          <div class="tree-group-actions">
            <button title=${t("text.runGroup")} aria-label=${t("text.runGroup")} @click=${() => callbacks.runGroup(group.id)}>${t("text.run")}</button><button title=${t("text.stopExecution")} aria-label=${t("text.stopExecution")} @click=${() => callbacks.stop()}>■</button>
            <button title=${t("text.addProcess")} aria-label=${t("text.addProcess")} @click=${() => callbacks.addProcess(group.id)}>${t("text.process")}</button><button class="danger" title=${t("text.deleteGroup")} aria-label=${t("text.deleteGroup")} @click=${() => callbacks.removeGroup(group.id)}>×</button>
          </div>
        </header>
        ${summary === undefined ? null : html`<small class="group-summary">${summary.completed}/${summary.total} · ${summary.failed} ${t("text.failed")}</small>`}
        <div class="process-list" id=${listId} ?hidden=${!expanded} ${rowDropZone(callbacks.processDropZone(group.id))}>${group.processes.length === 0 ? html`<p class="empty-hint">${t("text.addOrDragAProcessIntoThisGroup")}</p>` : repeat(group.processes, (process) => process.id, (process) => html`<div class=${process.id === selectedProcessId && selectionKind === "process" ? "process-row selected" : "process-row"} ${reorderableRow(callbacks.processReorder, process.id)} data-process-id=${process.id} role="group" tabindex="0" aria-label=${t("text.processArg0", { arg0: process.name })} @click=${(event: MouseEvent) => selectProcessCard(event, () => callbacks.selectProcess(group.id, process.id))} @keydown=${(event: KeyboardEvent) => activateProcessCard(event, () => callbacks.selectProcess(group.id, process.id))}>
          <div class="process-heading">${renderRowDragHandle(callbacks.processReorder, process.id, t("text.processArg0", { arg0: process.name }))}<span class="tree-kind">${t("text.process3")}</span><span class=${`state-dot ${processes[process.id]?.state ?? "idle"}`} role="img" aria-label=${t("text.statusArg0", { arg0: executionStateLabel(processes[process.id]?.state ?? "idle") })}></span></div>
          <input class="tree-name process-name" aria-label=${t("text.processName")} title=${process.name} placeholder=${t("text.processName")} .value=${live(process.name)} @focus=${() => callbacks.selectProcess(group.id, process.id)} @input=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLInputElement) callbacks.renameProcess(group.id, process.id, target.value); }}>
          <div class="process-actions">
            <button title=${t("text.runProcess")} aria-label=${t("text.runProcess")} @click=${() => callbacks.runProcess(group.id, process.id)}>▶</button>
            <button title=${t("text.stopExecution")} aria-label=${t("text.stopExecution")} @click=${() => callbacks.stop()}>■</button>
            <button title=${t("text.duplicate")} aria-label=${t("text.duplicateProcess")} @click=${() => callbacks.duplicateProcess(group.id, process.id)}>⧉</button>
            <button title=${t("actions.copy")} aria-label=${t("text.copyProcess")} @click=${() => callbacks.copyProcess(group.id, process.id)}>⎘</button>
            <button class="danger" title=${t("actions.delete")} aria-label=${t("text.deleteProcess")} @click=${() => callbacks.removeProcess(group.id, process.id)}>×</button>
            <select title=${t("text.moveToGroup")} aria-label=${t("text.moveProcessToGroup")} @change=${(event: Event) => { const target = event.currentTarget; if (target instanceof HTMLSelectElement) { if (target.value) callbacks.moveProcess(group.id, process.id, target.value); target.value = ""; } }}><option value="">${t("text.moveToGroup2")}</option>${document.groups.filter(({ id }) => id !== group.id).map((target) => html`<option value=${target.id}>${target.name}</option>`)}</select>
          </div>
        </div>`)}</div>
      </section>`;
    })}
  </aside>`;
