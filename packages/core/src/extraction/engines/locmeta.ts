/*
 * Unreal Engine `.locmeta` (FTextLocalizationMetaDataResource) reader.
 *
 *   FGuid  LocMetaMagic  = A14CEE4F-83554868-BD464C6C-7C50DA70 (16 bytes)
 *   uint8  VersionNumber  (ELocMetaVersion)
 *   FString NativeCulture
 *   FString NativeLocRes
 *   [>= AddedCompiledCultures] int32 count + count x FString
 *   [>= AddedIsUGC]           bool bIsUGC
 *
 * LOCMETA is metadata only; it never produces translatable entries.
 */

export type LocmetaResult = {
  nativeCulture?: string
  nativeLocRes?: string
  compiledCultures?: string[]
  isUGC?: boolean
  version?: number
  error?: string
}

export const LOCMETA_MAGIC = [0xa14cee4f, 0x83554868, 0xbd464c6c, 0x7c50da70] as const

class ByteReader {
  position = 0
  private readonly buffer: Uint8Array

  constructor(buffer: Uint8Array) {
    this.buffer = buffer
  }

  readUInt8(): number {
    if (this.position >= this.buffer.length) throw new Error('Unexpected end of LOCMETA.')
    return this.buffer[this.position++]
  }

  readUInt32(): number {
    if (this.position + 4 > this.buffer.length) throw new Error('Unexpected end of LOCMETA.')
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

  readGuid(): number[] {
    return [this.readUInt32(), this.readUInt32(), this.readUInt32(), this.readUInt32()]
  }

  readFString(): string {
    const length = this.readInt32()
    if (length === 0) return ''
    if (length < 0) {
      const codeUnits = -length
      const byteCount = codeUnits * 2
      if (this.position + byteCount > this.buffer.length) throw new Error('LOCMETA string exceeds buffer.')
      const sub = this.buffer.subarray(this.position, this.position + byteCount)
      this.position += byteCount
      return new TextDecoder('utf-16le').decode(sub).replace(/\0$/u, '')
    }
    if (this.position + length > this.buffer.length) throw new Error('LOCMETA string exceeds buffer.')
    const sub = this.buffer.subarray(this.position, this.position + length)
    this.position += length
    return new TextDecoder('utf-8').decode(sub).replace(/\0$/u, '')
  }

  readBoolean(): boolean {
    return this.readUInt8() !== 0
  }
}

export function readLocmeta(buffer: Uint8Array): LocmetaResult {
  const reader = new ByteReader(buffer)

  try {
    const guid = reader.readGuid()
    const hasMagic = guid.every((value, i) => value === LOCMETA_MAGIC[i])
    const version = hasMagic ? reader.readUInt8() : 0

    const nativeCulture = reader.readFString()
    const nativeLocRes = reader.readFString()

    let compiledCultures: string[] | undefined
    if (version >= 1) {
      const count = reader.readInt32()
      if (count >= 0 && count < 100_000) {
        compiledCultures = []
        for (let i = 0; i < count; i += 1) {
          compiledCultures.push(reader.readFString())
        }
      }
    }

    let isUGC: boolean | undefined
    if (version >= 2) {
      isUGC = reader.readBoolean()
    }

    return { nativeCulture, nativeLocRes, compiledCultures, isUGC, version }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'LOCMETA parse failed.' }
  }
}
