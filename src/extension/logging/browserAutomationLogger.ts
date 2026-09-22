import type * as vscode from "vscode";
import type { Logger } from "../../application/logging/logger";

export class BrowserAutomationLogger implements Logger, vscode.Disposable {
  public constructor(private readonly output: vscode.LogOutputChannel) {}
  public trace(message: string): void { this.output.trace(message); }
  public debug(message: string): void { this.output.debug(message); }
  public info(message: string): void { this.output.info(message); }
  public warn(message: string): void { this.output.warn(message); }
  public error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? `\n${error.stack ?? error.message}` : error === undefined ? "" : `\n${JSON.stringify(error) ?? "Error no serializable"}`;
    this.output.error(`${message}${detail}`);
  }
  public dispose(): void { this.output.dispose(); }
}
