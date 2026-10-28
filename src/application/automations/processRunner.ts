import type { Logger } from "../logging/logger";
import type { GeneratorValueResolver } from "../manual/generatorValueResolver";
import type { AutomationProcess } from "../../domain/automations/automation";
import type { NodeExecutionSnapshot, NodeExecutionState, ProcessExecutionSnapshot, ProcessExecutionState } from "../../domain/automations/executionState";
import { predecessorIds, topologicalOrder } from "../../domain/automations/graph";
import type { AutomationBrowserSession, AutomationBrowserSessionFactory } from "./automationBrowserSession";
import { ExecutionCancelledError, ExecutionTimeoutError, withTimeout } from "./cancellation";
import type { ExecutionControl } from "./cancellation";
import { ExecutionContext } from "./executionContext";
import type { NodeRegistry } from "./nodeRegistry";
import { VariableStore } from "../../domain/automations/variables";

export interface ProcessRunResult { readonly success: boolean; readonly cancelled: boolean; readonly variables: ExecutionContext["variables"]; }
export type ProcessStateListener = (snapshot: ProcessExecutionSnapshot) => void;

export class ProcessRunner {
  public constructor(
    private readonly sessions: AutomationBrowserSessionFactory,
    private readonly registry: NodeRegistry,
    private readonly generators: GeneratorValueResolver,
    private readonly logger: Logger
  ) {}

  public async run(groupName: string, process: AutomationProcess, control: ExecutionControl, listener: ProcessStateListener): Promise<ProcessRunResult> {
    const processStartedAt = Date.now();
    const processPrefix = `[${groupName}] [${process.name}]`;
    const viewport = process.viewport;
    this.logger.info(`${processPrefix} [INICIO] Proceso iniciado (${process.nodes.length} nodos; viewport ${viewport.width}×${viewport.height}; escala ${viewport.deviceScaleFactor}; móvil: ${viewport.isMobile ? "sí" : "no"}; táctil: ${viewport.hasTouch ? "sí" : "no"}).`);
    const graph = topologicalOrder(process.nodes, process.edges);
    if (!graph.ok) {
      this.logger.error(`${processPrefix} [ERROR] El flujo no es ejecutable: ${graph.error}`);
      throw new Error(graph.error);
    }
    const states = new Map(process.nodes.map((node) => [node.id, this.nodeState(node.id, "queued")]));
    let processState: ProcessExecutionState = "queued";
    let processError: string | null = null;
    const emit = (): void => listener({ processId: process.id, state: processState, nodes: process.nodes.map((node) => states.get(node.id) ?? this.nodeState(node.id, "idle")), error: processError });
    emit();
    let browser: AutomationBrowserSession;
    try {
      browser = await this.sessions.create(process.viewport);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar la sesión de navegador.";
      processState = "failed"; processError = message;
      for (const [id, state] of states) if (state.state === "queued") states.set(id, this.nodeState(id, "skipped"));
      emit();
      this.logger.error(`${processPrefix} [ERROR] No se pudo preparar el navegador: ${message}`, error);
      return { success: false, cancelled: false, variables: new VariableStore(process.variables) };
    }
    const context = new ExecutionContext({
      groupName, processName: process.name, browser, generators: this.generators, variables: process.variables, control, logger: this.logger,
      onWaitingUser: (nodeId, waiting) => {
        const current = states.get(nodeId); if (current !== undefined) states.set(nodeId, { ...current, state: waiting ? "waiting-user" : "running" });
        processState = waiting ? "waiting-user" : "running"; emit();
      }
    });
    processState = "running"; emit();
    let forceClose = false;
    try {
      for (const [index, node] of graph.value.entries()) {
        await control.waitIfPaused();
        const failedPredecessor = predecessorIds(node.id, process.edges).some((id) => {
          const state = states.get(id)?.state; return state === "failed" || state === "cancelled" || state === "skipped";
        });
        if (failedPredecessor) {
          states.set(node.id, this.nodeState(node.id, "skipped"));
          this.logger.warn(`${processPrefix} [Nodo ${index + 1}/${graph.value.length}] [OMITIDO] Depende de un nodo que no terminó correctamente.`);
          emit(); continue;
        }
        const definition = this.registry.get(node.type);
        const nodeLabel = `Nodo ${index + 1}/${graph.value.length} · ${definition.title}`;
        const validated = definition.validate(node.config);
        if (!validated.ok) {
          context.error(nodeLabel, `[ERROR] Configuración no válida: ${validated.error}`);
          states.set(node.id, this.nodeState(node.id, "failed", validated.error)); processState = "failed"; processError = validated.error; emit(); break;
        }
        states.set(node.id, { nodeId: node.id, state: "running", error: null, startedAt: new Date().toISOString(), finishedAt: null }); emit();
        const timeoutMs = node.timeoutMs ?? definition.defaultTimeoutMs;
        const nodeStartedAt = Date.now();
        try {
          context.info(nodeLabel, `[INICIO] Ejecutando (timeout: ${timeoutMs} ms).`);
          await withTimeout(definition.execute(context, validated.value, node.id, timeoutMs), timeoutMs, control);
          const running = states.get(node.id); states.set(node.id, { ...(running ?? this.nodeState(node.id, "running")), state: "success", finishedAt: new Date().toISOString() });
          context.info(nodeLabel, `[OK] Completado en ${this.elapsed(nodeStartedAt)}.`); emit();
        } catch (error: unknown) {
          if (error instanceof ExecutionCancelledError) {
            states.set(node.id, this.nodeState(node.id, "cancelled", error.message)); processState = "cancelled"; processError = error.message;
          } else {
            const message = error instanceof Error ? error.message : "El nodo ha fallado.";
            states.set(node.id, this.nodeState(node.id, "failed", message)); processState = "failed"; processError = message;
            forceClose = error instanceof ExecutionTimeoutError;
            context.error(nodeLabel, `[ERROR] ${message}`, error);
          }
          emit(); break;
        }
      }
      if (processState === "running") processState = [...states.values()].some(({ state }) => state === "failed") ? "failed" : "success";
      if (processState === "cancelled") {
        for (const [id, state] of states) if (state.state === "queued") states.set(id, this.nodeState(id, "cancelled", "Ejecución cancelada."));
      } else if (processState === "failed") {
        for (const [id, state] of states) if (state.state === "queued") states.set(id, this.nodeState(id, "skipped"));
      }
      emit();
      if (processState === "success") this.logger.info(`${processPrefix} [OK] Proceso completado correctamente en ${this.elapsed(processStartedAt)}.`);
      else if (processState === "cancelled") this.logger.warn(`${processPrefix} [CANCELADO] ${processError ?? "Ejecución cancelada."}`);
      else this.logger.error(`${processPrefix} [ERROR] Proceso finalizado con errores: ${processError ?? "Error desconocido."}`);
      return { success: processState === "success", cancelled: processState === "cancelled", variables: context.variables };
    } catch (error: unknown) {
      if (!(error instanceof ExecutionCancelledError)) throw error;
      processState = "cancelled"; processError = error.message;
      for (const [id, state] of states) if (state.state === "queued" || state.state === "running" || state.state === "waiting-user") states.set(id, this.nodeState(id, "cancelled", error.message));
      emit();
      this.logger.warn(`${processPrefix} [CANCELADO] ${error.message}`);
      return { success: false, cancelled: true, variables: context.variables };
    } finally {
      await browser.close(forceClose || control.forceRequested).catch((error: unknown) => this.logger.error(`[${groupName}] [${process.name}] Error al cerrar el navegador.`, error));
    }
  }

  private nodeState(nodeId: string, state: NodeExecutionState, error: string | null = null): NodeExecutionSnapshot {
    return { nodeId, state, error, startedAt: null, finishedAt: state === "success" || state === "failed" || state === "skipped" || state === "cancelled" ? new Date().toISOString() : null };
  }

  private elapsed(startedAt: number): string {
    const milliseconds = Date.now() - startedAt;
    return milliseconds < 1_000 ? `${milliseconds} ms` : `${(milliseconds / 1_000).toFixed(2)} s`;
  }
}
