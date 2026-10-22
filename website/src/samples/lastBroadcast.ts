import type { LocalizationProjectV3 } from '@localizationhub/core'
import { importLocalFile, projectFromLocalDocument } from '../localProjects'
import lines from './lastBroadcast.data.json'

/** Fictional, editable product tour. No API calls or user data. */
export function createLastBroadcastSample(): LocalizationProjectV3 {
  const records = lines.map(([key, source, translation], index) => ({
    key, source, translation,
    speaker: index < 6 ? (index === 2 || index === 5 ? 'Technician Sol' : index === 3 ? 'Pilot Ren' : 'Engineer Mira') : '',
    receiver: index < 6 ? 'Player' : '',
    scene: index < 11 ? 'Relay Station' : index < 18 ? 'Game menus' : 'Inventory',
    notes: index === 8 ? 'Practice check: restore {credits} before export. This missing token is intentional.' : index === 9 ? 'Long journal entry: check line breaks and reading comfort.' : '',
  }))
  const parsed = importLocalFile(JSON.stringify(records, null, 2), 'last-broadcast.json')
  if (!parsed.ok) throw new Error('Bundled Last Broadcast sample could not be parsed.')
  const project = projectFromLocalDocument(parsed.document, 'last-broadcast.json')
  project.document.language = { sourceLocale: 'en', translationLocale: 'ar', sourceDirection: 'ltr', translationDirection: 'rtl' }
  project.workflow.entries = Object.fromEntries(project.entries.map((entry, index) => [entry.id, { status: index === 8 || index === 3 ? 'needs-review' : index < 3 || index === 11 ? 'approved' : entry.translation ? 'translated' : 'draft' }]))
  project.metadata = {
    tags: [{ id: 'dialogue', label: 'Dialogue' }, { id: 'quest', label: 'Quest' }, { id: 'ui', label: 'UI' }, { id: 'inventory', label: 'Inventory' }, { id: 'practice', label: 'Practice QA' }],
    entryTags: Object.fromEntries(project.entries.map((entry, index) => [entry.id, [index < 6 ? 'dialogue' : index < 11 ? 'quest' : index < 18 ? 'ui' : 'inventory', ...(index === 8 ? ['practice'] : [])]])),
    assignments: {},
    comments: [{ id: 'sample-comment', entryId: project.entries[0].id, body: 'Mira is calm despite the interference. Keep her voice clear and reassuring.', authorName: 'Sample reviewer', createdAt: '2026-09-01T00:00:00Z', resolved: false }],
    glossary: [{ sourceTerm: 'Relay Station', preferredTranslation: 'محطة الاتصال', forbiddenTranslations: [], caseSensitive: false, notes: 'Use the same place name in dialogue and quests.' }, { sourceTerm: lines[18][1], preferredTranslation: lines[18][2], forbiddenTranslations: [], caseSensitive: false }],
    translationMemory: [{ source: lines[12][1], translation: lines[12][2], approvedAt: '2026-09-01T00:00:00Z' }],
  }
  return project
}
