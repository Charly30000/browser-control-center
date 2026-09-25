import type { AutomationEdge, Point } from "../../../../domain/automations/automation";

export interface PendingConnection {
  readonly sourceNodeId: string;
  readonly point: Point;
  readonly targetNodeId: string | null;
}
export class ConnectionManager {
  private pending: PendingConnection | null = null;
  public start(sourceNodeId: string, point: Point): void { this.pending = { sourceNodeId, point, targetNodeId: null }; }
  public update(point: Point, targetNodeId: string | null): void { if (this.pending !== null) this.pending = { ...this.pending, point, targetNodeId }; }
  public snapshot(): PendingConnection | null { return this.pending === null ? null : { ...this.pending, point: { ...this.pending.point } }; }
  public finish(targetNodeId: string | null = this.pending?.targetNodeId ?? null): AutomationEdge | null {
    const pending = this.pending; this.pending = null;
    if (pending === null || targetNodeId === null || pending.sourceNodeId === targetNodeId) return null;
    return { id: crypto.randomUUID(), sourceNodeId: pending.sourceNodeId, sourcePort: "out", targetNodeId, targetPort: "in" };
  }
  public cancel(): void { this.pending = null; }
}
