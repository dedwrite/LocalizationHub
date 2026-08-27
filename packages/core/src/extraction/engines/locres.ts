/*
 * Unreal Engine `.locres` reader (optimized format, version 2).
 *
 * The optimized format (UE 4.22+ and UE 5) is:
 *   uint32 MagicNumber = 0x7574140E (little-endian)
 *   int32  VersionNumber = 2
 *   int32  NumberOfEntries
 *   FLocKeyMapEntry Entries[N]: { uint32 StrHash, uint32 Offset }
 *   StringTable: at each entry's Offset, three consecutive UTF-16LE
 *     null-terminated strings: Namespace, Key, SourceString
 *
 * The reader is fully bounds-checked and returns a partial-extraction
 * diagnostic instead of garbage when the layout does not validate. Legacy
 * (v1) and compiled (v3) formats are reported as unsupported and delegated to
 * external tooling.
 */

import type { ExtractedEntry, ExtractionDiagnostic } from '../types'

const LOCRES_MAGIC = 0x7574140e

export type LocresReadResult = {
  entries: ExtractedEntry[]
  diagnostics: ExtractionDiagnostic[]
  version?: number
}

const decoder = new TextDecoder('utf-16le', { fatal: false })

function readUInt32(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] ?? 0) |
    ((buffer[offset + 1] ?? 0) << 8) |
    ((buffer[offset + 2] ?? 0) << 16) |
    ((buffer[offset + 3] ?? 0) << 24)
  ) >>> 0
}

function readInt32(buffer: Uint8Array, offset: number): number {
  return readUInt32(buffer, offset) | 0
}

function readNullTerminatedUtf16(
  buffer: Uint8Array,
  offset: number,
): { text: string; nextOffset: number } | null {
  if (offset < 0 || offset + 1 >= buffer.length) return null
  let end = offset
  while (end + 1 < buffer.length) {
    const low = buffer[end]
    const high = buffer[end + 1]
    if (low === 0 && high === 0) break
    end += 2
  }
  if (end >= buffer.length) return null
  const text = decoder.decode(buffer.subarray(offset, end))
  return { text, nextOffset: end + 2 }
}

export function isLocresBuffer(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false
  return readUInt32(buffer, 0) === LOCRES_MAGIC
}

export function readLocres(
  buffer: Uint8Array,
  origin: { containerPath?: string; namespace?: string },
): LocresReadResult {
  const diagnostics: ExtractionDiagnostic[] = []
  const entries: ExtractedEntry[] = []

  if (buffer.length < 8) {
    return {
      entries,
      diagnostics: [{ kind: 'corrupt-resource', message: 'LOCRES buffer is too short.' }],
    }
  }

  if (readUInt32(buffer, 0) !== LOCRES_MAGIC) {
    return {
      entries,
      diagnostics: [{ kind: 'unsupported-format', message: 'Not a LOCRES resource (bad magic).' }],
    }
  }

  const version = readInt32(buffer, 4)
  if (version !== 2) {
    return {
      entries,
      version,
      diagnostics: [{ kind: 'unsupported-engine-version', message: `LOCRES version ${version} is not natively supported; use the external LocRes tool.` }],
    }
  }

  const entryCount = readInt32(buffer, 8)
  if (entryCount < 0 || entryCount > 1_000_000) {
    return {
      entries,
      version,
      diagnostics: [{ kind: 'corrupt-resource', message: 'LOCRES entry count is invalid.' }],
    }
  }

  // FLocKeyMapEntry table: entryCount * 8 bytes (StrHash + Offset).
  const entriesStart = 12
  const entryTableEnd = entriesStart + entryCount * 8
  if (entryTableEnd > buffer.length) {
    return {
      entries,
      version,
      diagnostics: [{ kind: 'corrupt-resource', message: 'LOCRES entry table exceeds buffer.' }],
    }
  }

  let order = 0
  for (let i = 0; i < entryCount; i += 1) {
    const recordStart = entriesStart + i * 8
    // StrHash (unused for extraction) + Offset into the string table.
    const offset = readUInt32(buffer, recordStart + 4)

    const namespace = readNullTerminatedUtf16(buffer, offset)
    if (!namespace) {
      diagnostics.push({ kind: 'partial-extraction', message: 'LOCRES string offset out of bounds.' })
      break
    }
    const key = readNullTerminatedUtf16(buffer, namespace.nextOffset)
    if (!key) {
      diagnostics.push({ kind: 'partial-extraction', message: 'LOCRES key offset out of bounds.' })
      break
    }
    const source = readNullTerminatedUtf16(buffer, key.nextOffset)
    if (!source) {
      diagnostics.push({ kind: 'partial-extraction', message: 'LOCRES source offset out of bounds.' })
      break
    }

    if (!source.text) continue

    entries.push({
      id: `locres:${origin.namespace ?? ''}:${key.text}`,
      key: key.text,
      namespace: namespace.text || origin.namespace,
      order: order++,
      sourceText: source.text,
      classification: 'UI',
      classificationConfidence: 'high',
      origin: {
        engine: 'unreal',
        containerPath: origin.containerPath,
        resourceName: `${namespace.text}.locres`,
        namespace: namespace.text || origin.namespace,
        key: key.text,
      },
      protectedSegments: [],
      protectionProfile: 'unreal',
    })
  }

  return { entries, version, diagnostics }
}
