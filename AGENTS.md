# Persisted data compatibility

- Any change to persisted JSON fields, types, meaning or stored defaults must increment the corresponding entity schema constant: Manual, Formulas, Arrays or Automations. UI-only or translation changes do not increment a data schema.
- Add a pure, sequential `n -> n + 1` step to `src/infrastructure/persistence/migrations/registry.ts`. Keep every historical step. Never label old data as current without transforming it.
- All disk and import reads must use the version-aware codecs before current-shape guards. Successful disk reads persist upgrades atomically; failed migrations, invalid documents and unsupported future versions must leave original files untouched.
- Preserve IDs, references, names, user values and timestamps unless the documented schema change explicitly requires otherwise. Do not recreate documents from empty factories to migrate them.
- Keep historical fixtures in `test/fixtures/persistence/` unchanged. Add fixtures for newly released schemas and regression tests for chained upgrades, failures and import paths. A version bump without its migration must fail verification.
- Keep `docs/migrations.md`, `docs/persistence.md` and the changelog current whenever serialization changes. Entity versions, import envelope versions, catalog metadata versions and extension releases are independent.
- Catalogs and selectors must filter nonexistent files through the DAO; a metadata summary is not proof that a file exists. Do not hide I/O or validation failures by treating them as missing files.
- Preserve the published extension identity and storage keys. Never reset or delete stored user data as an upgrade strategy.

# Release version

- `package.json` field `version` is the single source of truth for the extension release. Application code must use `CURRENT_EXTENSION_VERSION` from `src/shared/extensionVersion.ts`; do not introduce release literals or read the manifest independently.
- Use `npm version <new-version> --no-git-tag-version` to update the manifest and both root versions in `package-lock.json` together. Document the release under its version heading in `CHANGELOG.md`; verification checks their consistency.
- Keep historical versions in fixtures, imported documents and changelog entries. Data schema versions are independent and follow the migration rules above. See `docs/release.md` for the release procedure.

# User documentation

- Every change to user-visible behavior, controls, defaults, workflows, validation, persistence or accepted JSON must update the affected user documentation in the same change. A task is not complete while instructions or examples describe outdated behavior.
- Update the relevant guides in `docs/` and the in-app AI Documentation for Manual, Formulas, Arrays and Automations. Add a concise English changelog entry for user-visible changes. README updates follow the presentation rules below, not every functional change.
- In-app usage text lives in `src/localization/locales/<locale>.json` under `documentation.*` and node usage messages; composition and executable examples live in `src/webviews/documentation/`. Update registered translations and keep placeholders consistent. Do not edit generated catalogs or root `package.nls*.json` directly.
- AI Documentation must explain how to use the application, available options, where to paste results and how to produce complete accepted JSON. It must not describe the extension's implementation. Use current UI labels, preserve the user's IDs and values, explain resource prerequisites, and keep examples compatible with actual import and validation paths.
- Update example factories and the affected existing documentation checks when contracts change; run the appropriate validation. Keep historical persistence fixtures unchanged. Implementation and maintenance instructions belong in developer guides, especially `docs/ai-documentation.md`, rather than in the text users copy for an AI.

# README purpose

- `README.md` primarily presents and promotes this free application: explain its value, highlight useful capabilities and make it easy to get started. Keep it appealing, concise and focused on encouraging adoption.
- Detailed usage instructions, configuration options, JSON formats, edge cases and troubleshooting belong in `docs/` and the in-app AI Documentation. Link to those guides instead of expanding the README with every feature or implementation change.
- Do not update the README for every small change, new control or bug fix. Update it when the main value proposition, major capabilities, installation/getting-started steps, key links or existing claims materially change or become inaccurate.
- When a README update is warranted, keep its English-first and Spanish sections consistent. The affected guides in `docs/` and AI Documentation still need to stay current for every relevant change, even when the README does not change.

# Automation node examples

- Every new or modified automation node must have a working, user-accessible example in the same change. Extend `Add example` in `src/domain/automations/exampleAutomation.ts`, its explanatory guide and the AI Documentation node catalog in `src/webviews/documentation/examples.ts`.
- Demonstrate new modes and operators, required setup and the expected result, including negative checks and removal scope. Prefer self-contained offline examples; never depend on a real login, personal data or an unconfigured external service.
- Verify example coverage against all palette node types and supported validation options, and execute changed examples through the actual runner/browser where applicable. Update user guides and JSON examples alongside node registration, execution, validation, inspector fields and persisted-schema migrations. A node change without a supporting example is incomplete.
