export type QuietCommand = {
  id: string
  label: string
  hint?: string
  keywords?: string
  group?: 'navigate' | 'workspace' | 'project' | 'system'
  run: () => void
}

type Listener = () => void

const registry = new Map<string, QuietCommand>()
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) listener()
}

export function registerQuietCommands(commands: QuietCommand[]): () => void {
  for (const command of commands) registry.set(command.id, command)
  notify()
  return () => {
    for (const command of commands) {
      if (registry.get(command.id) === command) registry.delete(command.id)
    }
    notify()
  }
}

export function listQuietCommands(): QuietCommand[] {
  return [...registry.values()]
}

export function subscribeQuietCommands(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function matchQuietCommands(query: string, commands = listQuietCommands()): QuietCommand[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return commands
  return commands.filter((command) => {
    const haystack = `${command.label} ${command.hint ?? ''} ${command.keywords ?? ''}`.toLocaleLowerCase()
    return haystack.includes(needle)
  })
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}
