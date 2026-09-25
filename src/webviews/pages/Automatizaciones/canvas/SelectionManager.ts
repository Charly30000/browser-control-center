import type { AutomationNode, Point } from "../../../../domain/automations/automation";
import { intersects, nodeRect, normalizeRect } from "./geometry";

export class SelectionManager {
  private selected = new Set<string>();
  public ids(): ReadonlySet<string> { return new Set(this.selected); }
  public replace(ids: Iterable<string>): void { this.selected = new Set(ids); }
  public select(id: string, additive: boolean): void {
    if (!additive) this.selected.clear();
    if (additive && this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
  }
  public rectangle(nodes: readonly AutomationNode[], start: Point, end: Point, additive: boolean): void {
    const ids = nodes.filter((node) => intersects(nodeRect(node.position), normalizeRect(start, end))).map(({ id }) => id);
    if (!additive) this.selected.clear();
    for (const id of ids) this.selected.add(id);
  }
}
