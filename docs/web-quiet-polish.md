# Quiet polish — v0.9.4

Restrained Web App refinements that build on v0.9.3 Web Delight without adding
noise, theme gimmicks, or Radio/Cloud/token behavior changes.

## Surfaces

- `website/src/delight/CommandPalette.tsx` — palette + shortcuts center
- `website/src/delight/projectIdentity.ts` — deterministic accent/glyph
- `website/src/delight/EmptyState.tsx`, `PageSkeleton.tsx`
- `website/src/delight/QualityCelebration.tsx`, `LengthCue.tsx`
- `website/src/delight/TimeGreeting.tsx`, `behaviorSecrets.ts`
- `website/src/delight/quiet-polish.css`

## Boundaries

- No database migration
- No Radio playback changes
- No Cloud authorization changes
- Motion disabled under `prefers-reduced-motion`
