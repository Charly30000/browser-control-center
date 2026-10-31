# Persisted data compatibility

- Any change to persisted JSON fields, types, meaning or stored defaults must increment the corresponding entity schema constant: Manual, Formulas, Arrays or Automations. UI-only or translation changes do not increment a data schema.
- Add a pure, sequential `n -> n + 1` step to `src/infrastructure/persistence/migrations/registry.ts`. Keep every historical step. Never label old data as current without transforming it.
- All disk and import reads must use the version-aware codecs before current-shape guards. Successful disk reads persist upgrades atomically; failed migrations, invalid documents and unsupported future versions must leave original files untouched.
- Preserve IDs, references, names, user values and timestamps unless the documented schema change explicitly requires otherwise. Do not recreate documents from empty factories to migrate them.
- Keep historical fixtures in `test/fixtures/persistence/` unchanged. Add fixtures for newly released schemas and regression tests for chained upgrades, failures and import paths. A version bump without its migration must fail verification.
- Keep `docs/migrations.md`, `docs/persistence.md` and the changelog current whenever serialization changes. Entity versions, import envelope versions, catalog metadata versions and extension releases are independent.
- Catalogs and selectors must filter nonexistent files through the DAO; a metadata summary is not proof that a file exists. Do not hide I/O or validation failures by treating them as missing files.
- Preserve the published extension identity and storage keys. Never reset or delete stored user data as an upgrade strategy.
