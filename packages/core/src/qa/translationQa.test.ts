import { describe, expect, it } from 'vitest'
import { duplicateTranslationIds, duplicateTranslationIssue, translationQaIssues, type QaIssueKind } from './translationQa'

const kinds = (source: string, translation: string, profile: 'generic' | 'godot' | 'unreal' | 'unity' = 'generic') =>
  translationQaIssues(source, translation, profile).map((issue) => issue.kind)

describe('translation QA checks', () => {
  it('stays quiet for a translation that keeps everything the source carried', () => {
    expect(translationQaIssues('Save 3 slots?', 'احفظ ٣ خانات؟')).toEqual([])
    expect(translationQaIssues('Line one\nLine two', 'السطر الأول\nالسطر الثاني')).toEqual([])
    expect(translationQaIssues('Press <b>&amp; Start</b>', 'اضغط <b>&amp; ابدأ</b>')).toEqual([])
  })

  it('says nothing about an unstarted draft', () => {
    expect(translationQaIssues('Save 3 slots?', '   ')).toEqual([])
  })

  it('reports invisible direction and zero-width characters', () => {
    const issues = translationQaIssues('Save', `حفظ\u200F\u200F`, 'generic')
    const invisible = issues.find((issue) => issue.kind === 'invisible-characters')
    expect(invisible?.detail).toBe('U+200F ×2')
  })

  it('treats a replacement character as a blocking error', () => {
    const issues = translationQaIssues('Save', 'حفظ \uFFFD')
    expect(issues).toContainEqual(expect.objectContaining({ kind: 'replacement-character', severity: 'error' }))
  })

  it('reports lost and added line breaks', () => {
    expect(kinds('First\nSecond', 'الأول الثاني')).toContain('newline-dropped')
    expect(kinds('First', 'الأول\nالثاني')).toContain('newline-added')
  })

  it('reports edge spaces in both directions, never through a protected token', () => {
    expect(kinds(' Save', 'حفظ')).toContain('edge-space-dropped')
    expect(kinds('Save', 'حفظ ')).toContain('edge-space-added')
    expect(kinds('Save ', 'حفظ')).toContain('edge-space-dropped')
    // The edge is a token, so there is no space to compare.
    expect(kinds('[shake]Save[/shake]', 'حفظ')).not.toContain('edge-space-dropped')
  })

  it('reports a terminal mark the translation lost without judging a changed one', () => {
    const issues = translationQaIssues('Are you ready?', 'هل أنت مستعد')
    expect(issues).toContainEqual(expect.objectContaining({ kind: 'terminal-punctuation-dropped', detail: '?' }))
    // Keeping a mark, or choosing another one, is a translation decision.
    expect(kinds('Are you ready?', 'هل أنت مستعد؟')).not.toContain('terminal-punctuation-dropped')
    expect(kinds('Are you ready?', 'هل أنت مستعد!')).not.toContain('terminal-punctuation-dropped')
    // A mark the source never had is not reported at all.
    expect(kinds('Ready', 'مستعد.')).not.toContain('terminal-punctuation-dropped')
  })

  it('compares numbers across numeral systems and ignores protected placeholders', () => {
    const issues = translationQaIssues('You have 3 of 5 slots', 'لديك خمس خانات')
    expect(issues).toContainEqual(expect.objectContaining({ kind: 'number-dropped', detail: '3, 5' }))
    expect(kinds('You have 3 slots', 'لديك ٣ خانات')).not.toContain('number-dropped')
    expect(kinds('You have 3 slots', 'لديك ۳ خانات')).not.toContain('number-dropped')
    // {count} is a placeholder, so counting it as text would be a false positive.
    expect(kinds('Delete {count} entries', 'احذف {count} عنصر')).toEqual([])
    expect(kinds('Hello {0}', 'مرحبا 7')).not.toContain('number-added')
  })

  it('reports a number the translation invents only when the source had numbers', () => {
    expect(kinds('You have 3 slots', 'لديك 5 خانات')).toContain('number-added')
    expect(kinds('Hello', 'مرحبا 7')).not.toContain('number-added')
  })

  it('compares markup entities the token validator does not protect', () => {
    const issues = translationQaIssues('Tom &amp; Jerry', 'Tom & Jerry')
    expect(issues).toContainEqual(expect.objectContaining({ kind: 'entity-mismatch', detail: '&amp; missing' }))
    expect(kinds('Tom &amp; Jerry', 'توم &amp; جيري')).not.toContain('entity-mismatch')
    expect(kinds('&#39;Save&#39;', '&#39;حفظ&#39;')).not.toContain('entity-mismatch')
    // Protected markup tags belong to the token validator, never to this check.
    expect(kinds('Press <b>Start</b>', 'اضغط ابدأ')).not.toContain('entity-mismatch')
  })

  it('finds one translation reused for a different source', () => {
    const duplicates = duplicateTranslationIds([
      { id: 'a', source: 'Start', translation: 'ابدأ' },
      { id: 'b', source: 'Begin', translation: 'ابدأ' },
      { id: 'c', source: 'Stop', translation: 'توقف' },
      { id: 'd', source: 'Start', translation: 'ابدأ' },
      { id: 'e', source: 'Empty', translation: '' },
    ])
    expect([...duplicates.keys()].sort()).toEqual(['a', 'b', 'd'])
    expect(duplicates.get('a')).toBe('Begin')
    expect(duplicates.get('d')).toBe('Begin')
    expect(duplicateTranslationIssue('Begin').kind).toBe('duplicate-translation' satisfies QaIssueKind)
  })

  it('does not treat one repeated source as a duplicate', () => {
    expect(duplicateTranslationIds([
      { id: 'a', source: 'Start', translation: 'ابدأ' },
      { id: 'b', source: 'Start', translation: 'ابدأ' },
    ]).size).toBe(0)
  })
})
