# LocalizationHub UI internationalization

LocalizationHub supports two application UI locales: English (`en`) and Arabic
(`ar`). English is the deliberate fresh-install default; the browser or operating
system locale never changes that default. Arabic is selected explicitly from the
single compact language switcher and is persisted per application environment.

## Architecture

`packages/i18n` is the shared, dependency-free catalog and React provider used by
the public website and the Web App. Catalogs are split by surface (`common`,
`website`, `workspace`, `desktop`, `admin`, `radio`, and extraction/legal
messages) and merged into one typed `MessageKey` map. English is the authoritative
copy; every key has a non-empty Arabic value and interpolation parameters are
checked by tests.

Existing surfaces can use the provider's `t(key, values)` helper directly. A
small compatibility bridge also localizes known existing DOM labels and
accessibility attributes so older components share the same catalog while they
are migrated. User data is explicitly marked with `data-i18n-content` and is
never translated by that bridge.

## Storage and switching

The preference is stored under `localizationhub.ui-locale.v1` in the local
application environment. A fresh environment reads as English. Switching is
immediate, updates `html[lang]`, `html[dir]`, and `data-ui-locale`, and survives a
reload. The preference is not part of a translation project or cloud document.

## RTL and content direction

Arabic UI sets `lang="ar" dir="rtl"`; English sets `lang="en" dir="ltr"`.
Logical CSS properties and a restrained RTL layer handle navigation, forms,
panels, and dialogs. Media transport remains in semantic previous/play/next
order. Source and translation text use the document's own `sourceDirection` and
`translationDirection`, independent of the UI locale. Technical values, paths,
IDs, URLs, tokens, shortcuts, code, and numeric identifiers use isolation (`bdi`,
`unicode-bidi: isolate`, or explicit direction) where needed.

## Terminology

Arabic copy is concise modern product language. `LocalizationHub`, `LH Radio`,
`Godot`, `Unity`, `Unreal Engine`, `Google Authenticator`, `Token`, `JSON`,
`CSV`, `PO`, `MP3`, `ID3`, `PCK`, `LOCRES`, `LOCMETA`, `UAsset`, `API`, `MFA`,
and `TOTP` remain canonical technical/product terms. User content (project
names, usernames, file names, game text, metadata, and translation text) is not
translated.

## Adding keys and locales

Add a semantic key to the smallest relevant catalog namespace, with English and
Arabic values and named interpolation parameters. Do not use an English sentence
as a key or interpolate raw HTML. Update the relevant component to call `t` (or
add a narrowly documented compatibility mapping), then run `npm run test:i18n`.
To add another locale, extend `UiLocale`, provide a complete catalog, add locale
parity tests, and audit direction, terminology, persistence, responsive layout,
and accessibility before exposing a switcher option.

## Audits and tests

`scripts/i18n-audit.mjs` parses catalogs and JSX/TSX UI labels. It reports missing
keys, duplicate keys, empty values, interpolation mismatches, English conflicts,
and Arabic literals that are not approved content/technical exceptions. The
shared Vitest suite covers parity, interpolation, plural/count patterns, and safe
content handling. Browser/Playwright checks cover language persistence, RTL
overflow, content-direction isolation, accessibility labels, and responsive
surfaces.

