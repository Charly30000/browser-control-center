import type { BrowserLifecycleState } from "../domain/browser/browserBridge";
import type { NodeExecutionState, ProcessExecutionState } from "../domain/automations/executionState";
import type { ViewportPresetId } from "../domain/manual/manualProfile";
import type { DataAssertionOperator } from "../domain/automations/dataAssertion";
import { t, type TranslationKey } from "./index";

const lifecycleKeys: Record<BrowserLifecycleState, TranslationKey> = {
  stopped: "states.stopped", starting: "states.starting", running: "states.running",
  stopping: "states.stopping", crashed: "states.crashed"
};
const executionKeys: Record<NodeExecutionState | ProcessExecutionState, TranslationKey> = {
  idle: "states.idle", queued: "states.queued", running: "states.running", paused: "states.paused",
  "waiting-user": "states.waitingUser", success: "states.success", failed: "states.failed",
  skipped: "states.skipped", cancelled: "states.cancelled"
};
const viewportKeys: Record<ViewportPresetId, TranslationKey> = {
  desktop: "text.desktop19201080", laptop: "text.laptop1366768", tabletPortrait: "text.tabletPortrait",
  tabletLandscape: "text.tabletLandscape", mobilePortrait: "text.mobilePortrait",
  mobileLandscape: "text.mobileLandscape", custom: "text.custom"
};
const nodeOptionKeys: Readonly<Record<string, TranslationKey>> = {
  fixed: "nodeOptions.fixed", random: "nodeOptions.random", element: "nodeOptions.element",
  url: "nodeOptions.url", navigation: "nodeOptions.navigation", response: "nodeOptions.response",
  exists: "nodeOptions.exists", visible: "nodeOptions.visible", "text-equals": "nodeOptions.textEquals",
  "value-equals": "nodeOptions.valueEquals", "url-equals": "nodeOptions.urlEquals", "response-status": "nodeOptions.responseStatus",
  "not-exists": "nodeOptions.notExists", "not-visible": "nodeOptions.notVisible",
  "text-not-equals": "nodeOptions.textNotEquals", "text-contains": "nodeOptions.textContains", "text-not-contains": "nodeOptions.textNotContains",
  "value-not-equals": "nodeOptions.valueNotEquals", "value-contains": "nodeOptions.valueContains", "value-not-contains": "nodeOptions.valueNotContains",
  "url-not-equals": "nodeOptions.urlNotEquals", "url-contains": "nodeOptions.urlContains", "url-not-contains": "nodeOptions.urlNotContains",
  "response-status-not-equals": "nodeOptions.responseStatusNotEquals"
};

const dataOperatorKeys: Readonly<Record<DataAssertionOperator, TranslationKey>> = {
  exists: "text.exists", "not-exists": "text.doesNotExist", equals: "text.equals", "not-equals": "text.doesNotEqual",
  contains: "text.contains", "not-contains": "validation.notContains", matches: "text.matchesRegex", "not-matches": "validation.notMatches",
  "json-equals": "text.equivalentJSON", "json-not-equals": "validation.jsonNotEquals"
};
export const dataAssertionOperatorLabel = (operator: DataAssertionOperator): string => t(dataOperatorKeys[operator]);

export const browserLifecycleLabel = (state: BrowserLifecycleState): string => t(lifecycleKeys[state]);
export const executionStateLabel = (state: NodeExecutionState | ProcessExecutionState): string => t(executionKeys[state]);
export const viewportPresetLabel = (preset: ViewportPresetId): string => t(viewportKeys[preset]);
export const nodeOptionLabel = (value: string): string => {
  const key = nodeOptionKeys[value];
  return key === undefined ? value : t(key);
};
