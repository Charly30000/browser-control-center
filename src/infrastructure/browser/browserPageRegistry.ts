import { t } from "../../localization";
import { randomUUID } from "node:crypto";
import type { Page } from "playwright-core";
import type { BrowserPageSnapshot } from "../../domain/browser/browserBridge";

interface PageRecord { readonly id: string; readonly page: Page; title: string; readonly refresh: () => void; readonly close: () => void; }

export class BrowserPageRegistry {
  private readonly records = new Map<string, PageRecord>();
  private activePageId: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  public constructor(private readonly onDidChange: () => void) {}

  public register(page: Page): string {
    const existing = [...this.records.values()].find((record) => record.page === page);
    if (existing !== undefined) return existing.id;
    const id = randomUUID();
    const refresh = (): void => { const current = this.records.get(id); if (current !== undefined) void this.refresh(current); };
    const close = (): void => {
      const current = this.records.get(id);
      if (current !== undefined) this.unregister(current);
      this.onDidChange();
    };
    const record: PageRecord = { id, page, title: t("text.newTab"), refresh, close };
    this.records.set(id, record);
    this.activePageId = id;
    page.on("domcontentloaded", refresh);
    page.on("load", refresh);
    page.on("framenavigated", refresh);
    page.on("close", close);
    this.ensureRefreshTimer();
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
    if (record === undefined) throw new Error(t("text.theSelectedTabNoLongerExists"));
    await record.page.bringToFront();
    this.activePageId = id;
    await this.refresh(record);
  }

  public async close(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record === undefined) throw new Error(t("text.theSelectedTabNoLongerExists"));
    await record.page.close();
  }

  public dispose(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    for (const record of this.records.values()) {
      record.page.off("domcontentloaded", record.refresh);
      record.page.off("load", record.refresh);
      record.page.off("framenavigated", record.refresh);
      record.page.off("close", record.close);
    }
    this.records.clear();
    this.activePageId = null;
  }

  private ensureRefreshTimer(): void {
    if (this.refreshTimer !== null) return;
    this.refreshTimer = setInterval(() => {
      for (const record of this.records.values()) void this.refresh(record);
    }, 2_000);
    this.refreshTimer.unref();
  }

  private unregister(record: PageRecord): void {
    record.page.off("domcontentloaded", record.refresh);
    record.page.off("load", record.refresh);
    record.page.off("framenavigated", record.refresh);
    record.page.off("close", record.close);
    this.records.delete(record.id);
    if (this.activePageId === record.id) this.activePageId = this.records.keys().next().value ?? null;
    if (this.records.size === 0 && this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refresh(record: PageRecord): Promise<void> {
    try { record.title = await record.page.title() || t("text.untitled"); } catch { record.title = t("text.tabClosed"); }
    this.onDidChange();
  }
}
