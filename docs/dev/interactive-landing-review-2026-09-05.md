# Export feedback and interactive landing

Follow-up to the bilingual quality pass, based on `0357c82dc41dda54aeb1cd4f1e6fcf00b9435dcc`.

## Confirmed bug

Desktop exports always showed a JSON success message even for CSV or PO output. The success message now follows `currentDocument.parser`. A typed mapping reads the English text from the bilingual catalog itself, so the desktop's English-text translation bridge cannot drift from a duplicated hardcoded toast. Regression tests parse JSON, CSV, PO, and POT fixtures and check the confirmation through both language lookups. POT input correctly reports the exported gettext PO format. File writing and cancellation behavior are unchanged.

## Landing changes

- Replaced the static hero editor with three editable examples. Visitors can switch entries, change Arabic text, reset the selected example, and see real protected-token validation. Values survive entry and interface-language changes during the visit. The demo uses local component state and makes no translation-provider requests.
- Added a file/engine selector with specific support boundaries and the appropriate browser/Windows destination. Browser formats list JSON, CSV, and PO/POT; the guide does not imply that browser file import supports `.lhproj`.
- Removed the repeated format and workflow strips. Extraction steps are available in an expandable section. Reduced the FAQ from seven questions to four, condensed the privacy section, and added a clear editor link at the end of the page.
- Consolidated the Captain Veyra context example and Arabic showcase into one bilingual scene. Preserved all 74 unique translator tips, hidden discoveries, and radio. The full context example remains separate from the editable demo.
- Added action-driven visual feedback, keyboard focus styles, reduced-motion handling, and readable mobile entry labels. Fixed the extraction badge's absolute positioning and isolated the sample position counter from RTL direction.
- Sent the hero's Windows link through the download page. That page explains the existing private-repository access limitation and offers the public web editor. Removed two download links that led to the same release page.

## Verification and limits

- 705 unit tests passed across 79 files, including four new export-feedback regression cases.
- The i18n audit is clean. Exact sample game strings are listed as content exemptions, following the existing audit convention; interface strings remain keyed.
- TypeScript/Vite builds passed for the website and desktop frontend.
- Browser checks exercised missing-token feedback, reset, per-entry text retention, English/Arabic switching, Unity support selection, and expandable extraction details.
- A temporary same-origin iframe provided a 360-pixel viewport check in Chromium. Arabic editing worked without horizontal overflow; the English Unity panel and its action fit the narrow layout. The temporary harness was removed before the production build.
- Updated existing E2E expectations to cover the new interaction and removed sections. The full Playwright/device matrix and native Windows installer were not run here. Existing desktop bundle-size guidance remains.
- GitHub exposed one Devin inline finding, addressed above. Two unposted flags were mentioned in the notification but their contents were not available through the PR comments; this pass does not claim to resolve unseen findings.

Public installer distribution still needs a public asset destination. This change does not alter repository visibility or publish a new Windows installer.


## Website identity follow-up — 2026-09-07

- Reworked the public palette around warm red, parchment text, and dark green surfaces, retaining the original app mark. Replaced the marketing atmosphere stylesheet instead of adding another theme layer. Public styles are scoped away from the working editor.
- Replaced four repeated feature cards with compact numbered rows. Joined local/cloud choices and privacy in a single section, removed the duplicate full-length Arabic demonstration, and tightened spacing.
- Navigation now points to the scene and file/engine guide. FAQs address Windows access, offline work, browser storage, and online translation rather than restating the feature cards.
- Rewrote key feature and context copy in both languages. The consolidated scene now uses catalog-backed interface labels; obsolete hardcoded label exemptions were removed from the audit. English source, Arabic translation, and code retain independent reading directions.
- Re-ran all 705 unit tests; the website TypeScript/Vite build passed. The catalog has 1,307 keys. Browser checks cover the 360px Arabic layout (345px content width including scrollbar, no horizontal overflow), missing-token/reset feedback, English Unity guidance, and the consolidated scene. Existing E2E expectations were updated for that scene; the full device matrix remains unrun.
