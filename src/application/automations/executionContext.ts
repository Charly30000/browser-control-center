import type { Logger } from "../logging/logger";
import type { GeneratorValueResolver } from "../manual/generatorValueResolver";
import type { JsonValue } from "../../domain/manual/storageValue";
import type { AutomationBrowserSession } from "./automationBrowserSession";
import type { ExecutionControl } from "./cancellation";
import { VariableStore } from "../../domain/automations/variables";

export interface ExecutionContextOptions {
  readonly groupName: string;
  readonly processName: string;
  readonly browser: AutomationBrowserSession;
  readonly generators: GeneratorValueResolver;
  readonly variables: Readonly<Record<string, JsonValue>>;
  readonly control: ExecutionControl;
  readonly logger: Logger;
  readonly onWaitingUser: (nodeId: string, waiting: boolean) => void;
}

export class ExecutionContext {
  public readonly variables: VariableStore;
  public readonly browser: AutomationBrowserSession;
  public readonly generators: GeneratorValueResolver;
  public readonly control: ExecutionControl;
  private readonly prefix: string;

  public constructor(private readonly options: ExecutionContextOptions) {
    this.variables = new VariableStore(options.variables);
    this.browser = options.browser;
    this.generators = options.generators;
    this.control = options.control;
    this.prefix = `[${options.groupName}] [${options.processName}]`;
  }

  public resolveConfig(config: Readonly<Record<string, JsonValue>>): Record<string, JsonValue> {
    const resolved = this.variables.resolve(config);
    if (!resolved.ok || resolved.value === null || Array.isArray(resolved.value) || typeof resolved.value !== "object") throw new Error(resolved.ok ? "La configuración resuelta no es un objeto." : resolved.error);
    return { ...resolved.value };
  }

  public async waitForUser(nodeId: string, message: string): Promise<"continue" | "retry"> {
    this.options.onWaitingUser(nodeId, true);
    const controlAction = this.control.waitForUser(nodeId);
    void this.browser.showUserPrompt(message).then((action) => {
      if (action === "continue") this.control.continueUser(nodeId);
      else if (action === "retry") this.control.retryUser(nodeId);
      else if (action === "stop") this.control.stop(false);
      else this.control.stop(false);
    }).catch((error: unknown) => this.info("Pause / Wait User", `No se pudo mostrar el control en el navegador: ${error instanceof Error ? error.message : String(error)}`));
    try { return await controlAction; }
    finally { await this.browser.hideUserPrompt().catch(() => undefined); this.options.onWaitingUser(nodeId, false); }
  }

  public info(nodeName: string, message: string): void { this.options.logger.info(`${this.prefix} [${nodeName}] ${message}`); }
  public warn(nodeName: string, message: string): void { this.options.logger.warn(`${this.prefix} [${nodeName}] ${message}`); }
  public error(nodeName: string, message: string, error?: unknown): void { this.options.logger.error(`${this.prefix} [${nodeName}] ${message}`, error); }
}
