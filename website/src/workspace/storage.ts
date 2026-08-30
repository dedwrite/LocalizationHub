import type { LocalizationProjectV3 } from '@localizationhub/core'
import { getProject, saveProject, type ProjectSnapshot } from '../appApi'
import { saveLocalProject } from '../localProjects'

/** Persistence is the only boundary that knows whether a project is remote.
 * Local adapters never call the Cloud API; collaboration is a separate capability.
 */
export interface WorkspaceStorage {
  kind: 'local' | 'cloud'
  id: string
  persisted?: boolean
  load: () => Promise<ProjectSnapshot>
  save: (project: LocalizationProjectV3, revision: number) => Promise<ProjectSnapshot>
}

export function cloudWorkspaceStorage(id: string): WorkspaceStorage {
  return { kind: 'cloud', id, load: () => getProject(id), save: (project, revision) => saveProject(id, revision, project) }
}

export function localWorkspaceStorage(id: string, initial: LocalizationProjectV3, savedAt?: string): WorkspaceStorage {
  // The shared editor's snapshot envelope is internal, never uploaded. Local
  // capability checks suppress Cloud roles, revision and collaboration UI.
  const snapshot = (project: LocalizationProjectV3, updatedAt: string): ProjectSnapshot => ({ id, name: project.sourceFileName, project: structuredClone(project), updatedAt, revision: 0, role: 'owner', migratedFromVersion: null })
  return {
    kind: 'local', id, persisted: Boolean(savedAt),
    load: async () => snapshot(initial, savedAt ?? new Date().toISOString()),
    save: async (project) => {
      await saveLocalProject(id, project)
      return snapshot(project, new Date().toISOString())
    },
  }
}
