import { describe, expect, it, vi } from "vitest";
import type { GeneratorValueResolver } from "../src/application/manual/generatorValueResolver";
import type { AssertionKind, AutomationBrowserSession, AutomationBrowserSessionFactory, BrowserUserAction, ExtractProperty, WaitKind } from "../src/application/automations/automationBrowserSession";
import { ExecutionControl } from "../src/application/automations/cancellation";
import { NodeRegistry, type NodeDefinition } from "../src/application/automations/nodeRegistry";
import { ProcessRunner } from "../src/application/automations/processRunner";
import { AutomationExecutionCoordinator } from "../src/application/automations/automationExecutionCoordinator";
import { silentLogger } from "../src/application/logging/logger";
import type { Logger } from "../src/application/logging/logger";
import { createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationNodeConfig } from "../src/domain/automations/automation";
import type { CookieEntry, HeaderEntry, InputMode, RequestOverrideEntry, StorageEntry } from "../src/domain/manual/manualProfile";
import type { JsonValue } from "../src/domain/manual/storageValue";
import { success } from "../src/shared/result";
import type { DataAssertionOperator, DataAssertionSource } from "../src/domain/automations/dataAssertion";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";

class FakeSession implements AutomationBrowserSession {
  public readonly close = vi.fn((_force: boolean) => Promise.resolve());
  public navigate(_url: string, _timeoutMs: number): Promise<void> { return Promise.resolve(); }
  public click(_selector: string, _timeoutMs: number): Promise<void> { return Promise.resolve(); }
  public fill(_selector: string, _value: JsonValue, _mode: InputMode, _delayMs: number, _timeoutMs: number): Promise<void> { return Promise.resolve(); }
  public setHeaders(_entries: readonly HeaderEntry[]): Promise<void> { return Promise.resolve(); }
  public setCookies(_entries: readonly CookieEntry[]): Promise<void> { return Promise.resolve(); }
  public setStorage(_scope: "local" | "session", _entries: readonly StorageEntry[]): Promise<void> { return Promise.resolve(); }
  public removeHeaders(_names: readonly string[] | null): Promise<void> { return Promise.resolve(); }
  public removeCookies(_names: readonly string[] | null, _domain: string, _path: string): Promise<void> { return Promise.resolve(); }
  public removeStorage(_scope: "local" | "session", _names: readonly string[] | null): Promise<void> { return Promise.resolve(); }
  public setRequestOverrides(_entries: readonly RequestOverrideEntry[]): Promise<void> { return Promise.resolve(); }
  public wait(_kind: WaitKind, _options: Readonly<Record<string, JsonValue>>, _timeoutMs: number): Promise<void | JsonValue> { return Promise.resolve(); }
  public assert(_kind: AssertionKind, _options: Readonly<Record<string, JsonValue>>, _timeoutMs: number): Promise<void> { return Promise.resolve(); }
  public assertData(_source: DataAssertionSource, _operator: DataAssertionOperator, _options: Readonly<Record<string, JsonValue>>, _timeoutMs: number): Promise<void> { return Promise.resolve(); }
  public extract(_selector: string, _property: ExtractProperty, _attribute: string, _timeoutMs: number): Promise<JsonValue> { return Promise.resolve("value"); }
  public showUserPrompt(_message: string): Promise<BrowserUserAction> { return new Promise(() => undefined); }
  public hideUserPrompt(): Promise<void> { return Promise.resolve(); }
}

const definition = (type: "navigate" | "click", execute: NodeDefinition["execute"], timeout = 1_000): NodeDefinition => ({ type, title: type, category: "test", defaultTimeoutMs: timeout, inspectorFields: [], validate: (config: unknown) => success(config as AutomationNodeConfig), execute });
const generators = { resolve: () => Promise.resolve(success<JsonValue | undefined>("generated")) } as unknown as GeneratorValueResolver;
const recordingLogger = () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) satisfies Logger;

describe("ProcessRunner", () => {
  it.each([
    ["value", "42", "", "number", 42],
    ["innerText", "Título visible", "", "string", "Título visible"],
    ["textContent", '{"item":{"id":42}}', "item.id", "number", 42],
    ["attribute", "field-id", "", "string", "field-id"],
    ["value", "false", "", "boolean", false],
    ["textContent", '{"items":[1,2]}', "", "json", { items: [1, 2] }]
  ] satisfies [ExtractProperty, string, string, string, JsonValue][])("captura %s del DOM y convierte el tipo para reutilizarlo", async (property, raw, path, valueType, expected) => {
    const session = new FakeSession();
    const extract = vi.spyOn(session, "extract").mockResolvedValue(raw);
    const fill = vi.spyOn(session, "fill");
    const capture = createAutomationNode("capture", "capture-value", { x: 0, y: 0 });
    capture.config = { source: "dom", selector: "#origin", property, attribute: "data-id", path, valueType, outputVariable: "captured" };
    const field = createAutomationNode("field", "fill", { x: 200, y: 0 });
    field.config = { selector: "#target", value: "{captured}", mode: "instant", delayMs: 0 };
    const process = createAutomationProcess("process");
    process.nodes.push(capture, field);
    process.edges.push({ id: "edge", sourceNodeId: capture.id, sourcePort: "out", targetNodeId: field.id, targetPort: "in" });
    const result = await new ProcessRunner({ create: () => Promise.resolve(session) }, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);
    expect(result.success).toBe(true);
    expect(extract).toHaveBeenCalledWith("#origin", property, "data-id", 10_000);
    expect(fill).toHaveBeenCalledWith("#target", expected, "instant", 0, 10_000);
  });

  it.each(["number", "boolean", "json"])("rechaza un dato DOM incompatible con el tipo %s", async (valueType) => {
    const session = new FakeSession();
    vi.spyOn(session, "extract").mockResolvedValue("texto inválido");
    const capture = createAutomationNode("capture", "capture-value", { x: 0, y: 0 });
    capture.config = { source: "dom", selector: "#origin", property: "value", path: "", valueType, outputVariable: "captured" };
    const process = createAutomationProcess("process");
    process.nodes.push(capture);
    const result = await new ProcessRunner({ create: () => Promise.resolve(session) }, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);
    expect(result.success).toBe(false);
    expect(result.variables.snapshot()).not.toHaveProperty("captured");
  });

  it.each([
    [{ body: { items: [{ id: 42 }] } }, "body.items.0.id", 42],
    ['{"user":{"name":"Ada"}}', "user.name", "Ada"],
    [false, "", false], [0, "", 0], [null, "", null],
    [{ items: [1, 2] }, "", { items: [1, 2] }]
  ] satisfies [JsonValue, string, JsonValue][])("guarda %j del predecesor y lo reutiliza conservando su tipo", async (output, path, expected) => {
    const session = new FakeSession();
    const fill = vi.spyOn(session, "fill");
    vi.spyOn(session, "wait").mockResolvedValue(output);
    const process = createAutomationProcess("process");
    const previous = createAutomationNode("previous", "wait", { x: 0, y: 0 });
    previous.config = { kind: "response", url: "/api", status: 200 };
    const capture = createAutomationNode("capture", "capture-value", { x: 200, y: 0 });
    capture.config = { path, outputVariable: "captured" };
    const field = createAutomationNode("field", "fill", { x: 400, y: 0 });
    field.config = { selector: "#target", value: "{captured}", mode: "instant", delayMs: 0 };
    const unrelated = createAutomationNode("unrelated", "set-variable", { x: 100, y: 0 });
    unrelated.config = { name: "other", value: "otra rama" };
    process.nodes.push(previous, unrelated, capture, field);
    process.edges.push(
      { id: "first", sourceNodeId: previous.id, sourcePort: "out", targetNodeId: capture.id, targetPort: "in" },
      { id: "second", sourceNodeId: capture.id, sourcePort: "out", targetNodeId: field.id, targetPort: "in" }
    );
    const result = await new ProcessRunner({ create: () => Promise.resolve(session) }, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);
    expect(result.success).toBe(true);
    expect(fill).toHaveBeenCalledWith("#target", expected, "instant", 0, 10_000);
  });

  it.each(["missing-path", "no-output", "disconnected", "multiple-inputs"] as const)("rechaza Guardar dato con %s sin usar valores de otros nodos", async (scenario) => {
    const session = new FakeSession();
    const process = createAutomationProcess("process");
    const previous = createAutomationNode("previous", "set-variable", { x: 0, y: 0 });
    previous.config = { name: "initial", value: { id: 42 } };
    const unrelated = createAutomationNode("unrelated", "set-variable", { x: 0, y: 100 });
    unrelated.config = { name: "other", value: { id: 99 } };
    const capture = createAutomationNode("capture", "capture-value", { x: 200, y: 0 });
    capture.config = { path: scenario === "missing-path" ? "missing" : "id", outputVariable: "captured" };
    if (scenario === "no-output") { previous.type = "click"; previous.config = { selector: "#button" }; }
    process.nodes.push(previous, unrelated, capture);
    if (scenario !== "disconnected") process.edges.push({ id: "first", sourceNodeId: previous.id, sourcePort: "out", targetNodeId: capture.id, targetPort: "in" });
    if (scenario === "multiple-inputs") process.edges.push({ id: "second", sourceNodeId: unrelated.id, sourcePort: "out", targetNodeId: capture.id, targetPort: "in" });
    const result = await new ProcessRunner({ create: () => Promise.resolve(session) }, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);
    expect(result.success).toBe(false);
    expect(result.variables.snapshot()).not.toHaveProperty("captured");
  });

  it("compone la navegación con query params igual que Manual", async () => {
    const session = new FakeSession();
    const navigate = vi.spyOn(session, "navigate");
    const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const process = createAutomationProcess("process");
    const node = createAutomationNode("navigate", "navigate", { x: 0, y: 0 });
    node.config = { url: "https://example.com/path?old=value", queryParams: [{ id: "query", key: "page", value: "2", enabled: true }] };
    process.nodes.push(node);

    const result = await new ProcessRunner(sessions, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);

    expect(result.success).toBe(true);
    expect(navigate).toHaveBeenCalledWith("https://example.com/path?page=2", 30_000);
  });

  it("genera y escribe el valor desde un único nodo Campo", async () => {
    const session = new FakeSession();
    const fill = vi.spyOn(session, "fill");
    const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const process = createAutomationProcess("process");
    const node = createAutomationNode("field", "fill", { x: 0, y: 0 });
    node.config = { selector: "#name", generatorType: "firstName", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 };
    process.nodes.push(node);

    const result = await new ProcessRunner(sessions, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);

    expect(result.success).toBe(true);
    expect(fill).toHaveBeenCalledWith("#name", "generated", "instant", 0, 10_000);
  });

  it("ejecuta los nodos en orden y cierra la sesión", async () => {
    const calls: string[] = []; const session = new FakeSession(); const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const registry = new NodeRegistry().register(definition("navigate", () => { calls.push("navigate"); return Promise.resolve(); })).register(definition("click", () => { calls.push("click"); return Promise.resolve(); }));
    const process = createAutomationProcess("process"); process.nodes.push(createAutomationNode("click", "click", { x: 0, y: 100 }), createAutomationNode("navigate", "navigate", { x: 0, y: 0 })); process.edges.push({ id: "edge", sourceNodeId: "navigate", sourcePort: "out", targetNodeId: "click", targetPort: "in" });
    const logger = recordingLogger();
    const snapshots: string[] = []; const result = await new ProcessRunner(sessions, registry, generators, logger).run("group", process, new ExecutionControl(), (snapshot) => snapshots.push(snapshot.state));
    expect(result.success).toBe(true); expect(calls).toEqual(["navigate", "click"]); expect(session.close).toHaveBeenCalledWith(false); expect(snapshots).toContain("success");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("[OK] Process completed successfully"));
  });

  it("fuerza el cierre al superar el timeout", async () => {
    const session = new FakeSession(); const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const registry = new NodeRegistry().register(definition("navigate", () => new Promise<void>(() => undefined), 10));
    const process = createAutomationProcess("process"); process.nodes.push(createAutomationNode("node", "navigate", { x: 0, y: 0 }));
    const logger = recordingLogger();
    const result = await new ProcessRunner(sessions, registry, generators, logger).run("group", process, new ExecutionControl(), () => undefined);
    expect(result.success).toBe(false); expect(session.close).toHaveBeenCalledWith(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR] The node exceeded"), expect.any(Error));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR] Process finished with errors"));
  });

  it("cancela el nodo activo", async () => {
    const session = new FakeSession(); const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const registry = new NodeRegistry().register(definition("navigate", () => new Promise<void>(() => undefined), 5_000));
    const process = createAutomationProcess("process"); process.nodes.push(createAutomationNode("node", "navigate", { x: 0, y: 0 })); const control = new ExecutionControl();
    const running = new ProcessRunner(sessions, registry, generators, silentLogger).run("group", process, control, () => undefined); control.stop();
    const result = await running; expect(result.cancelled).toBe(true); expect(session.close).toHaveBeenCalledWith(false);
  });

  it("distingue la parada forzada del cierre normal", async () => {
    const session = new FakeSession(); const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const registry = new NodeRegistry().register(definition("navigate", () => new Promise<void>(() => undefined), 5_000));
    const process = createAutomationProcess("process"); process.nodes.push(createAutomationNode("node", "navigate", { x: 0, y: 0 })); const control = new ExecutionControl();
    const running = new ProcessRunner(sessions, registry, generators, silentLogger).run("group", process, control, () => undefined); control.stop(true);
    await running; expect(session.close).toHaveBeenCalledWith(true);
  });

  it("ejecuta secuencialmente todos los procesos del grupo aunque uno falle", async () => {
    const created: FakeSession[] = []; const sessions: AutomationBrowserSessionFactory = { create: () => { const session = new FakeSession(); created.push(session); return Promise.resolve(session); } };
    const registry = new NodeRegistry().register(definition("navigate", (_context, config) => config.fail === true ? Promise.reject(new Error("fallo esperado")) : Promise.resolve()));
    const first = createAutomationProcess("first", "Primero"); const firstNode = createAutomationNode("first-node", "navigate", { x: 0, y: 0 }); firstNode.config = { fail: true }; first.nodes.push(firstNode);
    const second = createAutomationProcess("second", "Segundo"); second.nodes.push(createAutomationNode("second-node", "navigate", { x: 0, y: 0 }));
    const group = createAutomationGroup("group"); group.processes.push(first, second); const summaries: number[] = [];
    const logger = recordingLogger();
    const runner = new ProcessRunner(sessions, registry, generators, logger);
    const coordinator = new AutomationExecutionCoordinator(runner, { onProcess: () => undefined, onGroup: (summary) => summaries.push(summary.completed) }, logger);
    await coordinator.runGroup(group);
    expect(created).toHaveLength(2); expect(summaries.at(-1)).toBe(2);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("[Segundo] [OK] Process completed successfully"));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("[ERROR] Group completed with 1 failed process(es)"));
  });

  it("continúa el grupo si no se puede crear la sesión de un proceso", async () => {
    const session = new FakeSession();
    let attempts = 0;
    const sessions: AutomationBrowserSessionFactory = {
      create: () => { attempts += 1; return attempts === 1 ? Promise.reject(new Error("navegador cerrado")) : Promise.resolve(session); }
    };
    const registry = new NodeRegistry().register(definition("navigate", () => Promise.resolve()));
    const first = createAutomationProcess("first", "Primero"); first.nodes.push(createAutomationNode("first-node", "navigate", { x: 0, y: 0 }));
    const second = createAutomationProcess("second", "Segundo"); second.nodes.push(createAutomationNode("second-node", "navigate", { x: 0, y: 0 }));
    const group = createAutomationGroup("group"); group.processes.push(first, second);
    const logger = recordingLogger();
    const coordinator = new AutomationExecutionCoordinator(new ProcessRunner(sessions, registry, generators, logger), { onProcess: () => undefined, onGroup: () => undefined }, logger);

    await coordinator.runGroup(group);

    expect(attempts).toBe(2);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Could not prepare the browser"), expect.any(Error));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("[Segundo] [OK]"));
  });

  it("publica los estados de pausa y reanudación", async () => {
    const session = new FakeSession(); const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) }; let release: (() => void) | undefined;
    const registry = new NodeRegistry().register(definition("navigate", () => new Promise<void>((resolve) => { release = resolve; })));
    const process = createAutomationProcess("process"); process.nodes.push(createAutomationNode("node", "navigate", { x: 0, y: 0 })); const group = createAutomationGroup("group"); group.processes.push(process); const states: string[] = [];
    const coordinator = new AutomationExecutionCoordinator(new ProcessRunner(sessions, registry, generators, silentLogger), { onProcess: (snapshot) => states.push(snapshot.state), onGroup: () => undefined });
    const running = coordinator.runProcess(group, process); await vi.waitFor(() => expect(release).toBeTypeOf("function")); coordinator.pause(); coordinator.resume(); release?.(); await running;
    expect(states).toContain("paused"); expect(states.at(-1)).toBe("success");
  });

  it("permite continuar Wait User desde el control inyectado en Chromium", async () => {
    const session = new FakeSession();
    const prompt = vi.spyOn(session, "showUserPrompt").mockResolvedValue("continue");
    const hide = vi.spyOn(session, "hideUserPrompt");
    const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const process = createAutomationProcess("process");
    const node = createAutomationNode("wait-user", "wait-user", { x: 0, y: 0 });
    node.config = { message: "Comprueba el navegador" }; process.nodes.push(node);
    const result = await new ProcessRunner(sessions, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);
    expect(result.success).toBe(true);
    expect(prompt).toHaveBeenCalledWith("Comprueba el navegador");
    expect(hide).toHaveBeenCalled();
  });

  it("cancela Wait User si el control del navegador desaparece", async () => {
    const session = new FakeSession();
    vi.spyOn(session, "showUserPrompt").mockResolvedValue("dismissed");
    const sessions: AutomationBrowserSessionFactory = { create: () => Promise.resolve(session) };
    const process = createAutomationProcess("process");
    const node = createAutomationNode("wait-user", "wait-user", { x: 0, y: 0 });
    node.config = { message: "Comprueba el navegador" }; process.nodes.push(node);

    const result = await new ProcessRunner(sessions, createDefaultNodeRegistry(), generators, silentLogger).run("group", process, new ExecutionControl(), () => undefined);

    expect(result.cancelled).toBe(true);
  });
});
