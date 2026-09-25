import { describe, expect, it } from "vitest";
import { createAutomationNode } from "../src/domain/automations/automation";
import { topologicalOrder } from "../src/domain/automations/graph";

describe("grafo de automatización", () => {
  it("produce un orden topológico determinista", () => {
    const first = createAutomationNode("a", "navigate", { x: 200, y: 0 });
    const second = createAutomationNode("b", "click", { x: 0, y: 100 });
    const result = topologicalOrder([second, first], [{ id: "edge", sourceNodeId: "a", sourcePort: "out", targetNodeId: "b", targetPort: "in" }]);
    expect(result.ok && result.value.map(({ id }) => id)).toEqual(["a", "b"]);
  });
  it("rechaza ciclos y referencias rotas", () => {
    const a = createAutomationNode("a", "navigate", { x: 0, y: 0 }); const b = createAutomationNode("b", "click", { x: 0, y: 100 });
    expect(topologicalOrder([a, b], [{ id: "1", sourceNodeId: "a", sourcePort: "out", targetNodeId: "b", targetPort: "in" }, { id: "2", sourceNodeId: "b", sourcePort: "out", targetNodeId: "a", targetPort: "in" }]).ok).toBe(false);
    expect(topologicalOrder([a], [{ id: "1", sourceNodeId: "a", sourcePort: "out", targetNodeId: "missing", targetPort: "in" }]).ok).toBe(false);
  });
});
