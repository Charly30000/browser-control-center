import { t } from "../../localization";
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
    this.logger.info(t("text.arg0STARTProcessStartedArg1NodesViewportArg2Arg3ScaleArg4MobileArg5TouchArg6", { arg0: processPrefix, arg1: process.nodes.length, arg2: viewport.width, arg3: viewport.height, arg4: viewport.deviceScaleFactor, arg5: viewport.isMobile ? t("text.yes") : t("labels.no"), arg6: viewport.hasTouch ? t("text.yes") : t("labels.no") }));
    const graph = topologicalOrder(process.nodes, process.edges);
    if (!graph.ok) {
      this.logger.error(t("text.arg0ERRORTheFlowCannotBeRunArg1", { arg0: processPrefix, arg1: graph.error }));
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
      const message = error instanceof Error ? error.message : t("text.couldNotStartTheBrowserSession");
      processState = "failed"; processError = message;
      for (const [id, state] of states) if (state.state === "queued") states.set(id, this.nodeState(id, "skipped"));
      emit();
      this.logger.error(t("text.arg0ERRORCouldNotPrepareTheBrowserArg1", { arg0: processPrefix, arg1: message }), error);
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
          this.logger.warn(t("text.arg0NodeArg1Arg2SKIPPEDDependsOnANodeThatDidNotCompleteSuccessfully", { arg0: processPrefix, arg1: index + 1, arg2: graph.value.length }));
          emit(); continue;
        }
        const definition = this.registry.get(node.type);
        const nodeLabel = t("text.nodeArg0Arg1Arg2", { arg0: index + 1, arg1: graph.value.length, arg2: definition.title });
        const validated = definition.validate(node.config);
        if (!validated.ok) {
          context.error(nodeLabel, t("text.errorInvalidConfigurationArg0", { arg0: validated.error }));
          states.set(node.id, this.nodeState(node.id, "failed", validated.error)); processState = "failed"; processError = validated.error; emit(); break;
        }
        states.set(node.id, { nodeId: node.id, state: "running", error: null, startedAt: new Date().toISOString(), finishedAt: null }); emit();
        const timeoutMs = node.timeoutMs ?? definition.defaultTimeoutMs;
        const nodeStartedAt = Date.now();
        try {
          context.info(nodeLabel, t("logs.nodeStart", { timeout: timeoutMs }));
          context.setInputNodes(predecessorIds(node.id, process.edges));
          const output = await withTimeout(definition.execute(context, validated.value, node.id, timeoutMs), timeoutMs, control);
          context.recordOutput(node.id, output);
          const running = states.get(node.id); states.set(node.id, { ...(running ?? this.nodeState(node.id, "running")), state: "success", finishedAt: new Date().toISOString() });
          context.info(nodeLabel, t("logs.nodeCompleted", { duration: this.elapsed(nodeStartedAt) })); emit();
        } catch (error: unknown) {
          if (error instanceof ExecutionCancelledError) {
            states.set(node.id, this.nodeState(node.id, "cancelled", error.message)); processState = "cancelled"; processError = error.message;
          } else {
            const message = error instanceof Error ? error.message : t("text.theNodeFailed");
            states.set(node.id, this.nodeState(node.id, "failed", message)); processState = "failed"; processError = message;
            forceClose = error instanceof ExecutionTimeoutError;
            context.error(nodeLabel, t("logs.nodeError", { message }), error);
          }
          emit(); break;
        }
      }
      if (processState === "running") processState = [...states.values()].some(({ state }) => state === "failed") ? "failed" : "success";
      if (processState === "cancelled") {
        for (const [id, state] of states) if (state.state === "queued") states.set(id, this.nodeState(id, "cancelled", t("text.executionCancelled")));
      } else if (processState === "failed") {
        for (const [id, state] of states) if (state.state === "queued") states.set(id, this.nodeState(id, "skipped"));
      }
      emit();
      if (processState === "success") this.logger.info(t("text.arg0OKProcessCompletedSuccessfullyInArg1", { arg0: processPrefix, arg1: this.elapsed(processStartedAt) }));
      else if (processState === "cancelled") this.logger.warn(t("logs.cancelled", { prefix: processPrefix, message: processError ?? t("text.executionCancelled") }));
      else this.logger.error(t("text.arg0ERRORProcessFinishedWithErrorsArg1", { arg0: processPrefix, arg1: processError ?? t("text.unknownError") }));
      return { success: processState === "success", cancelled: processState === "cancelled", variables: context.variables };
    } catch (error: unknown) {
      if (!(error instanceof ExecutionCancelledError)) throw error;
      processState = "cancelled"; processError = error.message;
      for (const [id, state] of states) if (state.state === "queued" || state.state === "running" || state.state === "waiting-user") states.set(id, this.nodeState(id, "cancelled", error.message));
      emit();
      this.logger.warn(t("logs.cancelled", { prefix: processPrefix, message: error.message }));
      return { success: false, cancelled: true, variables: context.variables };
    } finally {
      await browser.close(forceClose || control.forceRequested).catch((error: unknown) => this.logger.error(t("text.arg0Arg1ErrorClosingTheBrowser", { arg0: groupName, arg1: process.name }), error));
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
