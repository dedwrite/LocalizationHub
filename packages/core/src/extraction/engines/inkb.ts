/*
 * Until Then `.inkb` story reader (extraction only).
 *
 * IMPORTANT — this is NOT the upstream InkCPP binary format. Until Then ships a
 * custom serialization produced by its Godot/InkCPP bridge:
 *
 *   [10-byte header]
 *   <NUL-terminated strings>   ← metadata, $ commands, and `char_key: text` dialogue
 *   <binary command stream>    ← compiled Ink instruction tail (ignored here)
 *
 * The 10-byte header is `u16=1`, `u32=20`, `u32=0` (version + layout markers).
 * The text section is a sequence of NUL-terminated UTF-8 strings:
 *
 *   type: "scene" | "dialogue" | "chat"
 *   characters: { "Mark": "MarkBorja", ... }     ← display name → character id
 *   player: "Mark"
 *   $ pass / $ play_anim ...                     ← commands (non-text)
 *   Mark: Hello there                             ← dialogue (char_key: text)
 *
 * The dialogue grammar is confirmed by the game's own source
 * (`Constants.REGEX_DIALOGUE`):
 *
 *   (?<char_key>[a-zA-Z0-9:_-]+)\s*(?:\((?<duration>.+)\))?\:\s*(?<text>.+)
 *
 * Text markers inside dialogue:
 *   [.] / [..]   — beat/pause (control, protected)
 *   [$cmd]       — inline command (control, protected)
 *   [>speed]     — text speed (control, protected)
 *   [:text]      — click-to-reveal text (the inner text IS translatable)
 *
 * We parse this natively in TypeScript — no C++ helper required — and never
 * execute the binary tail.
 */

import { extractGodotTokens } from '../../tokens/godot'
import { detectEngine } from '../engineDetection'
import { structuralEntryId } from '../structuredData'
import { detectGodotInkbLocale, GODOT_NATIVE_FALLBACK_LOCALE } from '../godotLocales'
import type {
  ExtractedEntry,
  ExtractionResult,
  EntryContext,
} from '../types'
import { buildEntry, toProtectedSegments } from './shared'
import { structuralInference } from '../provenance'
import { inferContextFromRecord } from '../contextInference'
import { recognizeDialogueRole } from '../../dialogueRoles'

export type InkbStoryType = 'scene' | 'dialogue' | 'chat'

export type InkbMetadata = Pick<EntryContext, 'listener' | 'listeners' | 'listenerId' | 'listenerGender' | 'listenerGenders' | 'listenerProvenance' | 'listenerGenderProvenance'> & {
  type: InkbStoryType
  /* display name → character id (e.g. "Mark" → "MarkBorja") */
  characters: Record<string, string>
  player?: string
  hasExplicitListener?: boolean
}

const INKB_HEADER_BYTES = 10

/*
 * Dialogue line: `char_key [ (duration) ] : text`.
 * char_key allows alphanumerics, ':', '_', '-'.
 */
const DIALOGUE_PATTERN = /^([A-Za-z0-9:_-]+)\s*(?:\(([^)]+)\))?:\s*(.+)$/u

/*
 * Metadata header: `key: "value"` or `key: {json}`. These are the story header
 * (type/characters/player/name/picture/character_props/route, ...) and must
 * never be mistaken for dialogue.
 */
const METADATA_HEADER_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*\s*:\s*["{]/u

function isMetadataHeader(str: string): boolean {
  if (METADATA_HEADER_PATTERN.test(str)) return true
  return Boolean(listenerHeader(str))
}

function listenerHeader(str: string): RegExpMatchArray | undefined {
  const field = str.match(/^([A-Za-z_][A-Za-z0-9_. -]*)\s*:\s*(.+)$/su)
  // Dialogue also starts with [.] / [..] / [$cmd]; only known listener
  // fields can be array-valued metadata, never an arbitrary speaker line.
  return field && recognizeDialogueRole(field[1])?.startsWith('listener') ? field : undefined
}

/* Click-to-reveal text: [:text] — the inner text is translatable. */
const REVEAL_PATTERN = /\[:([^\]]*)\]/gu

function strictDecode(bytes: Uint8Array, start: number, end: number): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start, end))
  } catch {
    return undefined
  }
}

/*
 * Read the NUL-terminated text section of a `.inkb` file, stopping at the
 * binary command tail. Returns the text strings (metadata + commands +
 * dialogue). The binary tail is detected by an empty string, the literal
 * "NOP" marker, or a segment that fails strict UTF-8 decoding.
 */
export function readInkbTextStrings(buffer: Uint8Array): string[] {
  const strings: string[] = []
  let offset = INKB_HEADER_BYTES

  while (offset < buffer.length) {
    const start = offset
    while (offset < buffer.length && buffer[offset] !== 0) offset += 1
    const end = offset
    const length = end - start

    if (length === 0) {
      // Empty string marks the start of the binary tail.
      break
    }

    const decoded = strictDecode(buffer, start, end)
    if (decoded === undefined) {
      // Non-UTF-8 bytes → binary tail started.
      break
    }
    if (decoded === 'NOP') {
      // Explicit end-of-text marker.
      break
    }

    strings.push(decoded)
    offset += 1 // consume the NUL terminator
  }

  return strings
}

/*
 * Parse the metadata header strings (everything before the first `$` command or
 * dialogue line).
 */
export function parseInkbMetadata(strings: string[]): InkbMetadata {
  const metadata: InkbMetadata = { type: 'scene', characters: {} }
  const listenerFields: Record<string, unknown> = {}
  let malformedListener = false

  for (const str of strings) {
    if (str.startsWith('$')) break
    if (!isMetadataHeader(str) && DIALOGUE_PATTERN.test(str)) break
    const typeMatch = str.match(/^type:\s*"([^"]+)"/u)
    if (typeMatch) {
      metadata.type = typeMatch[1] as InkbStoryType
      continue
    }
    const playerMatch = str.match(/^player:\s*"([^"]+)"/u)
    if (playerMatch) {
      metadata.player = playerMatch[1]
      continue
    }
    const charsMatch = str.match(/^characters:\s*(\{.*\})$/su)
    if (charsMatch) {
      try {
        metadata.characters = JSON.parse(charsMatch[1]) as Record<string, string>
      } catch {
        metadata.characters = {}
      }
      continue
    }
    const fieldMatch = listenerHeader(str)
    if (fieldMatch) {
      try {
        const value: unknown = JSON.parse(fieldMatch[2])
        listenerFields[fieldMatch[1]] = value
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length
          && !inferContextFromRecord({ [fieldMatch[1]]: value }).context.listener) malformedListener = true
      } catch { malformedListener = true }
    }
    // Other header keys (name, color, character_props, ...) are ignored.
    if (/^[A-Za-z_][A-Za-z0-9_.-]*\s*:/u.test(str)) continue
  }

  const listenerContext = inferContextFromRecord(listenerFields).context
  Object.assign(metadata, listenerContext)
  metadata.hasExplicitListener = Boolean(listenerContext.listener || listenerContext.listeners?.length || listenerContext.listenerId || malformedListener)
  return metadata
}

/*
 * Extract dialogue entries from a `.inkb` binary buffer.
 *
 * `characters` maps display names to character ids; the id is recorded as
 * `context.speakerId` (stable identity) alongside the display `speaker`.
 * Gender is never inferred (Until Then has no explicit gender metadata).
 */
export function extractInkb(fileName: string, buffer: Uint8Array): ExtractionResult {
  const strings = readInkbTextStrings(buffer)
  const metadata = parseInkbMetadata(strings)
  const explicitListenerCharacters = Object.entries(metadata.characters).filter(([name, id]) =>
    typeof id === 'string' && id.trim() && (name === metadata.listener || id === metadata.listener))
  const explicitListenerId = metadata.listenerId ?? (explicitListenerCharacters.length === 1 ? explicitListenerCharacters[0][1] : undefined)

  // Culture-independent story identity: strip `locales/<culture>/` so locale
  // variants of the same story share one logical identity.
  const localeInfo = detectGodotInkbLocale(fileName)
  const storyId = localeInfo.storyPath
  // The base story (no `locales/<culture>/` prefix) is the source/native
  // language. Until Then's runtime default is English (`Constants.DEFAULT_LOCALE
  // = "en"`); the base `.inkb` files are English. This is documented Until
  // Then-specific behavior, consistent with the JSON database base ("en").
  const sourceLocale = localeInfo.locale ?? GODOT_NATIVE_FALLBACK_LOCALE
  const isSourceLocale = localeInfo.isBase === true

  const entries: ExtractedEntry[] = []
  const spokenDialogue: ExtractedEntry[] = []
  let order = 0
  const conversationId = `inkb:${storyId}`

  // Until Then splits a speaker's speech across multiple NUL strings: only the
  // FIRST carries `char_key: text`; the continuation lines are bare text with
  // NO prefix (the speaker carries over). `$ F <char>` focus commands also set
  // the active speaker. Track the current speaker to attribute bare lines.
  let currentSpeaker: string | undefined
  let currentSpeakerId: string | undefined
  // Keep existing speaker attribution, but never carry an inferred addressee
  // across thought, choice, or command boundaries without a new speaking turn.
  let spokenTurn = false

  // Timed player choices: `$ push_timed_choices [duration] [n]` is followed by
  // parenthesized `(option)` strings until the next `$` command. These are
  // structural player choices, NOT narration continuation.
  let timedChoicesActive = false

  // Structural fingerprint: the sequence of speaker keys (or ":" for thought).
  // This is culture-independent (speaker aliases like Mark/Ryan/Louise do not
  // change across locales) and is used to detect cross-locale structural
  // divergence (e.g. a translator merging/splitting lines), so we never merge
  // a mismatched story's lines silently.
  const fingerprint: string[] = []

  const push = (
    text: string,
    speaker: string | undefined,
    characterId: string | undefined,
    isThought: boolean,
    charKey: string | undefined,
    isContinuation: boolean,
  ) => {
    if (!text.trim()) return
    // A non-continuation line advances the structural fingerprint: an explicit
    // speaker key, or ":" for an inner thought. Continuations share the
    // preceding line's identity and do NOT add a fingerprint element.
    if (!isContinuation) {
      fingerprint.push(isThought ? ':' : (charKey ?? speaker ?? 'narration'))
    }
    entries.push(buildEntry({
      id: structuralEntryId(['inkb', storyId, String(order)]),
      key: `${storyId}:${order}`,
      order: order++,
      sourceText: text,
      sourceLocale,
      classification: 'Dialogue',
      classificationConfidence: 'high',
      cultureIdentity: `godot-inkb:${storyId}:${entries.length}`,
      context: {
        speaker,
        speakerId: characterId,
        ...(speaker && !isThought && spokenTurn ? {
          listener: metadata.listener,
          listeners: metadata.listeners,
          listenerId: explicitListenerId,
          listenerProvenance: metadata.listenerProvenance,
          listenerGender: metadata.listenerGender,
          listenerGenders: metadata.listenerGenders,
          listenerGenderProvenance: metadata.listenerGenderProvenance,
        } : {}),
        conversationId,
        scene: storyId,
        speakerProvenance: speaker
          ? { source: 'explicit-field', confidence: 'high' }
          : undefined,
        conversationProvenance: { source: 'structural-inference', confidence: 'high' },
      },
      origin: {
        engine: 'godot',
        containerPath: fileName,
        objectType: 'inkb-dialogue',
        resourceName: storyId,
        key: charKey ?? (speaker ?? 'narration'),
      },
      protectedSegments: toProtectedSegments(extractGodotTokens(text)),
      protectionProfile: 'godot',
      rawMetadata: {
        storyType: metadata.type,
        isThought,
        charKey: charKey ?? (speaker ?? 'narration'),
        continuation: isContinuation,
        revealText: hasRevealText(text),
        isSourceLocale,
      },
    }))
    if (speaker && !isThought && spokenTurn) spokenDialogue.push(entries[entries.length - 1])
  }

  for (const str of strings) {
    // Commands: track `$ F <char>` focus commands for implicit speaker, and
    // `$ push_timed_choices` for timed player choices.
    if (str.startsWith('$')) {
      spokenTurn = false
      const focusMatch = str.match(/^\$\s*F\s+([A-Za-z0-9_]+)/u)
      if (focusMatch) {
        spokenTurn = true
        currentSpeaker = focusMatch[1]
        currentSpeakerId = metadata.characters[focusMatch[1]] ?? focusMatch[1]
        timedChoicesActive = false
      }
      if (/^\$\s*push_timed_choices\b/u.test(str)) {
        timedChoicesActive = true
      }
      // Any other `$` command ends the timed-choice block.
      if (!/^\$\s*push_timed_choices\b/u.test(str)) {
        timedChoicesActive = false
      }
      continue
    }
    if (isMetadataHeader(str)) continue

    // Timed player choice: parenthesized `(option)` strings following
    // `$ push_timed_choices`. Structurally proven player choices, not narration.
    if (timedChoicesActive) {
      const optionMatch = str.trim().match(/^\((.+)\)$/u)
      if (optionMatch) {
        const optionText = optionMatch[1].trim()
        if (optionText) {
          entries.push(buildEntry({
            id: structuralEntryId(['inkb', storyId, 'choice', String(order)]),
            key: `${storyId}:choice:${order}`,
            order: order++,
            sourceText: optionText,
            sourceLocale,
            classification: 'Choice',
            classificationConfidence: 'high',
            cultureIdentity: `godot-inkb:${storyId}:${entries.length}`,
            context: { conversationId, scene: storyId, choiceGroup: `${storyId}:timed` },
            origin: {
              engine: 'godot',
              containerPath: fileName,
              objectType: 'inkb-choice',
              resourceName: storyId,
              key: `timed-choice-${order}`,
            },
            protectedSegments: toProtectedSegments(extractGodotTokens(optionText)),
            protectionProfile: 'godot',
            rawMetadata: { storyType: metadata.type, timedChoice: true, isSourceLocale },
          }))
        }
        continue
      }
      // A non-parenthesized string ends the timed-choice block.
      timedChoicesActive = false
    }

    const match = str.match(DIALOGUE_PATTERN)
    if (match) {
      const charKey = match[1]
      const text = match[3]
      const isThought = charKey === ':'
      spokenTurn = !isThought
      const speaker = isThought ? undefined : charKey
      const characterId = isThought ? undefined : metadata.characters[charKey]
      if (!isThought) {
        currentSpeaker = speaker
        currentSpeakerId = characterId
      }
      push(text, speaker, characterId, isThought, charKey, false)
      continue
    }

    // Thought (inner monologue): `:: text`
    if (str.startsWith('::')) {
      spokenTurn = false
      push(str.slice(2), undefined, undefined, true, ':', false)
      continue
    }

    // Bare continuation line: natural-language text with no speaker prefix.
    // It inherits the current speaker (or is narration when there is none).
    // Pure ASCII identifiers (story labels like `music_end`, `bgg75cdd4i5`)
    // are NOT text and are skipped.
    if (isBareDialogueText(str)) {
      push(str, currentSpeaker, currentSpeakerId, false, currentSpeaker ?? 'narration', true)
    }
  }

  inferInkbListeners(spokenDialogue, metadata)

  // Attach the full structural fingerprint to every entry so the culture
  // aggregator can detect cross-locale structural divergence (translators
  // merging/splitting lines) and refuse to merge mismatched stories.
  const fingerprintKey = fingerprint.join('|')
  for (const entry of entries) {
    entry.rawMetadata = { ...entry.rawMetadata, structuralFingerprint: fingerprintKey }
  }

  return {
    engine: 'godot',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: {
      filesScanned: 1,
      candidateFiles: 1,
      entriesFound: entries.length,
      byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}),
      protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0),
      entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length,
      entriesWithListener: entries.filter((e) => e.context?.listener || e.context?.listeners?.length).length,
      entriesWithExplicitGender: 0,
      entriesWithInferredContext: entries.filter((e) => e.context?.scene || e.context?.conversationId).length,
      conversationGroups: entries.length > 0 ? 1 : 0,
      warnings: 0,
      errors: 0,
    },
  }
}

/**
 * Called only with spoken turns (and their uninterrupted continuations).
 * Require both members of an unambiguous two-person cast to actually speak in
 * this story. A player hint or a single neighbouring line is never sufficient.
 * Keep this story-wide: the binary control flow is not decoded, so we cannot
 * safely split a multi-party story into smaller presumed conversations.
 */
export function inferInkbListeners(spokenDialogue: ExtractedEntry[], metadata: InkbMetadata): void {
  if (metadata.hasExplicitListener) return
  const participants = new Map<string, { name: string; id?: string }>()
  for (const [name, id] of Object.entries(metadata.characters)) {
    if (!name.trim() || typeof id !== 'string') return
    participants.set(name, { name, id: id.trim() ? id : undefined })
  }
  if (metadata.player && !participants.has(metadata.player)) {
    // A player may be identified by the same stable id used in $ F commands.
    if (![...participants.values()].some((p) => p.id === metadata.player)) {
      participants.set(metadata.player, { name: metadata.player })
    }
  }
  if (participants.size !== 2) return

  const pair = [...participants.values()]
  const resolve = (speaker: string | undefined) => {
    const matches = pair.filter((p) => p.name === speaker || (p.id && p.id === speaker))
    return matches.length === 1 ? matches[0] : undefined
  }
  // Duplicate/overlapping character identities cannot establish two people.
  if (pair.some((p) => resolve(p.name) !== p || (p.id && resolve(p.id) !== p))) return
  const speakers = spokenDialogue.map((entry) => resolve(entry.context?.speaker))
  if (speakers.some((speaker) => !speaker) || new Set(speakers).size !== 2) return
  // An explicit addressee outside the pair is evidence of a wider audience.
  // Preserve those values and do not infer targets for the remaining lines.
  if (spokenDialogue.some(({ context }) => [context?.listener, context?.listenerId, ...(context?.listeners ?? [])]
    .some((target) => target && !resolve(target)))) return

  for (const [index, entry] of spokenDialogue.entries()) {
    const context = entry.context
    if (!context || context.listener || context.listenerId || context.listeners?.length) continue
    const listener = pair.find((participant) => participant !== speakers[index])!
    context.listener = listener.name
    context.listenerId = listener.id
    context.listenerProvenance = structuralInference('medium')
    // Inference never supplies gender; only explicit metadata may carry it.
  }
}

function hasRevealText(text: string): boolean {
  REVEAL_PATTERN.lastIndex = 0
  return REVEAL_PATTERN.test(text)
}

/*
 * Is a bare (no `char_key:`) NUL string user-facing dialogue text?
 *
 * Until Then splits a speaker's speech across multiple strings: only the first
 * carries `char_key: text`; continuation lines are bare. They are text when
 * they contain non-ASCII (CJK) characters OR natural-language whitespace
 * (multi-word Latin). Pure ASCII identifiers/event labels (`music_end`,
 * `bgg75cdd4i5`, `signkv189l`) are story internals, NOT text.
 */
function isBareDialogueText(str: string): boolean {
  const s = str.trim()
  if (s.length === 0) return false
  // Pure ASCII identifier/label → skip.
  if (/^[A-Za-z0-9_.-]+$/u.test(s)) return false
  // Text: contains non-ASCII (CJK/Arabic/etc.) OR whitespace between words.
  return /[^\x00-\x7F]/u.test(s) || /\s/u.test(s)
}
