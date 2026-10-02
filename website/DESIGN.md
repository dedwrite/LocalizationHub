---
name: "LocalizationHub public website"
description: "A picture-free bilingual language field in matte ink and violet."
colors:
  bg: "#111016"
  surface: "#1b1823"
  surface-2: "#24202e"
  line: "#3b3449"
  text: "#f0edf5"
  soft: "#c4becf"
  muted: "#aca3bb"
  accent: "#b9a0ed"
  accent-strong: "#d7c3f7"
  accent-ink: "#1b1428"
  selected: "#33283f"
  glyph: "#4a3b64"
  success: "#87c5a0"
  danger: "#e8897f"
# One family and one mono family, both self-hosted under /fonts. No public
# surface may request a third-party font host or fall back to a different
# typeface. The eight steps below are the only font sizes the landing uses.
typography:
  scale:
    fs-1: "12px"
    fs-2: "13px"
    fs-3: "16px"
    fs-4: "20px"
    fs-5: "24px"
    fs-6: "32px"
    fs-7: "clamp(32px, 3.6vw, 52px)"
    fs-8: "clamp(48px, 5.3vw, 76px)"
  display:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "{typography.scale.fs-8}"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  display-arabic:
    fontFamily: "'LH Public Arabic', 'LH Public', sans-serif"
    fontSize: "{typography.scale.fs-7}"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "0"
  headline:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "{typography.scale.fs-7}"
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "{typography.scale.fs-5}"
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  body:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "{typography.scale.fs-3}"
    lineHeight: 1.8
  label:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "{typography.scale.fs-1}"
    fontWeight: 500
    lineHeight: 1.5
  button:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "{typography.scale.fs-2}"
    fontWeight: 600
  dialogue:
    fontFamily: "'LH Public', sans-serif"
    fontSize: "{typography.scale.fs-5}"
    fontWeight: 500
    lineHeight: 1.6
  translation:
    fontFamily: "'LH Public Arabic', 'LH Public', sans-serif"
    fontSize: "{typography.scale.fs-5}"
    fontWeight: 500
    lineHeight: 1.9
rounded:
  "6": "6px"
  "8": "8px"
  "12": "12px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "18": "18px"
  "24": "24px"
  "32": "32px"
  "40": "40px"
  "72": "72px"
  public-gutter: "clamp(20px, 4vw, 72px)"
  public-space: "clamp(56px, 6vw, 88px)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.8}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-quiet:
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.8}"
    padding: "12px 18px"
  button-quiet-hover:
    backgroundColor: "{colors.surface-2}"
  navigation-link:
    textColor: "{colors.soft}"
    rounded: "{rounded.6}"
    padding: "10px"
  navigation-link-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
  sample-selector:
    textColor: "{colors.soft}"
    typography: "{typography.label}"
    rounded: "{rounded.6}"
    padding: "10px 16px"
  sample-selector-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.accent-strong}"
  translation-field:
    backgroundColor: "{colors.bg}"
    borderColor: "{colors.line}"
    textColor: "{colors.text}"
    typography: "{typography.translation}"
    rounded: "{rounded.8}"
    padding: "12px 14px"
  format-tag:
    textColor: "{colors.accent-strong}"
    size: "{typography.scale.fs-2}"
  proof-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.12}"
    padding: "24px 32px"
---

# Design System: LocalizationHub public website

## Overview

**Creative North Star: "The Language Field"**

Words are both the work and the identity. The public landing page uses matte ink, restrained violet and readable bilingual typography, with composed multilingual letters as its decorative material. Its character is quiet, direct and spacious: real dialogue, context and protected syntax carry the product proof.

This document records the implemented public landing system owned by `src/public-site.css`, scoped to `#public-site`. It does not define the Web App, Admin, Radio or other routes. Preserve the LocalizationHub name and existing logo, factual copy, existing interactive demonstrations, all tips and secret interactions, and Radio behavior.

The user pinned the picture-free dark/violet direction and requested multilingual background letters. On 2026-10-01 they requested a stronger composition, allowing a rebuild of the public website. The existing palette and font identity remain; composition was amplified and validated locally. Human visual acceptance is pending, and no publication has occurred.

**Key Characteristics:**

- Picture-free typographic identity.
- Humanist Latin and Arabic reading quality.
- Solid, flat proof surfaces and measured separators.
- Stable, noninteractive multilingual decoration.
- Real editable demonstrations with visible states.

## Colors

Violet accents sit within an ink and gray family; descriptive roles below refer to the normative frontmatter rather than redefining their values.

### Primary

- **Soft Violet (`accent`):** primary actions, the headline's final line, the live proof marker and every decorative letter in the language field.
- **Pale Violet (`accent-strong`):** links, selected labels, syntax emphasis and keyboard focus.
- **Deep Violet Ink (`accent-ink`):** readable text on the accent fill, and the text selection colour.

### Neutral

- **Matte Ink (`bg`):** page, the editable translation field and the opaque navigation background.
- **Proof Surface (`surface`):** the editor sheet, format guide, surface cards, tip card and contextual example.
- **Raised Tone (`surface-2`):** hover feedback without spatial elevation.
- **Quiet Separator (`line`):** borders, dividers, the editable field's stroke and the scrollbar thumb.
- **Reading White (`text`):** headings, dialogue and primary copy.
- **Soft Gray (`soft`):** supporting copy and default navigation labels.
- **Muted Gray (`muted`):** helper text, source labels and annotations.
- **Selected Violet Ink (`selected`):** selected sample, format and entry controls, and the inline mark behind protected tokens.
- **Language Field Ink (`glyph`):** the decorative multilingual background, separated from reading content by opacity alone.

### Feedback

- **Verified Green (`success`):** a passing protected-token check and the live status dot. It is never decoration.
- **Attention Red (`danger`):** a missing protected token. It always appears with text and an icon, not colour alone.

**The Colour Lock.** These fourteen roles are declared once, at the top of `src/public-site.css`, and nothing below that block uses a raw colour value. A new colour is not a style decision to make in passing; it is a new role that has to earn a name, be added to this list and be justified here first. The public landing currently paints fourteen distinct text colours, which is the count of the list and not a coincidence.

**The Type, Shape and Family Locks.** `tests/e2e/public-tokens.spec.ts` reads every rule that addresses `#public-site` and then every node the landing renders. No rule may declare a raw colour, a px font size, a px corner, a family outside `--font-ui` / `--font-arabic` / `--font-mono` (the decorative field's fallback stack is named once as `--font-glyph`) or a box shadow; no visible text may render below 12px; and every painted text colour, background and corner must be a declared role or step.

**The One Owner Lock.** The same suite reads every stylesheet under `website/src` and fails when a file other than `src/public-site.css` mentions a landing selector — its scope `#public-site`, its root or one of its section classes — or when a file other than `src/styles.css` mentions an inner-page selector of the download and legal routes (`download-*`, `panel-kicker`, `document-page`, `not-found`). Two files writing the same rule is how a contradicting second set of styles grew here once already, so a shared layer that needs a rule moves it into the owner instead of overriding it — the fluid spacing and corner tokens those routes use are declared in `styles.css` for the same reason.

**The Live Class Rule.** Every class a product stylesheet declares must be named by the code that ships it — literally, or through one of the runtime families the workspace completes from state (a save state, a QA severity, a project size). `website/tests/deadClasses.test.ts` fails on a class no call site names, and on a runtime family whose template-literal builder or last declared class has disappeared, so the allowlist cannot outlive the code it excuses. A layer cleanup is finished only when this guard is quiet; that is what keeps a deleted family from returning as silent weight.

**The Reading First Rule.** Decorative letters stay subdued behind readable content; violet identifies action and meaning rather than filling every surface.

## Typography

Schibsted Grotesk is self-hosted under the Latin alias `LH Public`; Noto Sans Arabic is self-hosted under `LH Public Arabic`. The active language determines stack order. Both use a sans-serif fallback. The decorative language field is the only rule allowed a longer fallback stack, kept beside the palette as `--font-glyph`, and its glyph sizes are multiples of the `fs-5` step rather than a new size per character.

Display is confident and tightly set in English. Arabic uses its own display role, generous leading and neutral tracking; headings elsewhere also relax tracking and leading when Arabic is active. Dialogue and translation roles remain large enough to read as actual text rather than miniature software.

Use display for the hero, headline for section introductions, title for guide headings, body for the hero explanation, label for sample controls, and the dialogue/translation roles for editable proof.

The eight steps in `{typography.scale}` are the only font sizes the landing declares, and every one of them is reachable through a `--fs-*` custom property. Nothing on the public landing renders below 12px: small type is a hierarchy decision made with colour, spacing and weight, not with a smaller number. Phone clamps reuse the same steps rather than introducing new ones, and the mono family is reserved for machine-readable values such as keys, formats, file names and step markers.

One family and one mono family are shipped, both self-hosted under `/fonts`. No public page requests Google Fonts or any other font host, so the claim that a file never leaves the machine is not contradicted by the page that makes it.

**The Script Integrity Rule.** Do not apply English tracking or line-height to Arabic; preserve text direction and isolate protected syntax when it shares a line with Arabic.

## Layout

A centered reading container uses the runtime `--public-width` cap (1200px), the frontmatter's public gutter and public section rhythm. The solid bordered header has a wider cap (1280px), 72px desktop height and a 12px sticky offset. These are public landing measurements, not application layout defaults.

The hero connects headline, explanation and actions in one column beside an editable proof sheet; both are visible in the first desktop viewport. The proof stacks source and translation within its own column. The format guide combines a side selector with a selected result, the context section compares English and Arabic side by side, review features use open two-column groupings, local/cloud uses contrasting solid/outlined surfaces, and notes and FAQ retain their own compositions. Preserve these distinct arrangements rather than repeating one section template.

At the navigation breakpoint, the full navigation gives way to the existing mobile disclosure. At the phone breakpoint, the hero and context become single-column layouts, format controls wrap, gutters narrow and spacing relaxes. The language select keeps 16px type. Below 350px only the existing logo is visible in the header; the full brand name remains in the accessibility tree so the language control and menu fit without overflow. Use logical properties for reading layouts; the decorative field deliberately keeps the same physical geometry in LTR and RTL.

## Elevation & Depth

The scoped public system uses no box shadows. Solid tonal surfaces, boundaries and layering create depth. The header is opaque; there is no glass, glow or gradient treatment. The composed letter field sits behind the main reading layer and cannot intercept input.

**The Flat Proof Rule.** Interactive demonstrations remain steady sheets; hover changes tone and border rather than lifting or tilting the surface.

Public content does not depend on reveal timing. Decorative characters do not animate, reduced-motion mode removes transitions, and forced-colors mode omits the decorative field.

## Shapes

Controls use the compact rounded step; primary and quiet actions and translation fields use the middle step; proof, format and tip surfaces use the larger step. Section rows and separators stay square and flat. The existing logo keeps its original asset within a compact rounded frame.

Use rounded containers where they hold a real interactive or contextual surface. Repeated features, FAQ rows and public choices use open layouts and separators, avoiding competing shells.

## Components

### Buttons

Confident and restrained. The primary action combines Soft Violet and Deep Violet Ink; its hover sibling supplies the brighter fill. Quiet actions use an outlined transparent treatment and a Raised Tone hover. Both use the normative button role and shape. Keyboard focus uses a visible Pale Violet outline (2px) with an offset (4px); no hover translation is applied.

### Navigation

A quiet horizontal row with compact rounded link hit areas. Default labels use Soft Gray; hover adds Raised Tone and Reading White. The existing language selector, command launcher and mobile disclosure retain their behavior. Mobile disclosure replaces the full row at the recorded breakpoint.

### Selectors and format tags

Sample and format controls are buttons with real pressed state. Selected Violet Ink and Pale Violet identify the active choice; hover uses Raised Tone and Reading White. Format names are unboxed inline labels, not invented clickable chips.

### Proof sheet and translation field

A single solid bordered sheet holds sample controls, source dialogue, an editable Arabic field, protected-token guidance and live status. The frontmatter captures its shape and field roles; the sidecar captures borders, focus and responsive composition. The field retains automatic text direction, an explicit label, helper/status association and the existing reset action. Reset, sample selectors, language select, mobile menu and game-rune controls have a minimum 44px touch height. Primary explanatory prose is at least 16px on phones, and no public text renders below 12px. The native language select shares the visible focus ring. Both above-the-fold font scripts are preloaded on the public landing only.

Validation distinguishes empty, valid, warning and error. Missing protected tokens receive their own conspicuous guide state, with text and symbol feedback as well as color. Preserve the actual validation behavior and source/translation content.

### Context, notes and disclosure rows

The context example uses a tonal surface with open internal rows. Tips retain their existing controls and content; FAQ and extraction disclosures retain keyboard-operable summaries. Their behaviors are incumbent product features, not a new component API.

### Language field

Static, composed multilingual characters decorate the background. The implementation repeats a deterministic character arrangement across document bands, mirrors placement between bands and reduces the visible set on phones. It is aria-hidden, unselectable and pointer-transparent, stays stable during hydration and disappears in forced colors. Do not turn this into a moving canvas or a foreground reading task.

## Do's and Don'ts

### Do:

- Do keep the public system scoped to its canonical runtime owner, and keep shared layers free of landing selectors so that ownership stays checkable.
- Do use the eight type steps, the fourteen colour roles and the three corner steps, and nothing else.
- Do check a new rule at 360px and with `prefers-reduced-motion: reduce` before calling it done.
- Do preserve readable English and Arabic, visible focus and narrow-screen reflow.
- Do use real editable dialogue and protected-token states as product proof.
- Do keep multilingual decoration deterministic, subdued and noninteractive.
- Do preserve factual copy, existing tips, secret interactions and Radio behavior.

### Don't:

- Don't add a colour, a font size, a corner radius or a font family outside the declared lists; the token guard in `tests/e2e/public-tokens.spec.ts` fails the suite instead of the reader noticing later.
- Don't add a second public skin. `#public-site` is the only owner of the landing's appearance, and `styles.css` holds only the shared shell, the fluid rhythm tokens, the download and legal routes and the reveal system.
- Don't style a public surface from a shared layer that the application also uses, and don't reach for a new `!important` to settle a conflict between layers. The one-owner check fails on any landing selector outside `public-site.css` and on any download or legal selector outside `styles.css`.
- Don't leave a class in a product stylesheet that no code names, and don't grow a runtime class family without telling the guard. The class guard in `website/tests/deadClasses.test.ts` fails on orphans and on exemptions that lost their builder.
- Don't rely on a glyph from a font we do not ship. Icons come from `src/components/Icon.tsx`.
- Don't add game artwork, photos, gradients or glass to this chosen public landing world.
- Don't replace distinct section compositions with repeated card shells.
- Don't introduce reveal timing, looping animation or scroll-driven movement into the public reading flow.
- Don't propagate these tokens into the Web App, Admin, Radio or other routes.
- Don't treat local preview verification as human visual acceptance or publication.
