import type { ArrayResource } from "../../domain/arrays/arrayResource";
import type { ResourceEditorState } from "../../domain/resources/globalResource";
import { isArrayResource } from "../../infrastructure/persistence/arrayResourceSerializer";

export type ArrayToExtensionMessage =
  | { readonly type: "array.ready" }
  | { readonly type: "array.new" }
  | { readonly type: "array.select"; readonly id: string }
  | { readonly type: "array.save"; readonly resource: ArrayResource }
  | { readonly type: "array.deleteSelected"; readonly ids: readonly string[] }
  | { readonly type: "array.import" }
  | { readonly type: "array.export"; readonly resource: ArrayResource };

export type ExtensionToArrayMessage =
  | { readonly type: "array.state"; readonly state: ResourceEditorState<ArrayResource> }
  | { readonly type: "array.notice"; readonly tone: "info" | "success" | "warning" | "error"; readonly message: string };

export const isArrayToExtensionMessage = (value: unknown): value is ArrayToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "array.ready":
    case "array.new":
    case "array.import":
      return true;
    case "array.select":
      return typeof message.id === "string";
    case "array.deleteSelected":
      return Array.isArray(message.ids) && message.ids.every((id) => typeof id === "string");
    case "array.save":
    case "array.export":
      return isArrayResource(message.resource);
    default:
      return false;
  }
};
