/*
 * Unity Dialogue System (Pixel Crushers MasterDialogueDatabase) precision.
 *
 * The generic structured analyzer previously treated the `title` of each typed
 * custom field ("Name", "Description", "Display Name en/zh/ja/…") as Menu text
 * — a 45k-entry false-positive surface. The dedicated extractor now maps
 * Actor/Conversant ids to names and skips schema titles, booleans, file lists,
 * poses, and sequence strings.
 */

import { describe, expect, it } from 'vitest'
import { extractUnity } from './engines/unity'

/* Minimal MasterDialogueDatabase shape (UnityPy { name, type, tree } wrapper). */
function dialogueDbJson(): string {
  const db = {
    name: 'object',
    type: 'MonoBehaviour',
    tree: {
      actors: [
        {
          id: 1,
          fields: [
            { title: 'Name', value: 'Watcher', type: 0, typeString: 'CustomFieldType_Text' },
            { title: 'Display Name', value: 'Watcher', type: 0, typeString: 'CustomFieldType_Text' },
            { title: 'Display Name ja', value: 'ウォッチャー', type: 4, typeString: 'CustomFieldType_Localization' },
            { title: 'IsPlayer', value: 'True', type: 2, typeString: 'CustomFieldType_Boolean' },
            { title: 'Pictures', value: '[]', type: 3, typeString: 'CustomFieldType_Files' },
          ],
        },
        {
          id: 2,
          fields: [
            { title: 'Name', value: 'Teacher', type: 0, typeString: 'CustomFieldType_Text' },
            { title: 'Display Name', value: 'Teacher', type: 0, typeString: 'CustomFieldType_Text' },
          ],
        },
      ],
      items: [
        {
          id: 9,
          fields: [
            { title: 'Name', value: 'Paintbrush', type: 0, typeString: 'CustomFieldType_Text' },
            { title: 'Display Name', value: 'Paintbrush', type: 0, typeString: 'CustomFieldType_Text' },
            { title: 'Display Name fr', value: 'Pinceau', type: 4, typeString: 'CustomFieldType_Localization' },
          ],
        },
      ],
      conversations: [
        {
          id: 78,
          fields: [{ title: 'Title', value: 'artroom/timeline1', type: 0, typeString: 'CustomFieldType_Text' }],
          dialogueEntries: [
            {
              id: 3,
              fields: [
                { title: 'Title', value: '', type: 0, typeString: 'CustomFieldType_Text' },
                { title: 'Actor', value: 1, type: 5, typeString: 'CustomFieldType_Actor' },
                { title: 'Conversant', value: 2, type: 5, typeString: 'CustomFieldType_Actor' },
                { title: 'Dialogue Text', value: 'Your last self-portrait was good.', type: 0, typeString: 'CustomFieldType_Text' },
                { title: 'Menu Text', value: '', type: 0, typeString: 'CustomFieldType_Text' },
                { title: 'Sequence', value: '', type: 0, typeString: 'CustomFieldType_Text' },
                { title: 'ja', value: 'この間の自画像はよく描けていた。', type: 4, typeString: 'CustomFieldType_Localization' },
                { title: 'fr', value: 'Ton dernier autoportrait était bien.', type: 4, typeString: 'CustomFieldType_Localization' },
              ],
            },
            {
              id: 5,
              fields: [
                { title: 'Actor', value: 1, type: 5, typeString: 'CustomFieldType_Actor' },
                { title: 'Conversant', value: 2, type: 5, typeString: 'CustomFieldType_Actor' },
                { title: 'Menu Text', value: 'Leave', type: 0, typeString: 'CustomFieldType_Text' },
                { title: 'Dialogue Text', value: '', type: 0, typeString: 'CustomFieldType_Text' },
              ],
            },
          ],
        },
      ],
    },
  }
  return JSON.stringify(db)
}

describe('Unity Dialogue System extraction', () => {
  it('extracts dialogue lines with speaker/listener and locale variants', () => {
    const result = extractUnity({ fileName: 'monobehaviours/00000_mono.json', text: dialogueDbJson() })
    expect(result.diagnostics).toEqual([])

    const dialogue = result.entries.filter((e) => e.classification === 'Dialogue')
    expect(dialogue).toHaveLength(1)
    expect(dialogue[0].sourceText).toBe('Your last self-portrait was good.')
    expect(dialogue[0].context?.speaker).toBe('Watcher')
    expect(dialogue[0].context?.listener).toBe('Teacher')
    expect(dialogue[0].context?.conversationId).toBe('78')
    expect(dialogue[0].localeVariants?.map((v) => v.locale).sort()).toEqual(['fr', 'ja'])

    const choice = result.entries.find((e) => e.classification === 'Choice')
    expect(choice?.sourceText).toBe('Leave')
    expect(choice?.context?.speaker).toBe('Watcher')

    const character = result.entries.filter((e) => e.classification === 'CharacterName')
    expect(character.some((e) => e.sourceText === 'Watcher')).toBe(true)
    expect(character.find((e) => e.sourceText === 'Watcher')?.localeVariants?.map((v) => v.locale)).toEqual(['ja'])

    const item = result.entries.find((e) => e.classification === 'ItemName')
    expect(item?.sourceText).toBe('Paintbrush')
    expect(item?.localeVariants?.map((v) => v.locale)).toEqual(['fr'])
  })

  it('does NOT emit schema titles, booleans, or file lists', () => {
    const result = extractUnity({ fileName: 'monobehaviours/00000_mono.json', text: dialogueDbJson() })
    const allText = result.entries.map((e) => e.sourceText)
    for (const banned of ['Name', 'Description', 'IsPlayer', 'Display Name', 'Title', 'True', 'False', '[]', 'Sequence']) {
      expect(allText).not.toContain(banned)
    }
  })
})
