import { useEffect, useLayoutEffect, useReducer } from 'react'
import { initialDemoState, nextDemoState } from './demoModel'

export function useDemoStory({reducedMotion, visible}: {reducedMotion: boolean; visible: boolean}) {
  const [state, dispatch] = useReducer(nextDemoState, reducedMotion, initialDemoState)
  useEffect(() => {
    if (reducedMotion) dispatch({type: 'complete'})
  }, [reducedMotion])
  useLayoutEffect(() => {
    if (!visible || reducedMotion || state.paused) return
    const delay = {select: 4000, translate: 6000, validate: 6000}[state.stage]
    const timer = setTimeout(() => {
      // Re-check at execution, not just scheduling: visibility can change
      // before React flushes this effect's cleanup (notably WebKit).
      if (document.visibilityState === 'visible') dispatch({type: 'advance'})
    }, delay)
    return () => clearTimeout(timer)
  }, [visible, reducedMotion, state.paused, state.stage])
  return {...state,
    selectEntry: (id: string) => dispatch({type: 'select', id}),
    editTranslation: (value: string) => dispatch({type: 'edit', value}),
    validate: () => dispatch({type: 'validate'}),
    pause: () => dispatch({type: 'pause'}),
    start: () => dispatch({type: 'start'}),
    replay: () => dispatch({type: reducedMotion ? 'reset-complete' : 'replay'}),
  }
}
