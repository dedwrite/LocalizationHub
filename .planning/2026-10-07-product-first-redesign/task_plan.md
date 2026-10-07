# Product-first redesign — 2026-10-07

## Goal
Audit the existing ecosystem; implement shared foundations and Figma V3 Home only, then stop for human review. No production deployment.

## Next Step
Ask for review of the audit's written foundations/Home design and private GitHub action treatment before implementation, per brainstorming architectural gate.

## Current Phase
Phase 1: Design and plan

## Phases
### Phase 0: Audit
- **Status:** complete
- Inventory routes, components, auth, emails, player, desktop, GitHub, Render and approved Figma.
### Phase 1: Design and plan
- **Status:** in_progress
- Record architecture, Home migration and review gate.
### Phase 2: Foundations
- **Status:** pending
- Shared tokens, typography, primitives, direction and motion, with no broad theme activation.
### Phase 3: Home
- **Status:** pending
- V3 nodes 8:3 / 8:83 / 8:163; real links and responsive demo.
### Phase 4: Verify and handoff
- **Status:** pending
- EN/AR, responsive, motion, keyboard, accessibility, regression tests; local preview and coherent commits; no deployment.

## Decisions Made
- npm/React/Vite/Tauri architecture stays.
- Branch design/full-product-redesign, baseline 09478fb.
- No DB writes, migrations, secrets or infrastructure changes.

## Errors Encountered
- Initial apply_patch used delete/add on same files: rejected atomically; use whole-file update hunks.
- Figma page list reports only Page 1; supplied V3 IDs return correct full contexts. Verify explicit nodes rather than names.
- Windows rg literal wildcard paths and two assumed filenames did not exist; switched to discovered files and -g patterns. No product mutation resulted.
