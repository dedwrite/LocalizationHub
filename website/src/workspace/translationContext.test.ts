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

describe('buildTranslationContext', () => {
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
