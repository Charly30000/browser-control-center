import { randomUUID } from "node:crypto";
import type { Page } from "playwright-core";
import type { BrowserPageSnapshot } from "../../domain/browser/browserBridge";

interface PageRecord { readonly id: string; readonly page: Page; title: string; refreshTimer: NodeJS.Timeout | null; }

export class BrowserPageRegistry {
  private readonly records = new Map<string, PageRecord>();
  private activePageId: string | null = null;

  public constructor(private readonly onDidChange: () => void) {}

  public register(page: Page): string {
    const existing = [...this.records.values()].find((record) => record.page === page);
    if (existing !== undefined) return existing.id;
    const id = randomUUID();
    const record: PageRecord = { id, page, title: "Nueva pestaña", refreshTimer: null };
    this.records.set(id, record);
    this.activePageId = id;
    const refresh = (): void => { void this.refresh(record); };
    page.on("domcontentloaded", refresh);
    page.on("load", refresh);
    page.on("framenavigated", refresh);
    record.refreshTimer = setInterval(refresh, 1_000);
    record.refreshTimer.unref();
    page.on("close", () => {
      if (record.refreshTimer !== null) clearInterval(record.refreshTimer);
      this.records.delete(id);
      if (this.activePageId === id) this.activePageId = this.records.keys().next().value ?? null;
      this.onDidChange();
    });
    refresh();
    this.onDidChange();
    return id;
  }

  public snapshot(): readonly BrowserPageSnapshot[] {
    return [...this.records.values()].map((record) => ({
      id: record.id,
      url: record.page.url(),
      title: record.title,
      active: record.id === this.activePageId
    }));
  }

  public activePage(): Page | null {
    return this.activePageId === null ? null : this.records.get(this.activePageId)?.page ?? null;
  }

  public async select(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record === undefined) throw new Error("La pestaña seleccionada ya no existe.");
    await record.page.bringToFront();
    this.activePageId = id;
    await this.refresh(record);
  }

  public async close(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record === undefined) throw new Error("La pestaña seleccionada ya no existe.");
    await record.page.close();
  }

  private async refresh(record: PageRecord): Promise<void> {
    try { record.title = await record.page.title() || "Sin título"; } catch { record.title = "Pestaña cerrada"; }
    this.onDidChange();
  }
}
