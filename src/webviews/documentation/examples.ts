import { t, getLocale } from "../../localization";
import { escapeHtml } from "../../shared/htmlText";
import { createArrayResource } from "../../domain/arrays/arrayResource";
import { createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationNodeConfig, type AutomationNodeType } from "../../domain/automations/automation";
import { createFormula } from "../../domain/formulas/formula";
import { createImportExportDocument } from "../../domain/importExport/importExportDocument";
import { createManualProfileBundle } from "../../domain/importExport/manualProfileBundle";
import { createEmptyManualProfile, createGeneratorBinding, createRequestOverride } from "../../domain/manual/manualProfile";

const timestamp = "2026-01-01T00:00:00.000Z";
const exampleUrl = "https://example.test/form";
const exampleHtml = `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8"><title>${escapeHtml(t("examples.formTitle"))}</title></head><body><h1>${escapeHtml(t("examples.formTitle"))}</h1><label>${escapeHtml(t("examples.name"))} <input id="name"></label><label>${escapeHtml(t("examples.copy"))} <input id="copy"></label><label>${escapeHtml(t("text.email"))} <input id="email"></label><label>${escapeHtml(t("examples.city"))} <input id="city"></label><p id="result">${escapeHtml(t("examples.ready"))}</p><pre id="payload">{"item":{"id":42}}</pre><button id="apply" type="button">${escapeHtml(t("text.continue"))}</button></body></html>`;

export const documentationFormula = { ...createFormula("formula-example", t("text.testEmail"), timestamp), preferences: { autoSaveEnabled: true }, code: t("defaults.documentationFormulaCode") };
export const documentationArray = { ...createArrayResource("array-example", t("text.testCities"), timestamp), preferences: { autoSaveEnabled: true }, items: [t("text.madrid"), t("text.sevilla"), t("text.valencia")] };
const pageOverride = { ...createRequestOverride("override-page"), matcherType: "glob" as const, matcher: `${exampleUrl}*`, contentType: "text/html; charset=utf-8", body: exampleHtml, headers: [] };
const profile = createEmptyManualProfile("manual-example", t("text.localTestForm"), timestamp);
profile.url = exampleUrl;
profile.preferences = { autoSaveEnabled: true };
profile.requestOverrides = [pageOverride];
profile.generatorBindings = [
  { ...createGeneratorBinding("binding-name"), selector: "#name", literalValue: t("text.ada"), expanded: true },
  { ...createGeneratorBinding("binding-email"), selector: "#email", generatorType: "formula", resourceId: documentationFormula.id },
  { ...createGeneratorBinding("binding-city"), selector: "#city", generatorType: "array", resourceId: documentationArray.id }
];
export const manualDocumentationExample = createImportExportDocument("browser-control-center/manual-profile", createManualProfileBundle(profile, { formulas: [documentationFormula], arrays: [documentationArray] }), timestamp);
export const formulaDocumentationExample = createImportExportDocument("browser-control-center/formulas", [documentationFormula], timestamp);
export const arrayDocumentationExample = createImportExportDocument("browser-control-center/arrays", [documentationArray], timestamp);

export interface DocumentedNode {
  readonly type: AutomationNodeType;
  readonly usage: string;
  readonly config: AutomationNodeConfig;
}

const documentedNode = (type: AutomationNodeType, usage: string, overrides: AutomationNodeConfig = {}): DocumentedNode => ({
  type, usage, config: { ...createAutomationNode("reference", type, { x: 0, y: 0 }).config, ...overrides }
});

export const documentedNodes: readonly DocumentedNode[] = [
  documentedNode("navigate", t("text.navigateOpensAURLBuiltFromTheEnabledQueryParamsRowsTheQueryStringInTheBaseURL"), { url: exampleUrl }),
  documentedNode("click", t("text.clickClicksTheFirstElementMatchingTheCSSSelector"), { selector: "#apply" }),
  documentedNode("fill", t("text.fieldEntersFixedTextOrAGeneratedValueIntoAnInputTextareaGeneratorTypeStringFirstNameLastNameEmail"), { selector: "#name", value: t("text.ada") }),
  documentedNode("generate-value", t("text.generateValueASupportedLegacyNodeHiddenFromThePaletteGeneratesAndStoresOutputVariableForNewFlows"), { outputVariable: "generatedName" }),
  documentedNode("set-headers", t("text.setHeadersSetsContextHeadersForSubsequentRequestsEntriesContainsHeaderRowsAnEmptyListClearsThem")),
  documentedNode("set-cookies", t("text.setCookiesAddsEnabledCookiesDomainHasNoProtocolIfItIsEmptyNavigateFirstToProvide")),
  documentedNode("set-storage", t("text.setStorageWritesEntriesToLocalStorageScopeLocalOrSessionStorageScopeSessionOnTheCurrentPageNavigate")),
  documentedNode("remove-headers", t("sessionRemoval.headersUsage"), { mode: "selected", names: "x-test-token\nx-test-user" }),
  documentedNode("remove-cookies", t("sessionRemoval.cookiesUsage"), { mode: "selected", names: "test-session\ntest-preference", domain: "example.test", path: "/" }),
  documentedNode("remove-storage", t("sessionRemoval.storageUsage"), { scope: "local", mode: "selected", names: "test-token\ntest-user" }),
  documentedNode("request-override", t("text.requestOverrideInstallsTheRulesInEntriesBeforeTheActionThatTriggersTheRequestEachExecutionOf"), { entries: [pageOverride] }),
  documentedNode("wait", t("text.waitKindFixedDurationMsRandomDurationMsToMaxDurationMsElementVisibleSelectorUrlAPlaywrightURLPatternNavigation")),
  documentedNode("assertion", t("text.assertionKindExistsVisibleTextEqualsValueEqualsUrlEqualsOrResponseStatusExpectedIsAlwaysText"), { kind: "value-equals", selector: "#name", expected: t("text.ada") }),
  documentedNode("validate-data", t("text.validateDataReadsRequestResponseCookieLocalStorageOrSessionStorageNetworkUrlPatternFiltersBySubstringAndUsesThe"), { source: "response", urlPattern: "/api/", pathPreset: "custom", path: "body.item.id", operator: "equals", expected: "42" }),
  documentedNode("extract-value", t("text.extractValueReadsValueTextContentInnerTextOrAttributeFromTheDOMAndStoresOutputVariableForAttributeSpecify"), { selector: "#name", property: "value", outputVariable: "nameFromPage" }),
  documentedNode("set-variable", t("text.setVariableStoresValueInNameValueCanBeAnyJSONValueEnterTheNameWithoutBraces"), { name: "greeting", value: t("text.hello") }),
  documentedNode("capture-value", t("text.saveDataSourcePreviousReadsTheOutputOfTheSingleConnectedPredecessorSourceDomReadsSelectorAnd"), { source: "dom", selector: "#payload", property: "textContent", path: "item.id", valueType: "number", outputVariable: "itemId" }),
  documentedNode("wait-user", t("text.pauseWaitUserDisplaysMessageAndWaitsForManualInteractionWithContinueRetryOrStopUsefulFor"), { message: t("text.completeTheSignInAndClickContinue") })
];

const automation = createAutomationDocument("automation-example", timestamp);
automation.name = t("text.copyDataFromTheDOM");
automation.preferences = { autoSaveEnabled: true };
const group = createAutomationGroup("group-example", t("text.offlineExample"));
const process = createAutomationProcess("process-example", t("text.captureAndReuseData"));
const addNode = (type: AutomationNodeType, config: AutomationNodeConfig): void => {
  const index = process.nodes.length;
  const node = createAutomationNode(`node-${index + 1}`, type, { x: 80 + (index % 4) * 260, y: 80 + Math.floor(index / 4) * 150 });
  node.config = { ...node.config, ...config };
  process.nodes.push(node);
};
addNode("request-override", { entries: [pageOverride] });
addNode("navigate", { url: exampleUrl });
addNode("fill", { selector: "#name", value: t("text.ada") });
addNode("capture-value", { source: "dom", selector: "#name", property: "value", valueType: "string", outputVariable: "savedName" });
addNode("fill", { selector: "#copy", value: "{savedName}" });
addNode("assertion", { kind: "value-equals", selector: "#copy", expected: t("text.ada") });
addNode("capture-value", { source: "dom", selector: "#payload", property: "textContent", path: "item.id", valueType: "number", outputVariable: "itemId" });
addNode("fill", { selector: "#copy", value: t("text.idItemId") });
addNode("assertion", { kind: "value-equals", selector: "#copy", expected: t("text.id42") });
process.edges = process.nodes.slice(1).map((node, index) => ({ id: `edge-${index + 1}`, sourceNodeId: process.nodes[index]!.id, sourcePort: "out", targetNodeId: node.id, targetPort: "in" }));
group.processes = [process];
group.expanded = true;
automation.groups = [group];
export const automationDocumentationExample = createImportExportDocument("browser-control-center/automations", automation, timestamp);
