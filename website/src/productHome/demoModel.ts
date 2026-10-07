import { validateProtectedTokens } from '@localizationhub/core'

export type DemoStage = 'select' | 'translate' | 'validate'
export type DemoEntry = {id: string; source: string; translation: string}
export const demoEntries: readonly DemoEntry[] = [
  {id: 'quest.northern_gate', source: 'Hold the line, {player_name}. The Northern Gate does not fall tonight.', translation: 'اثبت يا {player_name}. البوابة الشمالية لن تسقط الليلة.'},
  {id: 'ui.start', source: 'Start game', translation: 'ابدأ اللعبة'},
  {id: 'npc.veyra.line', source: 'The gate still holds.', translation: 'ما زالت البوابة صامدة.'},
  {id: 'item.old_key', source: 'Old iron key', translation: 'مفتاح حديدي قديم'},
  {id: 'sys.warning', source: 'Connection lost', translation: 'انقطع الاتصال'},
]
export function validateDemoTranslation(source: string, translation: string) {
  const result = validateProtectedTokens(source, translation, 'generic')
  return {valid: Boolean(translation.trim()) && result.missingTokens.length === 0 && result.extraTokens.length === 0 && result.errors.length === 0, missing: result.missingTokens.map(token => token.raw)}
}
export type DemoState = {stage: DemoStage; entry: DemoEntry; translation: string; paused: boolean; result: ReturnType<typeof validateDemoTranslation> | null; manual: boolean}
export type DemoAction = {type: 'advance' | 'pause' | 'replay' | 'validate'} | {type: 'edit'; value: string} | {type: 'select'; id: string}
export function initialDemoState(reduced: boolean): DemoState {
  const entry = demoEntries[0]
  return {stage: reduced ? 'validate' : 'select', entry, translation: reduced ? entry.translation : '', paused: reduced, result: reduced ? validateDemoTranslation(entry.source, entry.translation) : null, manual: false}
}
export function nextDemoState(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'edit': return {...state, translation: action.value, paused: true, stage: 'translate', result: null, manual: true}
    case 'select': { const entry = demoEntries.find(item => item.id === action.id); return entry ? {...state, entry, translation: entry.translation, paused: true, stage: 'translate', result: null, manual: true} : state }
    case 'pause': return {...state, paused: true}
    case 'replay': return initialDemoState(false)
    case 'validate': return {...state, paused: true, stage: 'validate', manual: true, result: validateDemoTranslation(state.entry.source, state.translation)}
    case 'advance':
      if (state.paused) return state
      if (state.stage === 'select') return {...state, stage: 'translate', translation: state.entry.translation}
      if (state.stage === 'translate') return {...state, stage: 'validate', result: validateDemoTranslation(state.entry.source, state.translation)}
      return initialDemoState(false)
  }
}
