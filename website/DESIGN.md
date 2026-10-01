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
  button-ink: "#1b1428"
  button-hover: "#cbb1f4"
  selected: "#33283f"
  field: "#15111b"
  field-border: "#665176"
typography:
  display:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "clamp(48px, 5.3vw, 76px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  display-arabic:
    fontFamily: "'LH Public Arabic', 'LH Public', sans-serif"
    fontSize: "clamp(36px, 3.6vw, 52px)"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "0"
  headline:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "clamp(32px, 3.6vw, 52px)"
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "24px"
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  body:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "17px"
    lineHeight: 1.85
  label:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  button:
    fontFamily: "'LH Public', 'LH Public Arabic', sans-serif"
    fontSize: "13px"
    fontWeight: 600
  dialogue:
    fontFamily: "'LH Public', sans-serif"
    fontSize: "clamp(22px, 2vw, 28px)"
    fontWeight: 500
    lineHeight: 1.6
  translation:
    fontFamily: "'LH Public Arabic', 'LH Public', sans-serif"
    fontSize: "clamp(22px, 2vw, 28px)"
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
    textColor: "{colors.button-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.8}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.button-hover}"
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
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    typography: "{typography.translation}"
    rounded: "{rounded.8}"
    padding: "12px 14px"
  format-tag:
    textColor: "{colors.accent-strong}"
    size: "13px"
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

- **Soft Violet (`accent`):** primary actions, the headline's final line and the live proof marker.
- **Pale Violet (`accent-strong`):** links, selected labels, syntax emphasis and keyboard focus.
- **Violet Hover (`button-hover`):** the primary action's hover fill.
- **Deep Violet Ink (`button-ink`):** readable text on the primary action.

### Neutral

- **Matte Ink (`bg`):** page and opaque sticky navigation background.
- **Proof Surface (`surface`):** the editor sheet, format guide and contextual example.
- **Raised Tone (`surface-2`):** hover feedback without spatial elevation.
- **Quiet Separator (`line`):** borders, dividers and action outlines.
- **Reading White (`text`):** headings, dialogue and primary copy.
- **Soft Gray (`soft`):** supporting copy and default navigation labels.
- **Muted Gray (`muted`):** helper text, source labels and annotations.
- **Selected Violet Ink (`selected`):** selected sample and format controls.
- **Field Ink (`field`) / Field Stroke (`field-border`):** the editable Arabic translation surface.

Validation success, warning and error colors remain functional feedback in the existing demonstration; they are not additional brand accents. Their exact state styles are captured in the sidecar examples.

**The Reading First Rule.** Decorative letters stay subdued behind readable content; violet identifies action and meaning rather than filling every surface.

## Typography

Schibsted Grotesk is self-hosted under the Latin alias `LH Public`; Noto Sans Arabic is self-hosted under `LH Public Arabic`. The active language determines stack order. Both use a sans-serif fallback, with additional script fallbacks only for decorative characters.

Display is confident and tightly set in English. Arabic uses its own display role, generous leading and neutral tracking; headings elsewhere also relax tracking and leading when Arabic is active. Dialogue and translation roles remain large enough to read as actual text rather than miniature software.

Use display for the hero, headline for section introductions, title for guide headings, body for the hero explanation, label for sample controls, and the dialogue/translation roles for editable proof. Other observed small annotation sizes are contextual component styles, not a new universal type scale. Phone-specific clamps and reading sizes remain in the runtime stylesheet.

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

A single solid bordered sheet holds sample controls, source dialogue, an editable Arabic field, protected-token guidance and live status. The frontmatter captures its shape and field roles; the sidecar captures borders, focus and responsive composition. The field retains automatic text direction, an explicit label, helper/status association and the existing reset action. Reset, sample selectors, language select, mobile menu and game-rune controls have a minimum 44px touch height. Primary explanatory prose is at least 16px on phones; compact metadata and helper labels remain smaller. The native language select shares the visible focus ring. Both above-the-fold font scripts are preloaded on the public landing only.

Validation distinguishes empty, valid, warning and error. Missing protected tokens receive their own conspicuous guide state, with text and symbol feedback as well as color. Preserve the actual validation behavior and source/translation content.

### Context, notes and disclosure rows

The context example uses a tonal surface with open internal rows. Tips retain their existing controls and content; FAQ and extraction disclosures retain keyboard-operable summaries. Their behaviors are incumbent product features, not a new component API.

### Language field

Static, composed multilingual characters decorate the background. The implementation repeats a deterministic character arrangement across document bands, mirrors placement between bands and reduces the visible set on phones. It is aria-hidden, unselectable and pointer-transparent, stays stable during hydration and disappears in forced colors. Do not turn this into a moving canvas or a foreground reading task.

## Do's and Don'ts

### Do:

- Do keep the public system scoped to its canonical runtime owner.
- Do preserve readable English and Arabic, visible focus and narrow-screen reflow.
- Do use real editable dialogue and protected-token states as product proof.
- Do keep multilingual decoration deterministic, subdued and noninteractive.
- Do preserve factual copy, existing tips, secret interactions and Radio behavior.

### Don't:

- Don't add game artwork, photos, gradients or glass to this chosen public landing world.
- Don't replace distinct section compositions with repeated card shells.
- Don't introduce reveal timing, looping animation or scroll-driven movement into the public reading flow.
- Don't propagate these tokens into the Web App, Admin, Radio or other routes.
- Don't treat local preview verification as human visual acceptance or publication.
