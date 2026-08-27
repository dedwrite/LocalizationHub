/*
 * Unreal Engine `.locres` (FTextLocalizationResource) reader.
 *
 * Implemented against the real serialized layout (verified against
 * CUE4Parse's FTextLocalizationResource.cs and real engine files):
 *
 *   FGuid  LocResMagic   = 7574140E-FC034A67-9D90154A-1B7F37C3  (16 bytes)
 *   uint8  VersionNumber  (ELocResVersion)
 *            Legacy            = 0
 *            Compact           = 1
 *            Optimized_CRC32   = 2
 *            Optimized_CityHash64 = 3
 *   [Compact+] int64 LocalizedStringArrayOffset  (INDEX_NONE = -1)
 *     -> seek: int32 count, then count x (FString + int32 RefCount)
 *   [Optimized+] skip int32 EntriesCount
 *   uint32 NamespaceCount
 *     per namespace: FTextKey namespace, uint32 KeyCount
 *       per key: FTextKey key, uint32 SourceStringHash,
 *                [Compact+] int32 LocalizedStringIndex | [Legacy] FString
 *
 * FTextKey = [Optimized+] uint32 StrHash + FString.
 * FString   = int32 length (negative = UTF-16LE code units, positive = 8-bit
 *             bytes), including the null terminator.
 *
 * The localized value is the string for this resource's culture (the source
 * string is only represented by its hash). We store the localized value
 * honestly and preserve the source hash + culture-derived locale as metadata.
 */

import type { ExtractedEntry, ExtractionDiagnostic } from '../types'
import { extractUnrealTokens } from '../../tokens/unreal'

export const LOCRES_MAGIC = [0x7574140e, 0xfc034a67, 0x9d90154a, 0x1b7f37c3] as const

export const ELocResVersion = {
  Legacy: 0,
  Compact: 1,
  Optimized_CRC32: 2,
  Optimized_CityHash64: 3,
} as const

export type LocResVersion = (typeof ELocResVersion)[keyof typeof ELocResVersion]

const VERSION_LABELS: Record<number, string> = {
  0: 'Legacy',
  1: 'Compact',
  2: 'Optimized_CRC32',
  3: 'Optimized_CityHash64',
}

export type LocresReadResult = {
  entries: ExtractedEntry[]
  diagnostics: ExtractionDiagnostic[]
  version?: LocResVersion
  versionLabel?: string
  namespaceCount?: number
  entryCount?: number
}

class ByteReader {
  position = 0
  private readonly buffer: Uint8Array

  constructor(buffer: Uint8Array) {
    this.buffer = buffer
  }

  readUInt8(): number {
    if (this.position >= this.buffer.length) throw new Error('Unexpected end of LOCRES.')
    return this.buffer[this.position++]
  }

  readUInt32(): number {
    if (this.position + 4 > this.buffer.length) throw new Error('Unexpected end of LOCRES.')
    const value =
      (this.buffer[this.position] |
        (this.buffer[this.position + 1] << 8) |
        (this.buffer[this.position + 2] << 16) |
        (this.buffer[this.position + 3] << 24)) >>> 0
    this.position += 4
    return value
  }

  readInt32(): number {
    return this.readUInt32() | 0
  }

  readInt64(): number {
    const lo = this.readUInt32()
    const hi = this.readUInt32()
    return (hi >>> 0) * 0x100000000 + lo
  }

  readGuid(): number[] {
    return [this.readUInt32(), this.readUInt32(), this.readUInt32(), this.readUInt32()]
  }

  readFString(): string {
    const length = this.readInt32()
    if (length === 0) return ''

    if (length < 0) {
      const codeUnits = -length
      const byteCount = codeUnits * 2
      if (this.position + byteCount > this.buffer.length) throw new Error('LOCRES string exceeds buffer.')
      const sub = this.buffer.subarray(this.position, this.position + byteCount)
      this.position += byteCount
      return new TextDecoder('utf-16le').decode(sub).replace(/\0$/u, '')
    }

    if (this.position + length > this.buffer.length) throw new Error('LOCRES string exceeds buffer.')
    const sub = this.buffer.subarray(this.position, this.position + length)
    this.position += length
    return new TextDecoder('utf-8').decode(sub).replace(/\0$/u, '')
  }

  readTextKey(version: LocResVersion): { str: string; strHash: number } {
    let strHash = 0
    if (version >= ELocResVersion.Optimized_CRC32) {
      strHash = this.readUInt32()
    }
    const str = this.readFString()
    return { str, strHash }
  }
}

function cultureFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined
  // Unreal localization layout: .../Localization/<namespace>/<culture>/<name>.locres
  const parts = path.replace(/\\/g, '/').split('/')
  const idx = parts.findIndex((p) => p.toLowerCase() === 'localization')
  if (idx >= 0 && parts.length > idx + 2) {
    return parts[idx + 2]
  }
  return undefined
}

/*
 * Derive the localization target (resource) name from the .locres path. Unreal
 * layout: .../Content/Localization/<Target>/<Culture>/<Target>.locres — the
 * target is the directory immediately after "Localization".
 */
function localizationTargetFromPath(path: string | undefined): string {
  if (!path) return 'unknown'
  const parts = path.replace(/\\/g, '/').split('/')
  const idx = parts.findIndex((p) => p.toLowerCase() === 'localization')
  if (idx >= 0 && parts.length > idx + 1) {
    return parts[idx + 1]
  }
  return path.split('/').pop()?.replace(/\.locres$/iu, '') ?? 'unknown'
}

/*
 * Classify a LOCRES entry from namespace/key hints. Localization membership
 * proves the entry is translatable, not that it is UI. Use the namespace and
 * key to suggest a category; otherwise Unknown with medium confidence.
 */
function classifyLocresEntry(namespace: string, key: string): ExtractedEntry['classification'] {
  const ns = namespace.toLowerCase()
  const k = key.toLowerCase()

  if (/dialogue|spoken|voice|subtitle|caption|conversation/.test(`${ns} ${k}`)) {
    return /subtitle|caption/.test(`${ns} ${k}`) ? 'Subtitle' : 'Dialogue'
  }
  if (/quest|objective|mission/.test(`${ns} ${k}`)) return 'Quest'
  if (/item|weapon|armor|consumable/.test(ns)) return 'ItemName'
  if (/lore|codex|journal|book|letter/.test(`${ns} ${k}`)) return 'Codex'
  if (/achievement|trophy/.test(`${ns} ${k}`)) return 'Achievement'
  if (/tutorial|hint|tip|tooltip/.test(`${ns} ${k}`)) return 'Tutorial'
  if (/notification|toast|announce/.test(`${ns} ${k}`)) return 'Notification'
  if (/menu|settings|options|hud|ui/.test(ns)) return 'UI'
  if (/system|error|warning/.test(ns)) return 'SystemMessage'

  return 'Unknown'
}

function toProtectedSegments(
  tokens: Array<{ raw: string; kind: string; start: number; end: number; ruleId: string }>,
): Array<{ raw: string; kind: string; start: number; end: number; ruleId: string }> {
  return tokens.map((token) => ({
    raw: token.raw,
    kind: token.kind,
    start: token.start,
    end: token.end,
    ruleId: token.ruleId,
  }))
}

export function isLocresBuffer(buffer: Uint8Array): boolean {
  if (buffer.length < 16) return false
  const reader = new ByteReader(buffer)
  try {
    const guid = reader.readGuid()
    return guid.every((value, i) => value === LOCRES_MAGIC[i])
  } catch {
    return false
  }
}

export function readLocres(
  buffer: Uint8Array,
  origin: { containerPath?: string },
): LocresReadResult {
  const diagnostics: ExtractionDiagnostic[] = []
  const entries: ExtractedEntry[] = []

  if (buffer.length < 8) {
    return {
      entries,
      diagnostics: [{ kind: 'corrupt-resource', message: 'LOCRES buffer is too short.' }],
    }
  }

  const reader = new ByteReader(buffer)

  let version: LocResVersion
  try {
    const guid = reader.readGuid()
    if (guid.every((value, i) => value === LOCRES_MAGIC[i])) {
      const rawVersion = reader.readUInt8()
      if (rawVersion > ELocResVersion.Optimized_CityHash64) {
        return {
          entries,
          version: rawVersion as LocResVersion,
          diagnostics: [{ kind: 'unsupported-engine-version', message: `LOCRES version ${rawVersion} is newer than this reader supports.` }],
        }
      }
      version = rawVersion as LocResVersion
    } else {
      // Legacy resources lack the magic; the whole buffer is the legacy stream.
      version = ELocResVersion.Legacy
      reader.position = 0
    }
  } catch {
    return {
      entries,
      diagnostics: [{ kind: 'corrupt-resource', message: 'LOCRES header is truncated.' }],
    }
  }

  // Localized string lookup table (Compact and later).
  let localizedStrings: string[] = []
  if (version >= ELocResVersion.Compact) {
    try {
      const offset = reader.readInt64()
      if (offset !== -1 && offset >= 0 && offset < buffer.length) {
        const saved = reader.position
        try {
          reader.position = offset
          const count = reader.readInt32()
          if (count >= 0 && count < 1_000_000) {
            localizedStrings = new Array<string>(count)
            for (let i = 0; i < count; i += 1) {
              localizedStrings[i] = reader.readFString()
              // RefCount is only present for Optimized variants (CRC32+).
              if (version >= ELocResVersion.Optimized_CRC32) {
                reader.readInt32()
              }
            }
          }
        } finally {
          // Always restore the position, even if the LUT is malformed, so the
          // entry section below is not read from the wrong offset.
          reader.position = saved
        }
      }
    } catch {
      diagnostics.push({ kind: 'partial-extraction', message: 'LOCRES localized-string table could not be read.' })
    }
  }

  // Optimized variants store an explicit entry count we skip (derived below).
  if (version >= ELocResVersion.Optimized_CRC32) {
    try {
      reader.readUInt32()
    } catch {
      // Ignore; entry iteration is bounds-checked anyway.
    }
  }

  let namespaceCount = 0
  let entryCount = 0
  let order = 0

  try {
    namespaceCount = reader.readUInt32()

    for (let n = 0; n < namespaceCount; n += 1) {
      const namespace = reader.readTextKey(version)
      const keyCount = reader.readUInt32()

      for (let k = 0; k < keyCount; k += 1) {
        const key = reader.readTextKey(version)
        const sourceStringHash = reader.readUInt32()

        let localizedString = ''
        if (version >= ELocResVersion.Compact) {
          const index = reader.readInt32()
          localizedString = (index >= 0 && index < localizedStrings.length)
            ? (localizedStrings[index] ?? '')
            : ''
        } else {
          localizedString = reader.readFString()
        }

        if (!localizedString) continue

        const target = localizationTargetFromPath(origin.containerPath)
        const locale = cultureFromPath(origin.containerPath)
        const protectedSegments = toProtectedSegments(extractUnrealTokens(localizedString))

        entries.push({
          // Stable identity includes the localization target so two different
          // targets (or two different resources) that share a namespace/key
          // do not collide.
          id: `locres:${target}:${namespace.str}:${key.str}`,
          key: key.str,
          namespace: namespace.str || undefined,
          order: order++,
          sourceText: localizedString,
          sourceLocale: locale,
          classification: classifyLocresEntry(namespace.str, key.str),
          classificationConfidence: 'medium',
          origin: {
            engine: 'unreal',
            containerPath: origin.containerPath,
            resourceName: target,
            namespace: namespace.str || undefined,
            key: key.str,
          },
          protectedSegments,
          protectionProfile: 'unreal',
          rawMetadata: {
            sourceStringHash,
            namespaceHash: namespace.strHash,
            keyHash: key.strHash,
            locResName: origin.containerPath,
            localizationTarget: target,
          },
        })
        entryCount += 1
      }
    }
  } catch {
    if (entryCount > 0) {
      diagnostics.push({ kind: 'partial-extraction', message: 'LOCRES truncated during entry iteration.' })
    } else {
      diagnostics.push({ kind: 'corrupt-resource', message: 'LOCRES entry section could not be parsed.' })
    }
  }

  return {
    entries,
    diagnostics,
    version,
    versionLabel: VERSION_LABELS[version] ?? `Unknown (${version})`,
    namespaceCount,
    entryCount,
  }
}
