import type { LocalizationParseResult, ParsedLocalizationDocument } from './types'
import { detectDialogueContext, normalizeContextFieldName } from './contextDetection'

function decodeQuoted(value: string): string { try { return JSON.parse(value) as string } catch { return '' } }

/*
 * Extract explicit structured context from PO comments. Only well-formed
 * `Label: value` patterns are parsed (never arbitrary prose), e.g.:
 *
 *   # Speaker: Mark
 *   #. Speaker Gender: male
 *   #: Listener: Cathy
 *   #. Scene: School Hallway
 */
function contextFromComments(comments: string[]): ParsedLocalizationDocument['entries'][number]['dialogueContext'] {
  const fields: Record<string, unknown> = {}
  for (const comment of comments) {
    const label = comment.replace(/^#(?:[.:,| ])*\s*/u, '').trim()
    const match = label.match(/^([A-Za-z][A-Za-z _-]*)\s*[:=]\s*(.+)$/u)
    if (!match) continue
    const key = normalizeContextFieldName(match[1])
    const value = match[2].trim()
    // Retain PO's established short labels; role aliases use shared detection.
    const field = key === 'dialogue' ? 'dialogue_id' : key === 'choice' ? 'choice_group' : key === 'gender' ? 'speaker_gender' : key
    fields[field] = value
  }
  const context = detectDialogueContext(fields)
  return context && Object.entries(context).some(([key, value]) => key !== 'raw' && value !== undefined) ? context : undefined
}

function parseBlock(block: string, index: number) {
	let active: 'msgid' | 'msgstr' | 'msgctxt' | null = null
	let source = ''; let translation = ''; let context = ''; const comments: string[] = []
	for (const rawLine of block.split('\n')) {
		const line = rawLine.trimEnd()
		if (line.startsWith('#')) { comments.push(line); continue }
		const field = line.match(/^(msgid|msgstr|msgctxt)\s+(.*)$/u)
		if (field) { active = field[1] as 'msgid' | 'msgstr' | 'msgctxt'; const value = decodeQuoted(field[2]); if (active === 'msgid') source = value; else if (active === 'msgstr') translation = value; else context = value; continue }
		if (line.trim().startsWith('"') && active) { const value = decodeQuoted(line.trim()); if (active === 'msgid') source += value; else if (active === 'msgstr') translation += value; else context += value }
	}
	if (!source) return null
	const dialogueContext = contextFromComments(comments)
	return { id: `po:${index}:${source}`, key: context || source, source, translation, context: context || undefined, notes: comments.length ? comments.join('\n') : undefined, dialogueContext, keyPath: [context || source], sourcePath: [source] }
}

export function parsePoLocalization(text: string): LocalizationParseResult {
	const entries = text.split(/\n\s*\n/u).map(parseBlock).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
	if (!entries.length) return { ok: false, reason: 'PO contains no msgid entries.' }
	const document: ParsedLocalizationDocument = { parser: 'gettext-po', format: 'gettext-po', sourceText: text, entries }
	return { ok: true, document }
}

export function exportPoLocalization(document: ParsedLocalizationDocument): string {
	return document.entries.map((entry) => {
		const quote = (value: string) => JSON.stringify(value)
		const multiline = (name: string, value: string) => value.includes('\n') ? `${name} ""\n${value.split(/(?<=\n)/u).map(quote).join('\n')}` : `${name} ${quote(value)}`
		const notes = entry.notes ? `${entry.notes}\n` : ''
		const context = entry.context ? `msgctxt ${quote(entry.context)}\n` : ''
		return `${notes}${context}${multiline('msgid', entry.source)}\n${multiline('msgstr', entry.translation)}\n`
	}).join('\n')
}
