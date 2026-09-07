# Charcoal/violet and bilingual usability pass

Based on upstream main `667174a6b3b80a294e5faa289f8c75b9609652e9`.

## Changes

- Restored charcoal surfaces and violet accents across the public landing, download, and document pages, retaining the consolidated layout. Semantic error/success colors remain distinct.
- Revised roughly 40 English/Arabic catalog entries for clearer actions, consistent tone, and matching product claims. Both descriptions of dialogue context now explicitly depend on information present in the file. Clarified local browser storage and private Windows-download access.
- Added a protected-token checklist to the interactive preview. The core validator identifies missing variables and opening/closing tags; tokens keep LTR direction within either interface language. The existing status still reports structural errors and warnings.
- Added downloadable JSON, CSV, and PO samples with the same three fictional game lines. The guide links to real static assets with native download attributes. Fixtures test the actual files through the application parser and confirm protected-variable validation.
- Updated existing E2E copy expectations, sample-link checks, and the stale FAQ assertion about release numbers. Node fixture tests live outside the browser tsconfig and are included in the normal unit test run.

## Validation

708 unit tests passed across 80 files, including all three downloadable fixtures. The 1,314-key i18n audit and six catalog tests passed after resolving an English-lookup conflict. Website TypeScript/Vite build passed. Manual Chromium checks covered Arabic and English missing-token guidance, reset, missing closing tags, and a 360px viewport with no horizontal overflow. The narrow sample-download controls were visually inspected.

The full Playwright/device matrix and native Windows installer build were not run in this pass. The temporary responsive harness was removed before the final build. No backend behavior or release assets were changed.
