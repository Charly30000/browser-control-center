export interface DestructiveActionConfirmation {
  readonly question: string;
  readonly detail?: string;
}

export interface DestructiveConfirmationRequestMessage {
  readonly type: "ui.confirmDestructiveAction";
  readonly requestId: string;
  readonly confirmation: DestructiveActionConfirmation;
}

export interface DestructiveConfirmationResultMessage {
  readonly type: "ui.destructiveActionConfirmed";
  readonly requestId: string;
  readonly confirmed: boolean;
}

export const isDestructiveConfirmationRequest = (value: unknown): value is DestructiveConfirmationRequestMessage => {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  if (message.type !== "ui.confirmDestructiveAction" || typeof message.requestId !== "string") return false;
  if (typeof message.confirmation !== "object" || message.confirmation === null) return false;
  const confirmation = message.confirmation as Record<string, unknown>;
  return typeof confirmation.question === "string"
    && (confirmation.detail === undefined || typeof confirmation.detail === "string");
};
