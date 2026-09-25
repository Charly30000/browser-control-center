import type { Point } from "../../../../domain/automations/automation";
import { clampZoom, screenToWorld, type CanvasViewport } from "./geometry";

export class ViewportManager {
  private value: CanvasViewport = { pan: { x: 40, y: 40 }, zoom: 1 };
  public snapshot(): CanvasViewport { return structuredClone(this.value); }
  public pan(delta: Point): CanvasViewport { this.value = { ...this.value, pan: { x: this.value.pan.x + delta.x, y: this.value.pan.y + delta.y } }; return this.snapshot(); }
  public zoomAt(screenPoint: Point, factor: number): CanvasViewport {
    const worldBefore = screenToWorld(screenPoint, this.value); const zoom = clampZoom(this.value.zoom * factor);
    this.value = { zoom, pan: { x: screenPoint.x - worldBefore.x * zoom, y: screenPoint.y - worldBefore.y * zoom } }; return this.snapshot();
  }
  public reset(): CanvasViewport { this.value = { pan: { x: 40, y: 40 }, zoom: 1 }; return this.snapshot(); }
}
