# Localization

This directory owns the translation system. Each authored JSON catalog contains messages for one language.

```text
src/localization/
  config.json                 # Default, fallback and registered languages
  locales/
    en.json                   # English source catalog
  index.ts                    # Typed translation API and locale resolution
  displayLabels.ts            # Display labels for stored enum values
  generate.mjs                # Build-time validation and generation
  generate.d.mts              # Generator types for tests and tools
  generated/
    catalogs.ts               # Generated catalog imports
    manifest-files.json       # Inventory of generated VS Code files
```

Only English is registered currently. The Extension Host resolves VS Code's display language before loading application modules. Webviews receive that locale through their HTML `lang` attribute and initialize the same translation engine before rendering. Unsupported locales use `defaultLocale`; missing messages use `fallbackLocale`. Regional codes resolve to a registered parent, so `es-ES` can use `es`.

## Add a language

1. Create its file under `locales/`, for example `locales/es.json`. Use the same keys as `en.json` and translate only values. You may omit unfinished messages; they fall back at runtime without inserting English text into the new source file.
2. Register it in `config.json`:

```json
{
  "defaultLocale": "en",
  "fallbackLocale": "en",
  "locales": {
    "en": "locales/en.json",
    "es": "locales/es.json"
  }
}
```

3. Run `npm run localization` to refresh generated files, or run `npm run verify` / `npm run build`, which prepare them automatically.
4. Rebuild and reload VS Code. A registered locale is selected automatically when it matches the editor's display language. Changing the editor language requires a reload, as usual; there is no separate language switch in the extension.

No application imports or handwritten registry entries need changing. Default and fallback locales must be registered. Locale files must be distinct JSON objects with nonempty string values; unknown keys and changed placeholder names fail validation. English defines the current keys.

## Use a message

Import `t` and `TranslationKey` from this directory. Use named placeholders:

```ts
t("names.processCopy", { name: process.name });
```

Values are substituted once as literal text. Dollars, JSON braces and automation variables are not evaluated. Lit escapes messages in HTML templates. For standalone HTML, use the shared `escapeHtml` utility; serialize strings embedded in scripts with `JSON.stringify`. Resolve messages before passing callbacks to Playwright's `page.evaluate` and pass those strings as arguments.

`initializeLocale` runs once at startup, before importing modules with translated constants. It is not a live language-switching API. `displayLabels.ts` translates displayed enums while their stored IDs stay unchanged.

## VS Code manifest files

VS Code requires `package.nls.json` and locale variants at the extension root. The generator creates these integration artifacts from the registered catalogs and the placeholders actually used in `package.json`. They contain only manifest messages, not a second copy of all application text. Do not edit them or `generated/` by hand.

Missing localized manifest keys fall back through VS Code's default manifest catalog. Removing a locale from config removes only files previously owned by the generator; its source JSON remains available. Generated files should be committed so direct tooling and tests can read them.

The build's watch mode regenerates these files when configuration changes. Translation catalogs are bundled into JavaScript, with no runtime filesystem or network access.

## Data and validation

README content stays in README.md, English first and Spanish below. User names, values, JSON properties, command IDs, resource references, selectors and saved documents are not translated or migrated.

`npm run verify` runs generation, types, tests, lint and bundles. Set `BCC_REAL_BROWSER_TESTS=1` for Chrome integration tests. To check generated artifacts without writing files, run `node src/localization/generate.mjs --check`.
