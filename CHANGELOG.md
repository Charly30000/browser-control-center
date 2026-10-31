# Changelog

## 0.5.0

- Added session cleanup nodes and partial/negative checks in Automations, with working offline examples for every new option.
- Session cleanup lists use an Add button and a separate input and Delete action for each name or key.
- English interface with support for future translations, and a README in English and Spanish.
- New AI Documentation with guides and JSON examples ready to copy, paste or import.
- Updated user and AI guides for saved data recovery, older documents and active browser selection.
- Auto-save in Manual, Formulas, Arrays and Automations after 5 seconds without interacting with controls. Enabled by default, with a switch to turn it off.
- Clearer layouts across all tabs, with distinct sections, more visible names and larger checkboxes.
- Drag and drop to reorder Manual lists and Automation groups and processes, with mouse wheel scrolling while dragging.
- Expanded and collapsed states are remembered. Manual adds expand-all and collapse-all buttons to supported sections.
- In Manual, Apply stays visible when an item is collapsed, and Apply all continues if a field fails. Fields are only filled on request, without submitting forms or repeatedly opening the Output panel.
- Manual fields support fixed text, and sequential typing defaults to 100 ms per key.
- Automations lets you rename processes, select them from anywhere on their card, and save or export incomplete drafts. The Field node combines fixed text and generated values.
- New Save Data node to reuse values from JSON responses, previous nodes or page elements, with data type selection and usage examples.
- Formulas and Arrays only prompt to save when switching items if there are actual changes.
- Improved compatibility with data from previous versions; missing items no longer appear in selectors. Manage Browser now displays the correct active browser.
- License changed to Apache-2.0.

All notable changes to Browser Control Center are documented here.

## 0.4.0

- Added Manual profiles, reusable Formulas and Arrays.
- Added managed Chromium and isolated system Chrome providers.
- Added the visual Automations editor and execution engine.
- Added versioned import/export and editable JSON documents.
- Centralized application persistence through a typed DAO.
- Added progressive document-size protection, consistent dirty-state transitions and credential redaction.
- Hardened browser cleanup, CSP, keyboard canvas controls and High Contrast behavior.
