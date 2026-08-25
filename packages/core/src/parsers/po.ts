import type { LocalizationParseResult, ParsedLocalizationDocument } from './types'

function decodeQuoted(value: string): string { try { return JSON.parse(value) as string } catch { return '' } }

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
	return { id: `po:${index}:${source}`, key: context || source, source, translation, context: context || undefined, notes: comments.length ? comments.join('\n') : undefined, keyPath: [context || source], sourcePath: [source] }
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
