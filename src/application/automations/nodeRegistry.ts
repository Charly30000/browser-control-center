import { t } from "../../localization";
import type { AutomationNodeConfig, AutomationNodeType } from "../../domain/automations/automation";
import type { Result } from "../../shared/result";
import type { ExecutionContext } from "./executionContext";
import type { JsonValue } from "../../domain/manual/storageValue";

export interface InspectorField {
  readonly key: string;
  readonly label: string;
  readonly kind: "text" | "number" | "select" | "textarea" | "json" | "checkbox" | "resource" | "name-list";
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly visibleWhen?: { readonly key: string; readonly values: readonly string[] };
}

export interface NodeDefinition {
  readonly type: AutomationNodeType;
  readonly title: string;
  readonly category: string;
  readonly defaultTimeoutMs: number;
  readonly inspectorFields: readonly InspectorField[];
  readonly availableInPalette?: boolean;
  validate(config: unknown): Result<AutomationNodeConfig>;
  execute(context: ExecutionContext, config: AutomationNodeConfig, nodeId: string, timeoutMs: number): Promise<void | JsonValue>;
}

export interface NodeDescriptor {
  readonly type: AutomationNodeType;
  readonly title: string;
  readonly category: string;
  readonly defaultTimeoutMs: number;
  readonly inspectorFields: readonly InspectorField[];
  readonly availableInPalette: boolean;
}

export class NodeRegistry {
  private readonly definitions = new Map<AutomationNodeType, NodeDefinition>();
  public register(definition: NodeDefinition): this {
    if (this.definitions.has(definition.type)) throw new Error(t("text.nodeArg0IsAlreadyRegistered", { arg0: definition.type }));
    this.definitions.set(definition.type, definition); return this;
  }
  public get(type: AutomationNodeType): NodeDefinition {
    const definition = this.definitions.get(type);
    if (definition === undefined) throw new Error(t("text.nodeTypeArg0IsNotRegistered", { arg0: type }));
    return definition;
  }
  public has(type: string): boolean { return this.definitions.has(type as AutomationNodeType); }
  public validate(type: string, config: unknown): Result<AutomationNodeConfig> { return this.get(type as AutomationNodeType).validate(config); }
  public descriptors(): readonly NodeDescriptor[] { return [...this.definitions.values()].map(({ type, title, category, defaultTimeoutMs, inspectorFields, availableInPalette }) => ({ type, title, category, defaultTimeoutMs, inspectorFields, availableInPalette: availableInPalette !== false })); }
}
