import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// A product stylesheet has to earn every class it declares: a rule whose class
// no code names is either dead weight in the shipped bundle or a class the code
// lost. The cleanup that removed the legacy editor family was manual; this is
// the check that keeps the next dead family from being found by hand, recorded
// in DESIGN.md beside the one-owner lock.
//
// The guard reads TypeScript syntax trees rather than raw text, so a class
// counts as named only where it can reach the DOM or query it: a JSX
// className/class attribute, a classList mutation, a className assignment, a
// class attribute or a DOM/Playwright selector and class assertion. A word in
// a comment, a translation string or a file name no longer shelters a dead
// rule.
const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
// Both applications ship their own src tree plus the packages they import
// (today the i18n stylesheet); call sites are any website, desktop, package or
// e2e source that names a class.
const stylesheetRoots = ['website/src', 'frontend/src', 'packages']
const sourceRoots = ['website/src', 'frontend/src', 'packages', 'tests']
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', 'target', '.git'])

// Class families the code completes at runtime, so no literal token exists to
// find. Each entry stays excused only while a template literal still builds it
// and a declared class still needs it: the second guard fails on a family that
// lost its builder, on one nothing declares, and on a new family that starts
// excusing declared classes without being listed here.
const runtimeFamilies = [
  'direction-', // EditorPanel: `direction-${direction}`
  'empty-', // ExperienceState: `empty-${kind}`
  'er-cat-', // ExtractionReview: `er-cat-${entry.classification.toLowerCase()}`
  'er-conf-', // ExtractionReview: `er-conf-${detection.confidence}`
  'er-diag-', // ExtractionReview: `er-diag-${diagnostic.kind}`
  'er-sev-', // ExtractionReview: `er-sev-${diagnostic.severity}`
  'footprint-', // EditorPanel: `footprint-${footprint.tone}`
  'is-', // LiveEditorPreview: `preview-check is-${state}`
  'match-', // AdminConsole: `match-${item.state}`
  'mob-status-', // EditorPanel: `mob-status-${status}`
  'project-mark-', // ProjectMark: `project-mark-${size}`
  'qa-', // EditorPanel: `qa-${issue.severity}`
  'save-', // Workspace and MobileWorkspace: `save-${saveState}`
  'skeleton-', // ExperienceState: `skeleton-${variant}`
  'state-', // EntriesPanel: `state-${statusLabel(view).toLowerCase()}`
  'td-', // ToolsDependencies: `td-status td-${status}`
  'toast-', // Toast: `toast toast-${toast.type}`
  'tone-', // LanguageField: `tone-${glyph.tone}`
]

// Classes a state value completes without a prefix, where the value is a word
// the code holds as a string literal somewhere (a workflow status, a
// collaboration state, a project location). Each entry stays excused only
// while that literal still exists in the source, so a removed state cannot
// leave its rule behind.
const runtimeStates = [
  'bulk', // ProjectWorkflowTools: activeTab
  'cloud', // App: project-location-badge {cloud}
  'connected', // WorkspaceCollaborationStatus: collaboration status
  'connecting', // WorkspaceCollaborationStatus: collaboration status
  'disconnected', // WorkspaceCollaborationStatus: collaboration status
  'error', // EntryStatusIndicator: token error
  'protected', // EntryStatusIndicator: protected source
  'quality', // ProjectWorkflowTools: activeTab
  'reconnecting', // WorkspaceCollaborationStatus: collaboration status
  'translated', // EntryStatusIndicator: workflow status
  'untranslated', // EntryStatusIndicator: workflow status
  'warning', // EntryStatusIndicator: token warning
  'workflow', // ProjectWorkflowTools: activeTab
]

// Classes a dependency injects into its own DOM, which our stylesheet restyles
// but our code never spells. Each entry stays excused only while the installed
// dependency still ships the name, so a CodeMirror upgrade that renames one
// fails here instead of silently orphaning the rule.
const externalClasses: Record<string, string[]> = {
  'node_modules/@codemirror/view/dist/index.js': [
    'cm-activeLine',
    'cm-content',
    'cm-cursor',
    'cm-editor',
    'cm-focused',
    'cm-gutters',
    'cm-line',
    'cm-placeholder',
    'cm-scroller',
    'cm-selectionBackground',
  ],
}

const selectorApis = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches', 'getElementsByClassName', 'locator'])
const classListApis = new Set(['add', 'remove', 'toggle', 'contains', 'replace'])
const classAssertions = new Set(['toHaveClass'])

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

type Naming = { classes: Set<string>; families: Set<string>; literals: Set<string> }

function addTokens(text: string, naming: Naming) {
  for (const token of text.split(/\s+/)) if (token) naming.classes.add(token)
}

// A selector carries class names after a dot: '.entry-row', '.a .b:focus'.
function addSelector(text: string, naming: Naming) {
  for (const match of text.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) naming.classes.add(match[1])
}

// A regex class assertion carries bare words: /selected/, /is-empty|is-valid/.
function addAssertion(text: string, naming: Naming) {
  for (const match of text.matchAll(/[A-Za-z_][\w-]*/g)) naming.classes.add(match[0])
}

// Walk a value that ends up in a class list and pull out every literal token,
// treating a hyphen-terminated fragment glued to an interpolation as the
// runtime family it builds (`mob-status-${status}` builds the mob-status-*).
function harvestValue(node: ts.Node | undefined, naming: Naming, helpers: Map<string, string[]>): void {
  if (!node) return
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addTokens(node.text, naming)
    return
  }
  if (ts.isTemplateExpression(node)) {
    const quasis = [node.head, ...node.templateSpans.map((span) => span.literal)]
    quasis.forEach((quasi, index) => {
      const tokens = quasi.text.split(/\s+/).filter(Boolean)
      const gluesRight = index < quasis.length - 1 && !/\s$/.test(quasi.text)
      tokens.forEach((token, tokenIndex) => {
        const isLastToken = tokenIndex === tokens.length - 1
        if (gluesRight && isLastToken && /^[a-z][\w-]*-$/.test(token)) naming.families.add(token)
        else naming.classes.add(token)
      })
    })
    for (const span of node.templateSpans) harvestValue(span.expression, naming, helpers)
    return
  }
  if (ts.isConditionalExpression(node)) {
    harvestValue(node.whenTrue, naming, helpers)
    harvestValue(node.whenFalse, naming, helpers)
    return
  }
  if (ts.isBinaryExpression(node)) {
    harvestValue(node.left, naming, helpers)
    harvestValue(node.right, naming, helpers)
    return
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) || ts.isJsxExpression(node) || ts.isTypeAssertionExpression(node)) {
    harvestValue(node.expression, naming, helpers)
    return
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) harvestValue(element, naming, helpers)
    return
  }
  if (ts.isCallExpression(node)) {
    for (const argument of node.arguments) harvestValue(argument, naming, helpers)
    const callee = node.expression
    if (ts.isIdentifier(callee) && helpers.has(callee.text)) addTokens(helpers.get(callee.text)!.join(' '), naming)
    if (ts.isPropertyAccessExpression(callee)) {
      if (ts.isIdentifier(callee.name) && helpers.has(callee.name.text)) addTokens(helpers.get(callee.name.text)!.join(' '), naming)
      // `.trim()`, `.join(' ')` and `.filter(Boolean)` wrap the real list.
      harvestValue(callee.expression, naming, helpers)
    }
    return
  }
  if (ts.isIdentifier(node)) {
    if (helpers.has(node.text)) addTokens(helpers.get(node.text)!.join(' '), naming)
    return
  }
  if (ts.isPropertyAccessExpression(node)) {
    harvestValue(node.expression, naming, helpers)
    return
  }
}

function harvestSelector(node: ts.Node | undefined, naming: Naming): void {
  if (!node) return
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addSelector(node.text, naming)
    return
  }
  if (ts.isTemplateExpression(node)) {
    addSelector(node.head.text, naming)
    for (const span of node.templateSpans) {
      addSelector(span.literal.text, naming)
      harvestSelector(span.expression, naming)
    }
    return
  }
  if (ts.isConditionalExpression(node)) {
    harvestSelector(node.whenTrue, naming)
    harvestSelector(node.whenFalse, naming)
    return
  }
  if (ts.isBinaryExpression(node)) {
    harvestSelector(node.left, naming)
    harvestSelector(node.right, naming)
    return
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
    harvestSelector(node.expression, naming)
    return
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) harvestSelector(element, naming)
  }
}

function harvestAssertion(node: ts.Node | undefined, naming: Naming): void {
  if (!node) return
  if (ts.isRegularExpressionLiteral(node)) {
    addAssertion(node.text.replace(/^\//, '').replace(/\/[a-z]*$/, ''), naming)
    return
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addTokens(node.text, naming)
    return
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) harvestAssertion(element, naming)
  }
}

// A helper named `*Class` (statusDotClass returns 'dot-error', 'dot-approved')
// hands a class list to a template literal; its string literals are class
// names, so harvest them from the declaration.
function helperStrings(node: ts.Node | undefined, sink: string[]): void {
  if (!node) return
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) sink.push(node.text)
  ts.forEachChild(node, (child) => helperStrings(child, sink))
}

function readNaming(text: string, fileName: string): Naming {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const naming: Naming = { classes: new Set(), families: new Set(), literals: new Set() }
  const helpers = new Map<string, string[]>()
  const collectHelpers = (node: ts.Node) => {
    const named = ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)
    if (named && node.name && ts.isIdentifier(node.name) && node.name.text.endsWith('Class')) {
      const strings: string[] = []
      helperStrings(ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ? node.body : node.initializer, strings)
      helpers.set(node.name.text, strings)
    }
    ts.forEachChild(node, collectHelpers)
  }
  collectHelpers(source)
  const visit = (node: ts.Node) => {
    // Every string literal is remembered so a runtime state can be checked
    // against the code that is supposed to hold it.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) naming.literals.add(node.text)
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && (node.name.text === 'className' || node.name.text === 'class')) {
      harvestValue(node.initializer, naming, helpers)
    }
    // A `class:` property hands a class to a library that writes it into the
    // DOM itself (CodeMirror's Decoration.mark, for one).
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && (node.name.text === 'class' || node.name.text === 'className')) {
      harvestValue(node.initializer, naming, helpers)
    }
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.EqualsToken || node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'className') {
      harvestValue(node.right, naming, helpers)
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const calleeName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name) ? callee.name.text : ''
      if (selectorApis.has(calleeName)) harvestSelector(node.arguments[0], naming)
      if (classAssertions.has(calleeName)) harvestAssertion(node.arguments[0], naming)
      if (calleeName === 'setAttribute' && ts.isStringLiteral(node.arguments[0]) && (node.arguments[0].text === 'class' || node.arguments[0].text === 'className')) {
        harvestValue(node.arguments[1], naming, helpers)
      }
      if (classListApis.has(calleeName) && ts.isPropertyAccessExpression(callee) && callee.expression.getText(source).endsWith('classList')) {
        harvestValue(node.arguments[0], naming, helpers)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return naming
}

const stylesheets = stylesheetRoots.flatMap((root) => walk(root, (name) => name.endsWith('.css')))
const sources = sourceRoots.flatMap((root) => walk(root, (name) => name.endsWith('.ts') || name.endsWith('.tsx')))
const namedClasses = new Set<string>()
const derivedFamilies = new Set<string>()
// A runtime state has to be held as a literal by a file that also builds a
// class from state, so the excuse cannot drift away from the value it names.
const groundedStates = new Set<string>()
for (const path of sources) {
  const text = readFileSync(join(projectRoot, path), 'utf8')
  const naming = readNaming(text, path)
  for (const token of naming.classes) namedClasses.add(token)
  for (const family of naming.families) derivedFamilies.add(family)
  if (naming.classes.size > 0 || naming.families.size > 0) for (const literal of naming.literals) groundedStates.add(literal)
}
const dependencyText = Object.fromEntries(
  Object.keys(externalClasses).map((path) => [path, readFileSync(join(projectRoot, path), 'utf8')]),
)
// Comments and strings are stripped first: `url('/fonts/x.woff2')` names a
// file, not a class.
const declaredClasses = stylesheets.flatMap((path) =>
  [...new Set([...readFileSync(join(projectRoot, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, ' ').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((match) => match[1]))]
    .map((token) => ({ path, token })),
)
const declaredTokens = new Set(declaredClasses.map(({ token }) => token))

describe('product stylesheets keep no orphan class', () => {
  it('finds every declared class named by a class context or a runtime family', () => {
    // A scan that stopped finding stylesheets or sources would pass vacuously.
    expect(stylesheets.length).toBeGreaterThan(10)
    expect(declaredClasses.length).toBeGreaterThan(500)
    expect(namedClasses.size).toBeGreaterThan(200)
    const orphans = declaredClasses
      .filter(({ token }) => !namedClasses.has(token) && !runtimeFamilies.some((family) => token.startsWith(family)) && !runtimeStates.includes(token) && !Object.values(externalClasses).some((names) => names.includes(token)))
      .map(({ path, token }) => `${path}: .${token}`)
    expect(orphans).toEqual([])
  })

  it('keeps every runtime class family tied to a builder and a declared class', () => {
    const unbuilt = runtimeFamilies.filter((family) => !derivedFamilies.has(family))
    const unused = runtimeFamilies.filter((family) => !declaredClasses.some(({ token }) => token.startsWith(family)))
    // A family that starts excusing declared classes has to be listed, with the
    // builder it comes from, instead of quietly widening the exemption.
    const unlisted = [...derivedFamilies].filter((family) => !runtimeFamilies.includes(family) && declaredClasses.some(({ token }) => token.startsWith(family)))
    expect({ unbuilt, unused, unlisted }).toEqual({ unbuilt: [], unused: [], unlisted: [] })
  })

  it('keeps every runtime state and external class tied to its source', () => {
    const ungroundedStates = runtimeStates.filter((state) => !groundedStates.has(state))
    const unusedStates = runtimeStates.filter((state) => !declaredTokens.has(state))
    const staleExternal = Object.entries(externalClasses).flatMap(([path, names]) => names.filter((name) => !dependencyText[path].includes(name)).map((name) => `${path}: ${name}`))
    const unusedExternal = Object.values(externalClasses).flat().filter((name) => !declaredTokens.has(name))
    expect({ ungroundedStates, unusedStates, staleExternal, unusedExternal }).toEqual({ ungroundedStates: [], unusedStates: [], staleExternal: [], unusedExternal: [] })
  })
})
