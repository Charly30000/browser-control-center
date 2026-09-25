import type { Point } from "../../../../domain/automations/automation";

export interface Rect { x: number; y: number; width: number; height: number; }
export interface CanvasViewport { pan: Point; zoom: number; }
export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 72;
export const clampZoom = (zoom: number): number => Math.min(2.5, Math.max(0.25, zoom));
export const screenToWorld = (point: Point, viewport: CanvasViewport): Point => ({ x: (point.x - viewport.pan.x) / viewport.zoom, y: (point.y - viewport.pan.y) / viewport.zoom });
export const worldToScreen = (point: Point, viewport: CanvasViewport): Point => ({ x: point.x * viewport.zoom + viewport.pan.x, y: point.y * viewport.zoom + viewport.pan.y });
export const normalizeRect = (start: Point, end: Point): Rect => ({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
export const intersects = (left: Rect, right: Rect): boolean => left.x <= right.x + right.width && left.x + left.width >= right.x && left.y <= right.y + right.height && left.y + left.height >= right.y;
export const nodeRect = (position: Point): Rect => ({ ...position, width: NODE_WIDTH, height: NODE_HEIGHT });
export const edgePath = (source: Point, target: Point): string => { const bend = Math.max(60, Math.abs(target.x - source.x) * 0.45); return `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${target.x - bend} ${target.y}, ${target.x} ${target.y}`; };
