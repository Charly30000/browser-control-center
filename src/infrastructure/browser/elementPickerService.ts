import type { Page } from "playwright-core";
import type { ElementTarget } from "../../domain/browser/browserBridge";

export class ElementPickerService {
  public async pick(page: Page): Promise<ElementTarget> {
    await page.bringToFront();
    return page.evaluate(() => new Promise<ElementTarget>((resolvePromise) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #007acc;background:rgba(0,122,204,.12);display:none";
      document.documentElement.append(overlay);

      const escapeCss = (value: string): string => globalThis.CSS?.escape?.(value) ?? value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
      const selectorFor = (element: Element): string => {
        if (element.id) return `#${escapeCss(element.id)}`;
        for (const attribute of ["data-testid", "data-test", "name", "aria-label"] as const) {
          const value = element.getAttribute(attribute);
          if (value) return `${element.tagName.toLowerCase()}[${attribute}="${escapeCss(value)}"]`;
        }
        const segments: string[] = [];
        let current: Element | null = element;
        while (current !== null && segments.length < 6) {
          let segment = current.tagName.toLowerCase();
          const classes = [...current.classList].slice(0, 2).map((value) => `.${escapeCss(value)}`).join("");
          if (classes !== "") segment += classes;
          const parent: Element | null = current.parentElement;
          if (parent !== null) {
            const siblings = [...parent.children].filter((child) => child.tagName === current?.tagName);
            if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
          segments.unshift(segment);
          const root: Node = current.getRootNode();
          if (root instanceof ShadowRoot) {
            current = root.host;
          } else current = parent;
        }
        return segments.join(" ");
      };

      const targetFromEvent = (event: Event): Element | null => event.composedPath().find((item): item is Element => item instanceof Element) ?? null;
      const hover = (event: PointerEvent): void => {
        const element = targetFromEvent(event);
        if (element === null || element === overlay) return;
        const rect = element.getBoundingClientRect();
        overlay.style.display = "block";
        overlay.style.left = `${rect.left}px`; overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
      };
      const cleanup = (): void => {
        document.removeEventListener("pointermove", hover, true);
        document.removeEventListener("click", choose, true);
        document.removeEventListener("keydown", cancel, true);
        overlay.remove();
      };
      const choose = (event: MouseEvent): void => {
        event.preventDefault(); event.stopImmediatePropagation();
        const element = targetFromEvent(event);
        if (element === null || element === overlay) return;
        cleanup();
        resolvePromise({ selector: selectorFor(element), tagName: element.tagName.toLowerCase(), preview: (element.textContent ?? "").trim().slice(0, 120) });
      };
      const cancel = (event: KeyboardEvent): void => {
        if (event.key !== "Escape") return;
        cleanup();
        resolvePromise({ selector: "", tagName: "", preview: "Selección cancelada" });
      };
      document.addEventListener("pointermove", hover, true);
      document.addEventListener("click", choose, true);
      document.addEventListener("keydown", cancel, true);
    }));
  }
}
