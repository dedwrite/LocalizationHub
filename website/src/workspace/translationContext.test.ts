/*
 * MT context prompting test.
 *
 * Proves the final outbound system instruction includes concise, proven local
 * context (speaker/listener/gender/scene/conversation/prev-next) and NEVER
 * includes absolute paths or guessed gender. `buildSystemInstruction` and
 * `buildTranslationContext` are pure so the request prompt is testable without
 * a network call.
 */

import { describe, expect, it } from 'vitest'
import { buildSystemInstruction, buildTranslationContext } from './translationProviders'
import { buildProjectFromExtraction, decodeLocalizationProject, extractInkb } from '@localizationhub/core'

describe('buildTranslationContext', () => {
  it('carries inferred INKB context through project round-trip into the MT reference exactly once', () => {
    const body = new TextEncoder().encode('characters: {"Ada":"actor-a","Bo":"actor-b"}\0$ pass\0Ada: Synthetic greeting.\0Bo: Synthetic reply.\0NOP\0')
    const binary = new Uint8Array(10 + body.length)
    binary.set(body, 10)
    const extracted = extractInkb('synthetic/hall.inkb', binary)
    const decoded = decodeLocalizationProject(JSON.stringify(buildProjectFromExtraction(extracted, 'synthetic.extracted')))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const entry = decoded.project.entries[0]
    const context = decoded.project.metadata?.extraction?.entries[entry.id]?.context
    expect(entry.dialogueContext).toBeUndefined() // no duplicate persisted context
    expect(context?.listenerId).toBe('actor-b')
    expect(context?.listenerProvenance).toEqual({ source: 'structural-inference', confidence: 'medium' })
    const instruction = buildSystemInstruction({ apiKey: 'synthetic-key', text: entry.source, targetLanguage: 'ar', context: buildTranslationContext(context) })
    expect(instruction.match(/Listener: Bo/g)).toHaveLength(1)
    expect(instruction).toContain('Speaker: Ada | Listener: Bo | Scene: synthetic/hall')
    expect(instruction).not.toMatch(/\((?:male|female|unknown)\)/)
  })
  it('builds a concise context line from explicit fields', () => {
    const line = buildTranslationContext({
      speaker: 'Mark',
      speakerGender: 'male',
      listener: 'Cathy',
      listenerGender: 'female',
      scene: 'School Hallway',
      conversationId: 'conv-1',
    })
    expect(line).toContain('Speaker: Mark (male)')
    expect(line).toContain('Listener: Cathy (female)')
    expect(line).toContain('Scene: School Hallway')
    expect(line).toContain('Conversation: conv-1')
  })

  it('omits unknown gender and empty fields', () => {
    const line = buildTranslationContext({ speaker: 'Mark', speakerGender: 'unknown' })
    expect(line).toBe('Speaker: Mark')
    expect(line).not.toContain('unknown')
  })

  it('strips absolute paths defensively', () => {
    const line = buildTranslationContext({ scene: 'C:\\Games\\Foo\\level1' })
    expect(line).not.toContain('C:\\Games')
  })
})

describe('buildSystemInstruction', () => {
  it('includes the context line when present', () => {
    const instruction = buildSystemInstruction({
      apiKey: 'x',
      text: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      context: 'Speaker: Mark (male) | Scene: Hall',
    })
    expect(instruction).toContain('Speaker: Mark (male)')
    expect(instruction).toContain('Scene: Hall')
    expect(instruction).toContain('reference only, never translate or output it')
  })

  it('omits context when absent', () => {
    const instruction = buildSystemInstruction({ apiKey: 'x', text: 'Hello', sourceLanguage: 'en', targetLanguage: 'ar' })
    expect(instruction).not.toContain('reference only')
  })
})
