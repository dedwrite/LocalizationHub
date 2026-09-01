# Quiet workflow — v0.9.5

Restrained workflow refinements on top of Quiet Polish.

## Surfaces

- `website/src/delight/entryJump.ts` — search-driven palette jumps
- `website/src/delight/glossaryHints.ts` + `GlossaryHint.tsx`
- `website/src/delight/exportChecklist.ts` + `ExportChecklistDialog.tsx`
- `website/src/delight/pulseState.ts` + `SessionPulse.tsx`
- Dynamic providers in `quietCommands.ts`

## Boundaries

- No database migration
- No Radio playback changes
- No Cloud authorization changes
- Glossary notes never auto-write translations
- Export checklist never blocks export hard
