import * as esbuild from "esbuild";
import { generateLocalization } from "./src/localization/generate.mjs";

const watch = process.argv.includes("--watch");
const localizationPlugin = {
  name: "localization",
  setup(build) { build.onStart(() => { generateLocalization(); }); }
};

const extensionOptions = {
  entryPoints: { extension: "src/extension/activate.ts" },
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode", "playwright-core"],
  outdir: "dist",
  sourcemap: true,
  logLevel: "info",
  plugins: [localizationPlugin]
};

const webviewOptions = {
  entryPoints: {
    manual: "src/webviews/pages/Manual/index.ts",
    formulas: "src/webviews/pages/Formulas/index.ts",
    arrays: "src/webviews/pages/Arrays/index.ts",
    browserManagement: "src/webviews/pages/BrowserManagement/index.ts",
    automations: "src/webviews/pages/Automatizaciones/index.ts",
    aiDocumentation: "src/webviews/pages/AiDocumentation/index.ts",
    sidebar: "src/webviews/sidebar/index.ts"
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outdir: "dist",
  sourcemap: true,
  logLevel: "info",
  plugins: [localizationPlugin]
};

if (watch) {
  const contexts = await Promise.all([
    esbuild.context(extensionOptions),
    esbuild.context(webviewOptions)
  ]);
  await Promise.all(contexts.map((context) => context.watch()));
  console.log("Observando cambios...");
} else {
  await Promise.all([
    esbuild.build(extensionOptions),
    esbuild.build(webviewOptions)
  ]);
}
