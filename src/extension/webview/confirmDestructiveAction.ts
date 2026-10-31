import { t } from "../../localization";
import * as vscode from "vscode";
import type { DestructiveActionConfirmation } from "../../shared/messages/destructiveConfirmationMessages";

export const confirmDestructiveAction = async ({ question, detail }: DestructiveActionConfirmation): Promise<boolean> => {
  const options: vscode.MessageOptions = detail === undefined
    ? { modal: true }
    : { modal: true, detail };
  const answer = await vscode.window.showWarningMessage(
    question,
    options,
    t("actions.delete")
  );
  return answer === t("actions.delete");
};
