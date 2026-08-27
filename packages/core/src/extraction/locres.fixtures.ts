/*
 * Shared test fixture: a minimal Compact LOCRES builder.
 *
 * Produces a byte-valid Compact (ELocResVersion=1) LOCRES with the real magic,
 * a localized-string LUT, and one namespace per entry. Used by culture, ID,
 * and acceptance tests without re-implementing the binary layout.
 */

export function buildCompactLocres(namespaces: Array<{ namespace: string; keys: Array<{ key: string; localized: string }> }>): Uint8Array {
  const writer = new ByteWriter()
  writer.writeGuid([0x7574140e, 0xfc034a67, 0x9d90154a, 0x1b7f37c3])
  writer.writeU8(1) // Compact

  const localizedStrings: string[] = []
  writer.writeI64(0) // placeholder

  writer.writeU32(namespaces.length)
  for (const ns of namespaces) {
    writer.writeFString(ns.namespace)
    writer.writeU32(ns.keys.length)
    for (const key of ns.keys) {
      writer.writeFString(key.key)
      writer.writeU32(0) // source hash
      let idx = localizedStrings.indexOf(key.localized)
      if (idx === -1) { idx = localizedStrings.length; localizedStrings.push(key.localized) }
      writer.writeI32(idx)
    }
  }

  const lutOffset = writer.bytes().length
  const lut = new ByteWriter()
  lut.writeI32(localizedStrings.length)
  for (const s of localizedStrings) lut.writeFString(s)

  const header = writer.bytes()
  const patched = new Uint8Array(header.length)
  patched.set(header)
  new DataView(patched.buffer).setBigInt64(17, BigInt(lutOffset), true)

  const lutBytes = lut.bytes()
  const out = new Uint8Array(patched.length + lutBytes.length)
  out.set(patched)
  out.set(lutBytes, patched.length)
  return out
}

class ByteWriter {
  private chunks: Uint8Array[] = []
  writeU8(v: number) { this.chunks.push(new Uint8Array([v & 0xff])) }
  writeU32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.chunks.push(b) }
  writeI32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, true); this.chunks.push(b) }
  writeI64(v: number) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(v), true); this.chunks.push(b) }
  writeGuid(parts: readonly number[]) { for (const p of parts) this.writeU32(p) }
  writeFString(value: string) {
    const ascii = /^[\x00-\x7F]*$/u.test(value)
    if (ascii) {
      this.writeI32(value.length + 1)
      const b = new Uint8Array(value.length + 1)
      for (let i = 0; i < value.length; i += 1) b[i] = value.charCodeAt(i)
      this.chunks.push(b)
    } else {
      this.writeI32(-(value.length + 1))
      const b = new Uint8Array((value.length + 1) * 2)
      for (let i = 0; i < value.length; i += 1) { const c = value.charCodeAt(i); b[i * 2] = c & 0xff; b[i * 2 + 1] = c >> 8 }
      this.chunks.push(b)
    }
  }
  bytes(): Uint8Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0)
    const out = new Uint8Array(total)
    let o = 0
    for (const c of this.chunks) { out.set(c, o); o += c.length }
    return out
  }
}
