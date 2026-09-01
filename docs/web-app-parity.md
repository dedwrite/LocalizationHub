# App parity — v0.9.6

Quiet Desktop/Web parity refinements.

## Surfaces

- Dialogue chips: `frontend/src/DialogueContextStrip.tsx`, `website/src/workspace/EditorPanel.tsx`
- DeepL proxy: `collaboration-server/mt-deepl.mjs`, `website/src/workspace/translationProviders.ts`
- Desktop Radio: `frontend/src/lhRadio/`, `frontend/src/radioApi.ts`
- Language control: footer on public pages, `.is-dock` on app/desktop shells

## Boundaries

- No database migration
- DeepL proxy never logs or stores keys/text
- Radio fails quiet when offline
- Local project files are never uploaded for MT
