import type * as vscode from "vscode";
import type { Logger } from "../../application/logging/logger";

export class BrowserAutomationLogger implements Logger, vscode.Disposable {
  public constructor(private readonly output: vscode.OutputChannel) {}
  public show(preserveFocus = true): void { this.output.show(preserveFocus); }
  public prepareForExecution(): void {
    this.output.clear();
    this.show();
  }
  public trace(message: string): void { this.write("trace", message); }
  public debug(message: string): void { this.write("debug", message); }
  public info(message: string): void { this.write("info", message); }
  public warn(message: string): void { this.write("warning", message); }
  public error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? `\n${error.stack ?? error.message}` : error === undefined ? "" : `\n${JSON.stringify(error) ?? "Error no serializable"}`;
    this.write("error", `${message}${detail}`);
  }
  public dispose(): void { this.output.dispose(); }

  private write(level: "trace" | "debug" | "info" | "warning" | "error", message: string): void {
    const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");
    this.output.appendLine(`${timestamp} [${level}] ${message}`);
  }
}
