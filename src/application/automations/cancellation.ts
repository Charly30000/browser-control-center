import { t } from "../../localization";
export class ExecutionCancelledError extends Error {
  public constructor(message = t("text.executionCancelled")) { super(message); this.name = "ExecutionCancelledError"; }
}

export class ExecutionTimeoutError extends Error {
  public constructor(public readonly timeoutMs: number) { super(t("text.theNodeExceededTheArg0MsTimeout", { arg0: timeoutMs })); this.name = "ExecutionTimeoutError"; }
}

export class ExecutionControl {
  private readonly controller = new AbortController();
  private paused = false;
  private forced = false;
  private pauseResolvers: Array<() => void> = [];
  private readonly userResolvers = new Map<string, (action: "continue" | "retry") => void>();

  public get signal(): AbortSignal { return this.controller.signal; }
  public get isPaused(): boolean { return this.paused; }
  public get forceRequested(): boolean { return this.forced; }
  public pause(): void { this.paused = true; }
  public resume(): void { this.paused = false; for (const resolve of this.pauseResolvers.splice(0)) resolve(); }
  public stop(force = false): void { this.forced ||= force; this.controller.abort(); this.resume(); }
  public continueUser(nodeId: string): void { this.resolveUser(nodeId, "continue"); }
  public retryUser(nodeId: string): void { this.resolveUser(nodeId, "retry"); }

  public async waitIfPaused(): Promise<void> {
    this.throwIfCancelled();
    if (!this.paused) return;
    await this.raceCancellation(new Promise<void>((resolve) => this.pauseResolvers.push(resolve)));
  }

  public waitForUser(nodeId: string): Promise<"continue" | "retry"> {
    this.throwIfCancelled();
    return this.raceCancellation(new Promise((resolve) => this.userResolvers.set(nodeId, resolve)));
  }

  public throwIfCancelled(): void { if (this.signal.aborted) throw new ExecutionCancelledError(); }

  public raceCancellation<T>(operation: Promise<T>): Promise<T> {
    if (this.signal.aborted) return Promise.reject(new ExecutionCancelledError());
    return new Promise<T>((resolve, reject) => {
      const cancel = (): void => reject(new ExecutionCancelledError());
      this.signal.addEventListener("abort", cancel, { once: true });
      operation.then(resolve, reject).finally(() => this.signal.removeEventListener("abort", cancel)).catch(() => undefined);
    });
  }

  private resolveUser(nodeId: string, action: "continue" | "retry"): void {
    const resolve = this.userResolvers.get(nodeId);
    if (resolve !== undefined) { this.userResolvers.delete(nodeId); resolve(action); }
  }
}

export const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, control: ExecutionControl): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new ExecutionTimeoutError(timeoutMs)), timeoutMs); });
  try { return await control.raceCancellation(Promise.race([operation, timeout])); }
  finally { if (timer !== undefined) clearTimeout(timer); }
};
