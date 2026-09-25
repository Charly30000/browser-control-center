export class HistoryManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  public constructor(private readonly clone: (value: T) => T, private readonly limit = 100) {}
  public push(value: T): void { this.past.push(this.clone(value)); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  public undo(current: T): T | null { const previous = this.past.pop(); if (previous === undefined) return null; this.future.push(this.clone(current)); return this.clone(previous); }
  public redo(current: T): T | null { const next = this.future.pop(); if (next === undefined) return null; this.past.push(this.clone(current)); return this.clone(next); }
  public clear(): void { this.past = []; this.future = []; }
}
