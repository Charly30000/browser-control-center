/** Asocia cada confirmación con su borrador y evita guardados simultáneos. */
export class SaveRequestTracker<T> {
  private sequence = 0;
  private request: { requestId: string; value: T } | null = null;

  public constructor(private readonly prefix: string) {}
  public get pending(): boolean { return this.request !== null; }

  public start(value: T): { requestId: string; value: T } | null {
    if (this.request !== null) return null;
    this.request = { requestId: `${this.prefix}-save-${++this.sequence}`, value: structuredClone(value) };
    return this.request;
  }

  public complete(requestId: string): T | null {
    if (this.request?.requestId !== requestId) return null;
    const value = this.request.value;
    this.reset();
    return value;
  }

  public reset(): void { this.request = null; }
}
