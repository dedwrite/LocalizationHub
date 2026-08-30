import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const uiRoots = ['frontend/src', 'website/src']
const localizedAttributes = new Set(['aria-label', 'aria-description', 'placeholder', 'title'])
const properNounExemptions = new Set([
  'LocalizationHub', 'LH Radio', 'LH RADIO', 'GitHub', 'Releases', 'DEDWRITE',
  'Godot', 'Unity', 'Unreal', 'Unreal Engine', 'Steam', 'Spotify', 'YouTube',
  'Google Authenticator', 'Google Cloud Translation', 'Gemini · Google AI Studio', 'DeepL',
  'JSON', 'CSV', 'PO', 'POT', 'PCK', 'LOCRES', 'LOCMETA', 'UAsset', 'MP3', 'ID3',
  'TOTP', 'MFA', 'RTL', 'API', 'Token', 'Generic', 'Auto', 'Codec', 'Smart Match ·',
  'English', 'العربية', 'Windows x64', 'WINDOWS X64', 'LH', 'MT', 'UI', 'A', 'B',
  'Ctrl', 'S', 'Enter', 'Shift', 'Alt', 'LH-ABC123', 'ABCD-EFGH-JKLM-NPQR',
  'https://open.spotify.com/track/...', 'LocalizationHub_0.9.2_x64-setup.exe',
  'JSON · CSV · PO · LH Project', 'JSON · CSV · PO · GAME FOLDERS',
  'LOCALIZATIONHUB /', 'ms',
])
const contentExemptions = new Set([
  'menu.settings', '12 / 48', 'Friday · 11:59 PM', 'Developer', 'Translator',
  'Adjust the game settings', 'ضبط إعدادات اللعبة', 'Assigned to samira',
  'Check the tone against the glossary.', 'v0.2', '01', '02', '03', '04', '05',
  'new lines before', 'midnight', '"هوتفكس بسيط. بس', 'سطر جديد قبل', 'منتصف الليل',
  'Motion:', 'Pointer:', 'Registered:', 'Revealed:',
])

function walk(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(absolute))
    else files.push(absolute)
  }
  return files
}

function catalogEntries() {
  const messageDirectory = path.join(repositoryRoot, 'packages/i18n/src/messages')
  const entries = []
  for (const file of walk(messageDirectory).filter((candidate) => candidate.endsWith('.ts'))) {
    const source = fs.readFileSync(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && ts.isObjectLiteralExpression(node.initializer)) {
        const values = Object.fromEntries(node.initializer.properties.filter(ts.isPropertyAssignment).map((property) => [String(property.name.text), property.initializer]))
        if (values.en && values.ar && (ts.isStringLiteral(values.en) || ts.isNoSubstitutionTemplateLiteral(values.en)) && (ts.isStringLiteral(values.ar) || ts.isNoSubstitutionTemplateLiteral(values.ar))) {
          entries.push({ key: node.name.text, en: values.en.text, ar: values.ar.text })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return entries
}

function uiStrings() {
  const strings = []
  for (const relativeRoot of uiRoots) {
    const absoluteRoot = path.join(repositoryRoot, relativeRoot)
    for (const file of walk(absoluteRoot).filter((candidate) => /\.(tsx|jsx)$/u.test(candidate) && !/\.(test|spec)\./u.test(candidate))) {
      const source = fs.readFileSync(file, 'utf8')
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const visit = (node) => {
        if (ts.isJsxText(node)) {
          const value = node.text.replace(/\s+/gu, ' ').trim().replaceAll('&amp;', '&').replaceAll('&apos;', "'")
          if (/[A-Za-z\u0600-\u06ff]/u.test(value)) strings.push({ file: path.relative(repositoryRoot, file), value, kind: 'text' })
        }
        if (ts.isJsxAttribute(node) && localizedAttributes.has(String(node.name.text)) && node.initializer && ts.isStringLiteral(node.initializer)) {
          strings.push({ file: path.relative(repositoryRoot, file), value: node.initializer.text, kind: String(node.name.text) })
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }
  }
  return strings
}

function arabicSourceLiterals() {
  const findings = []
  for (const relativeRoot of uiRoots) {
    const absoluteRoot = path.join(repositoryRoot, relativeRoot)
    for (const file of walk(absoluteRoot).filter((candidate) => /\.(tsx|ts|jsx|js)$/u.test(candidate) && !/\.(test|spec)\./u.test(candidate))) {
      const source = fs.readFileSync(file, 'utf8')
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, /\.tsx?$/u.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX)
      const visit = (node) => {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\u0600-\u06ff]/u.test(node.text)) {
          const value = node.text.trim()
          if (value && !contentExemptions.has(value)) findings.push({ file: path.relative(repositoryRoot, file), value })
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }
  }
  return findings
}

const entries = catalogEntries()
const duplicateKeys = entries.filter((entry, index) => entries.findIndex((candidate) => candidate.key === entry.key) !== index)
const empty = entries.filter((entry) => !entry.en.trim() || !entry.ar.trim())
const parameterNames = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/gu)].map((match) => match[1]).sort().join(',')
const interpolationMismatch = entries.filter((entry) => parameterNames(entry.en) !== parameterNames(entry.ar))
const untranslated = entries.filter((entry) => entry.en === entry.ar && !properNounExemptions.has(entry.en))
const englishValues = new Set(entries.map((entry) => entry.en))
const englishConflicts = [...new Set(entries.map((entry) => entry.en))].map((english) => ({ english, translations: [...new Set(entries.filter((entry) => entry.en === english).map((entry) => entry.ar))] })).filter((entry) => entry.translations.length > 1)
const strings = uiStrings()
const arabicSourceLiteralsReport = arabicSourceLiterals()
const missing = strings.filter(({ value }) => !englishValues.has(value) && !properNounExemptions.has(value) && !contentExemptions.has(value) && !/^(?:[\d\W_]|v\d)/u.test(value))
const arabicLeakage = strings.filter(({ value }) => /[\u0600-\u06ff]/u.test(value) && !contentExemptions.has(value))

const report = {
  catalogKeys: entries.length,
  auditedUiStrings: strings.length,
  missing: [...new Map(missing.map((item) => [`${item.file}:${item.value}`, item])).values()],
  duplicateKeys,
  empty,
  interpolationMismatch,
  untranslated,
  englishConflicts,
  arabicLeakage,
  arabicSourceLiterals: arabicSourceLiteralsReport,
}
console.log(JSON.stringify(report, null, 2))
if (report.missing.length || duplicateKeys.length || empty.length || interpolationMismatch.length || untranslated.length || englishConflicts.length || arabicLeakage.length || arabicSourceLiteralsReport.length) process.exitCode = 1
