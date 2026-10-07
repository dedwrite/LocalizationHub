const sections = new Set(['product', 'engines', 'extraction', 'context', 'workspace', 'workflow', 'cloud', 'privacy', 'faq', 'formats', 'arabic'])
export function legacyProductDestination(hash: string): string | null {
  try { const id = decodeURIComponent(hash.replace(/^#/, '')); return sections.has(id) ? `/product#${encodeURIComponent(id)}` : null } catch { return null }
}
