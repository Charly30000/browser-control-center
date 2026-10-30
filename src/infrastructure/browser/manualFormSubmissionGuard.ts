import { randomUUID } from "node:crypto";
import type { Page } from "playwright-core";

/** La escritura asistida no debe activar el envío de formularios de la página. */
export class ManualFormSubmissionGuard {
  private readonly key = `__bccManualWrite_${randomUUID().replace(/-/g, "")}`;

  public async run<T>(page: Page, action: () => Promise<T>): Promise<T> {
    await page.evaluate((key) => {
      const host = window as unknown as Record<string, unknown>;
      const active = host[key] as { depth: number } | undefined;
      if (active !== undefined) { active.depth += 1; return; }
      const prototype = HTMLFormElement.prototype;
      const submit = Object.getOwnPropertyDescriptor(prototype, "submit");
      const requestSubmit = Object.getOwnPropertyDescriptor(prototype, "requestSubmit");
      const preventSubmit = (event: Event): void => { event.preventDefault(); event.stopImmediatePropagation(); };
      const preventEnter = (event: KeyboardEvent): void => {
        if (event.key === "Enter" && !event.composedPath().some((element) => element instanceof HTMLTextAreaElement)) preventSubmit(event);
      };
      if (submit !== undefined) Object.defineProperty(prototype, "submit", { ...submit, value: () => undefined });
      if (requestSubmit !== undefined) Object.defineProperty(prototype, "requestSubmit", { ...requestSubmit, value: () => undefined });
      window.addEventListener("submit", preventSubmit, true);
      window.addEventListener("keydown", preventEnter, true);
      host[key] = {
        depth: 1,
        restore: () => {
          if (submit !== undefined) Object.defineProperty(prototype, "submit", submit);
          if (requestSubmit !== undefined) Object.defineProperty(prototype, "requestSubmit", requestSubmit);
          window.removeEventListener("submit", preventSubmit, true);
          window.removeEventListener("keydown", preventEnter, true);
        }
      };
    }, this.key);
    try { return await action(); }
    finally {
      await page.evaluate((key) => {
        const host = window as unknown as Record<string, unknown>;
        const active = host[key] as { depth: number; restore: () => void } | undefined;
        if (active === undefined || --active.depth > 0) return;
        active.restore();
        delete host[key];
      }, this.key).catch(() => undefined);
    }
  }
}
