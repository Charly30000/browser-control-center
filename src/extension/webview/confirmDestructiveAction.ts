import * as vscode from "vscode";
import type { DestructiveActionConfirmation } from "../../shared/messages/destructiveConfirmationMessages";

export const confirmDestructiveAction = async ({ question, detail }: DestructiveActionConfirmation): Promise<boolean> => {
  const options: vscode.MessageOptions = detail === undefined
    ? { modal: true }
    : { modal: true, detail };
  const answer = await vscode.window.showWarningMessage(
    question,
    options,
    "Eliminar"
  );
  return answer === "Eliminar";
};
