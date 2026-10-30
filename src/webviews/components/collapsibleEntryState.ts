export class CollapsibleEntryState {
  private readonly expanded = new Map<string, boolean>();

  public constructor(private readonly changed: () => void) {}

  public isOpen(id: string, initiallyOpen: boolean): boolean { return this.expanded.get(id) ?? initiallyOpen; }

  public toggle(id: string, initiallyOpen: boolean, event: Event): void {
    if (!(event.currentTarget instanceof HTMLDetailsElement)) return;
    const open = event.currentTarget.open;
    if (this.isOpen(id, initiallyOpen) === open) return;
    this.expanded.set(id, open);
    this.changed();
  }
}
