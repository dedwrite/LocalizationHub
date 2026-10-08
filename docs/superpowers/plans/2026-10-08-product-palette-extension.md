# Product palette extension — local review

The user expanded the approved dark/lime identity to the Web App editor, Admin,
Desktop frontend, email presentation, and remaining shared interface chrome.
This is not a release or production deployment.

## Changes

- Updated canonical Web App roles rather than adding a new override layer.
- Preserved semantic warning/error/success colors and protected source tokens.
- Updated Admin and both Radio skins; retained authentication, playback,
  progress geometry, playlists and all existing actions.
- Updated Desktop frontend panels, dialogs, extraction and editor styles;
  removed the old welcome background image/glass presentation.
- Updated verification email styling, added a table-based Admin code template,
  and aligned the server-rendered verification page and shared language control.
- Preserved email transport, plaintext, expiry, validation and idempotency.

## Verification

- Website and Desktop React production builds pass.
- 767 Vitest tests and 168 server tests pass; i18n audit passes (1559 keys).
- Editor tests exercise English/Arabic, desktop/390px, accessibility, overflow,
  and a synthetic translation edit.
- Admin/Radio/Desktop regression matrix: 103 passed, one existing skip.
- Added direct Admin hover-contrast and Radio capsule-background assertions.
- Independent finish review identified and confirmed resolution of the Radio
  capsule background and Admin primary-hover contrast regressions.
- Local review restarted using collaboration-server/dev.mjs; health returns 200.

## Boundaries

Desktop evidence uses its actual production React bundle with synthetic HTTP
and native host boundaries; it does not certify an installed native binary.
Email templates were tested without sending real mail; Outlook/Gmail rendering
is not certified. Radio presentation fixtures deliberately have no playable
media. No database records, secrets, release versions or tags changed.

The existing website/DESIGN.md violet documentation is historical drift; the
unchanged packages/ui/src/theme.css and approved public implementation are the
palette authority for this extension. Historical public-only PRODUCT.md scope
is superseded by the user's explicit expanded request, not silently rewritten.
