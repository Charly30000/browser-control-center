export type NodeExecutionState = "idle" | "queued" | "running" | "success" | "failed" | "skipped" | "waiting-user" | "cancelled";
export type ProcessExecutionState = "idle" | "queued" | "running" | "paused" | "waiting-user" | "success" | "failed" | "cancelled";

export interface NodeExecutionSnapshot {
  readonly nodeId: string;
  readonly state: NodeExecutionState;
  readonly error: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface ProcessExecutionSnapshot {
  readonly processId: string;
  readonly state: ProcessExecutionState;
  readonly nodes: readonly NodeExecutionSnapshot[];
  readonly error: string | null;
}

export interface GroupExecutionSummary {
  readonly groupId: string;
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly runningProcessId: string | null;
  readonly stopped: boolean;
}
