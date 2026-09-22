export interface VsCodeApi<State = unknown> {
  postMessage(message: unknown): void;
  getState(): State | undefined;
  setState(newState: State): void;
}

declare const acquireVsCodeApi: <State = unknown>() => VsCodeApi<State>;

export const vscodeApi = acquireVsCodeApi();
