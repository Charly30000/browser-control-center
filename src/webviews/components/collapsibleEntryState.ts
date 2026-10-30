interface ExpansionStorage {
  read(id: string): boolean | undefined;
  write(ids: readonly string[], open: boolean): void;
}

export class CollapsibleEntryState {
  private readonly expanded = new Map<string, boolean>();

  public constructor(private readonly changed: () => void, private readonly storage?: ExpansionStorage) {}

  public isOpen(id: string, initiallyOpen: boolean): boolean {
    return (this.storage === undefined ? this.expanded.get(id) : this.storage.read(id)) ?? initiallyOpen;
  }

  public setAll(ids: readonly string[], open: boolean): void {
    if (ids.length === 0) return;
    if (this.storage !== undefined) this.storage.write(ids, open);
    else for (const id of ids) this.expanded.set(id, open);
    this.changed();
  }

  public toggle(id: string, initiallyOpen: boolean, event: Event): void {
    if (!(event.currentTarget instanceof HTMLDetailsElement)) return;
    const open = event.currentTarget.open;
    if (this.isOpen(id, initiallyOpen) === open) return;
    this.setAll([id], open);
  }
}
