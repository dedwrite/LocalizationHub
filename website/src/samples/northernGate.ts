import type { LocalizationProjectV3 } from '@localizationhub/core'
import { importLocalFile, projectFromLocalDocument } from '../localProjects'
import lines from './northernGate.data.json'

/** Fictional, editable product tour. No API calls or user data. */
export function createNorthernGateSample(): LocalizationProjectV3 {
  const records = lines.map(([key, source, translation], index) => ({
    key, source, translation,
    speaker: index < 6 ? (index === 2 || index === 5 ? 'Merchant' : index === 3 ? 'Scout' : 'Captain Veyra') : '',
    receiver: index < 6 ? 'Player' : '',
    scene: index < 11 ? 'Northern Gate' : index < 18 ? 'Game menus' : 'Inventory',
    notes: index === 8 ? 'Practice check: restore {gold} before export. This missing token is intentional.' : index === 9 ? 'Long journal entry: check line breaks and reading comfort.' : '',
  }))
  const parsed = importLocalFile(JSON.stringify(records, null, 2), 'northern-gate.json')
  if (!parsed.ok) throw new Error('Bundled Northern Gate sample could not be parsed.')
  const project = projectFromLocalDocument(parsed.document, 'northern-gate.json')
  project.document.language = { sourceLocale: 'en', translationLocale: 'ar', sourceDirection: 'ltr', translationDirection: 'rtl' }
  project.workflow.entries = Object.fromEntries(project.entries.map((entry, index) => [entry.id, { status: index === 8 || index === 3 ? 'needs-review' : index < 3 || index === 11 ? 'approved' : entry.translation ? 'translated' : 'draft' }]))
  project.metadata = {
    tags: [{ id: 'dialogue', label: 'Dialogue' }, { id: 'quest', label: 'Quest' }, { id: 'ui', label: 'UI' }, { id: 'inventory', label: 'Inventory' }, { id: 'practice', label: 'Practice QA' }],
    entryTags: Object.fromEntries(project.entries.map((entry, index) => [entry.id, [index < 6 ? 'dialogue' : index < 11 ? 'quest' : index < 18 ? 'ui' : 'inventory', ...(index === 8 ? ['practice'] : [])]])),
    assignments: {},
    comments: [{ id: 'sample-comment', entryId: project.entries[0].id, body: 'Veyra is steady, not angry. Keep the command brief and reassuring.', authorName: 'Sample reviewer', createdAt: '2026-09-01T00:00:00Z', resolved: false }],
    glossary: [{ sourceTerm: 'Northern Gate', preferredTranslation: lines[0][2].match(/<color=[^>]+>(.*?)<\/color>/)![1], forbiddenTranslations: [], caseSensitive: false, notes: 'Use the same place name in dialogue and quests.' }, { sourceTerm: lines[18][1], preferredTranslation: lines[18][2], forbiddenTranslations: [], caseSensitive: false }],
    translationMemory: [{ source: lines[12][1], translation: lines[12][2], approvedAt: '2026-09-01T00:00:00Z' }],
  }
  return project
}
