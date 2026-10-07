import { expect, test } from 'vitest'
import { demoEntries, validateDemoTranslation, nextDemoState, initialDemoState } from './demoModel'

test('validation rejects missing, changed, duplicated tokens and empty text', () => {
  const source = 'Hold the line, {player_name}.'
  expect(validateDemoTranslation(source, 'اثبت يا {player_name}.').valid).toBe(true)
  for (const text of ['', 'اثبت.', 'اثبت {name}', '{player_name} {player_name}']) expect(validateDemoTranslation(source, text).valid).toBe(false)
})
test('story cycles through real translation and validation then resets', () => {
  const start = initialDemoState(false)
  expect(start.stage).toBe('select')
  const translated = nextDemoState(start, {type: 'advance'})
  expect(translated.translation).toBe('اثبُت يا {player_name}. لن تسقط البوابة الشمالية الليلة.')
  const validated = nextDemoState(translated, {type: 'advance'})
  expect(validated.stage).toBe('validate')
  expect(nextDemoState(validated, {type: 'advance'}).translation).toBe('')
})
test('manual edits pause autoplay and validation uses edited text', () => {
  const edited = nextDemoState(initialDemoState(false), {type: 'edit', value: 'نص بلا رمز'})
  expect(edited.paused).toBe(true)
  expect(nextDemoState(edited, {type: 'advance'})).toEqual(edited)
  expect(nextDemoState(edited, {type: 'validate'}).result?.valid).toBe(false)
  expect(nextDemoState(edited, {type: 'replay'}).paused).toBe(false)
})
test('selection clears old validation; reduced motion starts complete and paused', () => {
  const state = nextDemoState(initialDemoState(true), {type: 'select', id: 'ui.start'})
  expect(state.entry.id).toBe('ui.start')
  expect(state.result).toBeNull()
  expect(state.paused).toBe(true)
  expect(initialDemoState(true).stage).toBe('validate')
  expect(demoEntries).toHaveLength(5)
})
test('late initialization cannot overwrite a manual edit or focus takeover', () => {
  const edited = nextDemoState(initialDemoState(true), {type: 'edit', value: 'نصي'})
  expect(nextDemoState(edited, {type: 'start'}).translation).toBe('نصي')
  const focused = nextDemoState(initialDemoState(true), {type: 'pause'})
  expect(nextDemoState(focused, {type: 'start'}).paused).toBe(true)
  expect(nextDemoState(edited, {type: 'complete'}).translation).toBe('نصي')
})
