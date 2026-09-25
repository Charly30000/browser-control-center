import { describe, expect, it } from "vitest";
import { createAutomationNode } from "../src/domain/automations/automation";
import { ClipboardManager } from "../src/webviews/pages/Automatizaciones/canvas/ClipboardManager";
import { ConnectionManager } from "../src/webviews/pages/Automatizaciones/canvas/ConnectionManager";
import { HistoryManager } from "../src/webviews/pages/Automatizaciones/canvas/HistoryManager";
import { SelectionManager } from "../src/webviews/pages/Automatizaciones/canvas/SelectionManager";
import { screenToWorld, worldToScreen } from "../src/webviews/pages/Automatizaciones/canvas/geometry";

describe("edición del canvas", () => {
  it("selecciona mediante rectángulo y convierte coordenadas", () => {
    const nodes = [createAutomationNode("a", "navigate", { x: 10, y: 10 }), createAutomationNode("b", "click", { x: 400, y: 400 })];
    const selection = new SelectionManager(); selection.rectangle(nodes, { x: 0, y: 0 }, { x: 220, y: 120 }, false);
    expect([...selection.ids()]).toEqual(["a"]);
    const viewport = { pan: { x: 20, y: 30 }, zoom: 2 }; const screen = worldToScreen({ x: 10, y: 15 }, viewport);
    expect(screenToWorld(screen, viewport)).toEqual({ x: 10, y: 15 });
  });
  it("copia solo conexiones internas y repara IDs al pegar", () => {
    const nodes = [createAutomationNode("a", "navigate", { x: 0, y: 0 }), createAutomationNode("b", "click", { x: 200, y: 0 }), createAutomationNode("c", "click", { x: 400, y: 0 })];
    const edges = [{ id: "ab", sourceNodeId: "a", sourcePort: "out", targetNodeId: "b", targetPort: "in" }, { id: "bc", sourceNodeId: "b", sourcePort: "out", targetNodeId: "c", targetPort: "in" }];
    const clipboard = new ClipboardManager(); clipboard.copy(nodes, edges, new Set(["a", "b"])); const pasted = clipboard.paste();
    expect(pasted?.nodes).toHaveLength(2); expect(pasted?.edges).toHaveLength(1);
    expect(pasted?.edges[0]?.sourceNodeId).not.toBe("a"); expect(pasted?.edges[0]?.targetNodeId).not.toBe("b");
  });
  it("mantiene undo y redo", () => {
    const history = new HistoryManager<number>((value) => value); history.push(1); history.push(2);
    expect(history.undo(3)).toBe(2); expect(history.undo(2)).toBe(1); expect(history.redo(1)).toBe(2);
  });
  it("mantiene un destino sugerido y confirma o cancela conexiones", () => {
    const connections = new ConnectionManager();
    connections.start("a", { x: 176, y: 36 });
    connections.update({ x: 400, y: 36 }, "b");
    expect(connections.snapshot()).toEqual({ sourceNodeId: "a", point: { x: 400, y: 36 }, targetNodeId: "b" });
    expect(connections.finish()).toMatchObject({ sourceNodeId: "a", sourcePort: "out", targetNodeId: "b", targetPort: "in" });
    expect(connections.snapshot()).toBeNull();

    connections.start("a", { x: 176, y: 36 });
    connections.cancel();
    expect(connections.finish("b")).toBeNull();
  });
});
