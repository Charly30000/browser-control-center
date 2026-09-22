import type { PageDefinition } from "../../webviews/pages/pageDefinition";

export type SidebarToExtensionMessage =
  | { readonly type: "sidebar.ready" }
  | { readonly type: "sidebar.openPage"; readonly pageId: PageDefinition["id"] };

export type ExtensionToSidebarMessage = {
  readonly type: "sidebar.state";
  readonly browserStatus: "unconfigured";
};

export const isSidebarToExtensionMessage = (value: unknown): value is SidebarToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const record = value as Record<string, unknown>;
  return record.type === "sidebar.ready" ||
    (record.type === "sidebar.openPage" && ["manual", "formulas", "arrays", "automations"].includes(String(record.pageId)));
};
