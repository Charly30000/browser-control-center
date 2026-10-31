import { t, type TranslationKey } from "../../../../localization";
import { html, type TemplateResult } from "lit";

const steps: readonly { readonly node: string; readonly explanation: string }[] = [
  { node: t("text.viewport"), explanation: t("text.configuresA390844ViewportWithTouchAndMobileModeThePageItselfDisplaysAndValidatesIts") },
  { node: t("text.initialVariables"), explanation: t("text.definesInitialNameAndExpectedGreetingBeforeExecutionThenInterpolatesThemInFieldAndAssertionUsingName") },
  { node: t("text.requestOverride"), explanation: t("text.servesTheHTMLPageAndTheAPIJSONResponseFromTheAutomationItself") },
  { node: t("text.setHeaders"), explanation: t("text.addsXExampleHeaderToRequestsValidateDataChecksItsValueLater") },
  { node: t("text.setCookies"), explanation: t("text.createsExampleCookieForTheVirtualDomainBeforeNavigation") },
  { node: t("text.navigate"), explanation: t("text.opensHttpsBrowserControlTestDemoNoRealDownloadOccursBecauseTheOverrideRespondsFirst") },
  { node: t("text.setStorage"), explanation: t("text.storesAJSONObjectInLocalStorageAndTextInSessionStorage") },
  { node: t("text.fieldWithText"), explanation: t("text.entersTheTextAdaDirectlyIntoName") },
  { node: t("text.fieldWithGenerator"), explanation: t("text.generatesANameAndEntersItDirectlyIntoNameFromTheSameNode") },
  { node: t("text.click"), explanation: t("text.clicksThePageButtonUpdatesTheDOMAndTriggersTheExamplePOSTRequest") },
  { node: t("text.wait"), explanation: t("text.waitsForTheAPIResponseThenAllowsAShortDelayForThePageToUpdateItsResult") },
  { node: t("text.assertion"), explanation: t("text.checksThatTheVisibleTextIsHelloDemoName") },
  { node: t("text.validateData"), explanation: t("text.validatesTheRequestBodyAndHeaderResponseJSONCookieLocalStorageAndSessionStorage") },
  { node: t("text.extractValue"), explanation: t("text.readsTheJSONResultDisplayedInApiResultAndStoresItInApiResult") },
  { node: t("text.saveData"), explanation: t("text.chooseThePreviousNodeOutputOrADOMElementThePropertyToReadAndTheStoredType") },
  { node: t("text.setVariable"), explanation: t("text.combinesDemoNameAndApiResultInTheExampleSummaryVariable") },
  { node: t("text.pauseWaitUser"), explanation: t("text.keepsTheBrowserOpenToInspectTheResultClickContinueToFinish") }
];

// Ordinals identify shipped examples, including saved examples whose names predate localization.
const exampleLabels: Readonly<Record<string, TranslationKey>> = {
  "01": "examples.process01", "02": "examples.process02", "03": "examples.process03",
  "04": "examples.process04", "05": "examples.process05", "06": "text.06FieldWithText",
  "07": "text.07FieldWithGenerator", "08": "examples.process08", "09": "examples.process09",
  "10": "examples.process10", "11": "examples.process11", "12": "examples.process12",
  "13": "examples.process13", "14": "examples.process14", "15": "examples.process15",
  "16": "examples.process16", "17": "examples.process17", "18": "examples.process18"
};

export const renderExampleGuide = (processName: string): TemplateResult => {
  const key = exampleLabels[/^(\d{2})\s*·/.exec(processName)?.[1] ?? ""];
  const displayName = key === undefined ? processName : t(key);
  const concatenated = displayName.includes(t("text.allConnected"));
  const targetName = displayName.includes("·") ? displayName.split("·").slice(1).join("·").trim() : displayName;
  const visibleSteps = concatenated ? steps : steps.filter(({ node }) => node === targetName);
  return html`
    <details class="example-guide" open>
      <summary>${concatenated ? t("text.howTheConnectedExampleWorks") : t("text.arg0Example", { arg0: targetName })}</summary>
      <p>${concatenated
        ? t("text.thisFinalProcessConnectsEveryElementFromLeftToRightContinuingInAZigzagAcrossRows")
        : t("text.thisProcessFocusesOnASingleElementTheOtherNodesProvideTheMinimumSetupToPrepareThe")} ${t("text.everythingRunsOnAnInterceptedVirtualDomainWithoutAnExternalServerOrInternetAccess")}</p>
      <ol>${visibleSteps.map(({ node, explanation }) => html`<li><strong>${node}</strong><span>${explanation}</span></li>`)}</ol>
    </details>
  `;
};
