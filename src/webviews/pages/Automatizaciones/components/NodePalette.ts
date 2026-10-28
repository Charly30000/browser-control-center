import { html, type TemplateResult } from "lit";
import type { AutomationNodeType } from "../../../../domain/automations/automation";
import type { NodeDescriptor } from "../../../../application/automations/nodeRegistry";

export const renderNodePalette = (descriptors: readonly NodeDescriptor[], add: (type: AutomationNodeType) => void): TemplateResult => {
  const available = descriptors.filter(({ availableInPalette }) => availableInPalette);
  const categories = [...new Set(available.map(({ category }) => category))];
  return html`<aside class="node-palette"><h2>Nodos</h2>${categories.map((category) => html`<details open><summary>${category}</summary><div>${available.filter((item) => item.category === category).map((item) => html`<button @click=${() => add(item.type)}>＋ ${item.title}</button>`)}</div></details>`)}</aside>`;
};
