export const OPEN_COMMAND_CENTER_EVENT = 'localizationhub:open-command-center'
export const WORKSPACE_COMMAND_EVENT = 'localizationhub:workspace-command'
export const PROJECT_SEARCH_EVENT = 'localizationhub:project-search'
export type CenterMode = 'palette' | 'shortcuts'
export function openCommandCenter(mode: CenterMode = 'palette') {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_CENTER_EVENT, { detail: { mode } }))
}
