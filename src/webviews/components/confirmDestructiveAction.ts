import type {
  DestructiveActionConfirmation,
  DestructiveConfirmationRequestMessage,
  DestructiveConfirmationResultMessage
} from "../../shared/messages/destructiveConfirmationMessages";

export type ConfirmDestructiveAction = (confirmation: DestructiveActionConfirmation) => Promise<boolean>;

export class DestructiveConfirmationClient {
  private readonly pending = new Map<string, (confirmed: boolean) => void>();

  public constructor(private readonly post: (message: DestructiveConfirmationRequestMessage) => void) {}

  public readonly confirm: ConfirmDestructiveAction = (confirmation) => new Promise<boolean>((resolve) => {
    const requestId = crypto.randomUUID();
    this.pending.set(requestId, resolve);
    this.post({ type: "ui.confirmDestructiveAction", requestId, confirmation });
  });

  public resolve(message: DestructiveConfirmationResultMessage): void {
    const pending = this.pending.get(message.requestId);
    if (pending === undefined) return;
    this.pending.delete(message.requestId);
    pending(message.confirmed);
  }

  public cancelPending(): void {
    for (const resolve of this.pending.values()) resolve(false);
    this.pending.clear();
  }
}
