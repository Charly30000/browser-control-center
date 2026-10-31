import { t } from "../../localization";
import type { AutomationGroup, AutomationProcess } from "../../domain/automations/automation";
import type { GroupExecutionSummary, ProcessExecutionSnapshot } from "../../domain/automations/executionState";
import type { Logger } from "../logging/logger";
import { silentLogger } from "../logging/logger";
import { ExecutionControl } from "./cancellation";
import type { ProcessRunner } from "./processRunner";

export interface AutomationExecutionListener {
  onProcess(snapshot: ProcessExecutionSnapshot): void;
  onGroup(summary: GroupExecutionSummary): void;
}

interface ActiveExecution { readonly processId: string; readonly control: ExecutionControl; readonly completion: Promise<void>; lastSnapshot: ProcessExecutionSnapshot | null; }

export class AutomationExecutionCoordinator {
  private active: ActiveExecution | null = null;
  public constructor(private readonly runner: ProcessRunner, private readonly listener: AutomationExecutionListener, private readonly logger: Logger = silentLogger) {}
  public isRunning(): boolean { return this.active !== null; }

  public runProcess(group: AutomationGroup, process: AutomationProcess): Promise<void> {
    if (this.active !== null) throw new Error(t("text.anAutomationIsAlreadyRunning"));
    const control = new ExecutionControl();
    const completion = this.runner.run(group.name, process, control, (snapshot) => this.forwardSnapshot(snapshot)).then(() => undefined).finally(() => { this.active = null; });
    this.active = { processId: process.id, control, completion, lastSnapshot: null };
    return completion;
  }

  public runGroup(group: AutomationGroup): Promise<void> {
    if (this.active !== null) throw new Error(t("text.anAutomationIsAlreadyRunning"));
    const control = new ExecutionControl();
    const completion = this.performGroup(group, control).finally(() => { this.active = null; });
    this.active = { processId: group.processes[0]?.id ?? "", control, completion, lastSnapshot: null };
    return completion;
  }

  public pause(): void {
    const active = this.requireActive(); active.control.pause();
    if (active.lastSnapshot !== null && active.lastSnapshot.state === "running") { active.lastSnapshot = { ...active.lastSnapshot, state: "paused" }; this.listener.onProcess(active.lastSnapshot); }
  }
  public resume(): void {
    const active = this.requireActive(); active.control.resume();
    if (active.lastSnapshot !== null && active.lastSnapshot.state === "paused") { active.lastSnapshot = { ...active.lastSnapshot, state: "running" }; this.listener.onProcess(active.lastSnapshot); }
  }
  public stop(): void { this.requireActive().control.stop(false); }
  public forceStop(): void { this.requireActive().control.stop(true); }
  public continueUser(nodeId: string): void { this.requireActive().control.continueUser(nodeId); }
  public retryUser(nodeId: string): void { this.requireActive().control.retryUser(nodeId); }

  private async performGroup(group: AutomationGroup, control: ExecutionControl): Promise<void> {
    let completed = 0; let failed = 0;
    const startedAt = Date.now();
    const prefix = `[${group.name}]`;
    const summary = (runningProcessId: string | null, stopped: boolean): GroupExecutionSummary => ({ groupId: group.id, total: group.processes.length, completed, failed, runningProcessId, stopped });
    this.logger.info(t("text.arg0STARTGroupStartedArg1Processes", { arg0: prefix, arg1: group.processes.length }));
    this.listener.onGroup(summary(null, false));
    try {
      for (const process of group.processes) {
        if (control.signal.aborted) break;
        this.listener.onGroup(summary(process.id, false));
        const result = await this.runner.run(group.name, process, control, (snapshot) => this.forwardSnapshot(snapshot));
        completed += 1; if (!result.success) failed += 1;
        this.listener.onGroup(summary(null, false));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("text.groupExecutionFailed");
      this.logger.error(t("text.arg0ERRORGroupInterruptedArg1", { arg0: prefix, arg1: message }), error);
      throw error;
    }
    this.listener.onGroup(summary(null, control.signal.aborted));
    const elapsed = Date.now() - startedAt;
    const duration = elapsed < 1_000 ? `${elapsed} ms` : `${(elapsed / 1_000).toFixed(2)} s`;
    if (control.signal.aborted) this.logger.warn(t("text.arg0CANCELLEDGroupStoppedAfterArg1Arg2ProcessesArg3", { arg0: prefix, arg1: completed, arg2: group.processes.length, arg3: duration }));
    else if (failed > 0) this.logger.error(t("text.arg0ERRORGroupCompletedWithArg1FailedProcessEsOutOfArg2Arg3", { arg0: prefix, arg1: failed, arg2: completed, arg3: duration }));
    else this.logger.info(t("text.arg0OKGroupCompletedSuccessfullyArg1Arg2ProcessesArg3", { arg0: prefix, arg1: completed, arg2: group.processes.length, arg3: duration }));
  }

  private requireActive(): ActiveExecution {
    if (this.active === null) throw new Error(t("text.noAutomationIsRunning"));
    return this.active;
  }

  private forwardSnapshot(snapshot: ProcessExecutionSnapshot): void {
    if (this.active !== null) this.active.lastSnapshot = snapshot;
    this.listener.onProcess(snapshot);
  }
}
