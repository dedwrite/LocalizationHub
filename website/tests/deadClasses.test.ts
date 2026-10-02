import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A product stylesheet has to earn every class it declares: a rule whose class
// no code names is either dead weight in the shipped bundle or a class the code
// lost. The cleanup that removed the legacy editor family was manual; this is
// the check that keeps the next dead family from being found by hand, recorded
// in DESIGN.md beside the one-owner lock.
const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
// The website ships its own src tree plus the packages it imports (today the
// i18n stylesheet); call sites are any website, package or e2e source that
// names a class.
const stylesheetRoots = ['website/src', 'packages']
const sourceRoots = ['website/src', 'packages', 'tests']
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', 'target', '.git'])

// Class families the code completes at runtime, so no literal token exists to
// find. Each entry stays excused only while a template literal still builds it
// and a declared class still needs it: losing either fails the second guard
// instead of letting the allowlist shelter dead CSS.
const runtimeFamilies = [
  'direction-', // EditorPanel: `direction-${direction}`
  'empty-', // ExperienceState: `empty-${kind}`
  'footprint-', // EditorPanel: `footprint-${footprint.tone}`
  'match-', // AdminConsole: `match-${item.state}`
  'mob-status-', // EditorPanel: `mob-status-${status}`
  'project-mark-', // ProjectMark: `project-mark-${size}`
  'qa-', // EditorPanel: `qa-${issue.severity}`
  'save-', // Workspace and MobileWorkspace: `save-${saveState}`
  'skeleton-', // ExperienceState: `skeleton-${variant}`
  'state-', // EntriesPanel: `state-${statusLabel(view).toLowerCase()}`
  'tone-', // LanguageField: `tone-${glyph.tone}`
]

function walk(root: string, keep: (name: string) => boolean): string[] {
  const files: string[] = []
  for (const entry of readdirSync(join(projectRoot, root), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = `${root}/${entry.name}`
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...walk(path, keep))
    } else if (keep(entry.name)) files.push(path)
  }
  return files
}

const stylesheets = stylesheetRoots.flatMap(root => walk(root, name => name.endsWith('.css')))
const code = sourceRoots
  .flatMap(root => walk(root, name => name.endsWith('.ts') || name.endsWith('.tsx')))
  .map(path => readFileSync(join(projectRoot, path), 'utf8'))
  .join('\n')
// A token is named only when the code keeps it as its own hyphenated word;
// `entry-row` may not be satisfied by `my-entry-row`.
const namedInCode = new Set(code.match(/[\w-]+/g) ?? [])
const declaredClasses = stylesheets.flatMap(path =>
  [...new Set([...readFileSync(join(projectRoot, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.-?([A-Za-z_][\w-]*)/g)].map(match => match[1]))]
    .map(token => ({ path, token })),
)

describe('product stylesheets keep no orphan class', () => {
  it('finds every declared class named by the code or a runtime family', () => {
    // A scan that stopped finding stylesheets or sources would pass vacuously.
    expect(stylesheets.length).toBeGreaterThan(10)
    expect(declaredClasses.length).toBeGreaterThan(500)
    expect(namedInCode.size).toBeGreaterThan(1000)
    const orphans = declaredClasses
      .filter(({ token }) => !namedInCode.has(token) && !runtimeFamilies.some(family => token.startsWith(family)))
      .map(({ path, token }) => `${path}: .${token}`)
    expect(orphans).toEqual([])
  })

  it('keeps every runtime class family tied to a builder and a declared class', () => {
    const stale = runtimeFamilies.flatMap(family => {
      const reasons = [
        code.includes(`${family}\${`) ? '' : 'no template literal builds it',
        declaredClasses.some(({ token }) => token.startsWith(family)) ? '' : 'no declared class needs it',
      ].filter(Boolean)
      return reasons.length ? [`${family} (${reasons.join('; ')})`] : []
    })
    expect(stale).toEqual([])
  })
})
