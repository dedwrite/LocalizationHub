import type { LocalizationParseResult, ParsedLocalizationDocument } from './types'
import { normalizeContextFieldName } from './contextDetection'
import { normalizeGender } from '../extraction/contextInference'

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
  const context: NonNullable<ParsedLocalizationDocument['entries'][number]['dialogueContext']> = {}
  for (const comment of comments) {
    const label = comment.replace(/^#(?:[.:,| ])*\s*/u, '').trim()
    const match = label.match(/^(Speaker Gender|Listener Gender|Speaker|Listener|Gender|Scene|Conversation|Dialogue|Node|Choice|Voice|Portrait)\s*[:=]\s*(.+)$/iu)
    if (!match) continue
    const key = normalizeContextFieldName(match[1])
    const value = match[2].trim()
    switch (key) {
      case 'speaker': context.speaker = value; break
      case 'listener': context.listener = value; break
      case 'speaker_gender': context.speakerGender = normalizeGender(value); break
      case 'listener_gender': context.listenerGender = normalizeGender(value); break
      case 'gender': context.speakerGender = normalizeGender(value); break
      case 'scene': context.scene = value; break
      case 'conversation': context.conversationId = value; break
      case 'dialogue': context.dialogueId = value; break
      case 'node': context.nodeId = value; break
      case 'choice': context.choiceGroup = value; break
      case 'voice': context.voice = value; break
      case 'portrait': context.portrait = value; break
    }
  }
  const hasAny = Object.entries(context).some(([k, v]) => k !== 'raw' && v !== undefined)
  return hasAny ? context : undefined
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
