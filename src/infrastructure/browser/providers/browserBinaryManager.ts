import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Logger } from "../../../application/logging/logger";
import type { PlaywrightRuntimeProvider } from "../playwrightRuntime";

export type BrowserInstallationState = "missing" | "installing" | "ready" | "corrupted" | "incompatible";

export interface BrowserInstallationSnapshot {
  readonly state: BrowserInstallationState;
  readonly playwrightVersion: string;
  readonly requiredRevision: string;
  readonly browserVersion: string | null;
  readonly executablePath: string | null;
  readonly detail: string;
}

export interface BrowserInstallProgress {
  readonly message: string;
  readonly percentage?: number;
}

interface InstallationManifest {
  readonly version: 1;
  readonly playwrightVersion: string;
  readonly requiredRevision: string;
  readonly browserVersion: string;
  readonly executablePath: string;
  readonly verifiedAt: string;
}

interface BrowserDescriptorFile {
  readonly browsers?: readonly { readonly name?: unknown; readonly revision?: unknown }[];
}

export interface BrowserProcessRunner {
  run(cliPath: string, args: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void): Promise<void>;
}

export class NodeBrowserProcessRunner implements BrowserProcessRunner {
  public run(cliPath: string, args: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, [cliPath, ...args], { env: environment, windowsHide: true });
      child.stdout.on("data", (chunk: Buffer) => onOutput(chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => onOutput(chunk.toString()));
      child.once("error", reject);
      child.once("exit", (code) => code === 0
        ? resolvePromise()
        : reject(new Error(`La instalación de Chromium terminó con código ${code ?? "desconocido"}.`)));
    });
  }
}

export class BrowserBinaryManager {
  public readonly binariesPath: string;
  public readonly runtimePath: string;
  private readonly manifestPath: string;
  private operation: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  public constructor(
    private readonly rootPath: string,
    private readonly runtimeLoader: PlaywrightRuntimeProvider,
    private readonly logger: Logger,
    private readonly runner: BrowserProcessRunner = new NodeBrowserProcessRunner()
  ) {
    this.binariesPath = join(rootPath, "binaries");
    this.runtimePath = join(rootPath, "runtime");
    this.manifestPath = join(rootPath, "install.json");
  }

  public onDidChange(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  public async inspect(): Promise<BrowserInstallationSnapshot> {
    const descriptor = await this.descriptor();
    if (this.operation !== null) return this.snapshot("installing", descriptor, null, null, "Chromium se está instalando.");
    const manifest = await this.readManifest();
    if (manifest === null) return this.snapshot("missing", descriptor, null, null, "Chromium no está instalado.");
    if (manifest.playwrightVersion !== descriptor.playwrightVersion || manifest.requiredRevision !== descriptor.requiredRevision) {
      return this.snapshot("incompatible", descriptor, manifest.browserVersion, manifest.executablePath, "La instalación pertenece a otra versión de Playwright.");
    }
    try {
      await access(manifest.executablePath);
      return this.snapshot("ready", descriptor, manifest.browserVersion, manifest.executablePath, "Chromium está instalado y verificado.");
    } catch {
      return this.snapshot("corrupted", descriptor, manifest.browserVersion, manifest.executablePath, "No se encuentra el ejecutable registrado.");
    }
  }

  public async verify(): Promise<BrowserInstallationSnapshot> {
    const descriptor = await this.descriptor();
    const runtime = await this.runtimeLoader.load();
    const executablePath = runtime.chromium.executablePath();
    try {
      await access(executablePath);
      const browser = await runtime.chromium.launch({ executablePath, headless: true });
      const browserVersion = browser.version();
      await browser.close();
      const manifest: InstallationManifest = {
        version: 1,
        playwrightVersion: descriptor.playwrightVersion,
        requiredRevision: descriptor.requiredRevision,
        browserVersion,
        executablePath,
        verifiedAt: new Date().toISOString()
      };
      await this.writeManifest(manifest);
      this.emit();
      this.logger.info(`Chromium ${browserVersion} verificado en ${executablePath}.`);
      return this.snapshot("ready", descriptor, browserVersion, executablePath, "Chromium está instalado y verificado.");
    } catch (error: unknown) {
      this.logger.error("La verificación de Chromium ha fallado.", error);
      return this.snapshot("corrupted", descriptor, null, executablePath, error instanceof Error ? error.message : "La verificación ha fallado.");
    }
  }

  public install(onProgress: (progress: BrowserInstallProgress) => void = () => undefined): Promise<void> {
    if (this.operation !== null) return this.operation;
    this.operation = this.performInstall(onProgress).finally(() => { this.operation = null; });
    return this.operation;
  }

  public async remove(): Promise<void> {
    this.assertManagedPath(this.binariesPath);
    this.assertManagedPath(this.runtimePath);
    await Promise.all([
      rm(this.binariesPath, { recursive: true, force: true }),
      rm(this.runtimePath, { recursive: true, force: true }),
      rm(this.manifestPath, { force: true })
    ]);
    this.emit();
    this.logger.info("Instalación administrada de Chromium eliminada.");
  }

  public async requireExecutablePath(): Promise<string> {
    const snapshot = await this.inspect();
    if (snapshot.state !== "ready" || snapshot.executablePath === null) {
      throw new Error(snapshot.state === "missing" ? "Instala Chromium desde Gestionar navegador." : `Chromium no está disponible: ${snapshot.detail}`);
    }
    return snapshot.executablePath;
  }

  private async performInstall(onProgress: (progress: BrowserInstallProgress) => void): Promise<void> {
    await mkdir(this.binariesPath, { recursive: true });
    await mkdir(this.runtimePath, { recursive: true });
    const cliPath = this.resolvePackageFile("cli.js");
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: this.binariesPath,
      PLAYWRIGHT_SKIP_BROWSER_GC: "1"
    };
    if (process.versions.electron !== undefined) environment.ELECTRON_RUN_AS_NODE = "1";
    this.logger.info(`Instalando Chromium en ${this.binariesPath}.`);
    onProgress({ message: "Descargando Chromium…" });
    await this.runner.run(cliPath, ["install", "chromium"], environment, (text) => {
      const clean = text.trim();
      if (clean !== "") this.logger.debug(clean);
      const match = /(?:^|\s)(\d{1,3})%(?:\s|$)/.exec(clean);
      const percentage = match?.[1] === undefined ? undefined : Number(match[1]);
      onProgress(percentage === undefined ? { message: clean || "Instalando Chromium…" } : { message: clean, percentage });
    });
    const verified = await this.verify();
    if (verified.state !== "ready") throw new Error(verified.detail);
  }

  private emit(): void { for (const listener of this.listeners) listener(); }

  private async descriptor(): Promise<{ playwrightVersion: string; requiredRevision: string }> {
    const packageJson = JSON.parse(await readFile(this.resolvePackageFile("package.json"), "utf8")) as { version?: unknown };
    const browsers = JSON.parse(await readFile(this.resolvePackageFile("browsers.json"), "utf8")) as BrowserDescriptorFile;
    const chromium = browsers.browsers?.find(({ name }) => name === "chromium");
    if (typeof packageJson.version !== "string" || typeof chromium?.revision !== "string") {
      throw new Error("No se pudo determinar la versión requerida de Chromium.");
    }
    return { playwrightVersion: packageJson.version, requiredRevision: chromium.revision };
  }

  private resolvePackageFile(name: string): string {
    const requireFromBundle = createRequire(__filename);
    const packagePath = requireFromBundle.resolve("playwright-core/package.json");
    return join(dirname(packagePath), name);
  }

  private async readManifest(): Promise<InstallationManifest | null> {
    try {
      const value = JSON.parse(await readFile(this.manifestPath, "utf8")) as Partial<InstallationManifest>;
      return value.version === 1 && typeof value.playwrightVersion === "string" && typeof value.requiredRevision === "string" &&
        typeof value.browserVersion === "string" && typeof value.executablePath === "string" && typeof value.verifiedAt === "string"
        ? value as InstallationManifest
        : null;
    } catch { return null; }
  }

  private async writeManifest(manifest: InstallationManifest): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
    const temporary = `${this.manifestPath}.tmp`;
    await writeFile(temporary, JSON.stringify(manifest, null, 2), "utf8");
    await rename(temporary, this.manifestPath);
  }

  private snapshot(state: BrowserInstallationState, descriptor: { playwrightVersion: string; requiredRevision: string }, browserVersion: string | null, executablePath: string | null, detail: string): BrowserInstallationSnapshot {
    return { state, ...descriptor, browserVersion, executablePath, detail };
  }

  private assertManagedPath(target: string): void {
    const root = resolve(this.rootPath);
    const resolvedTarget = resolve(target);
    const child = relative(root, resolvedTarget);
    if (!isAbsolute(root) || child === "" || child.startsWith(`..${sep}`) || child === ".." || isAbsolute(child)) {
      throw new Error("Se rechazó una ruta de borrado fuera del almacenamiento administrado.");
    }
  }
}
