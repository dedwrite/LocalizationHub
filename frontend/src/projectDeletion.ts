import type { CloudProjectRole, ProjectLocation } from '@localizationhub/core'
import { deleteCloudProject } from './cloudProjectsApi'

export function canDeleteOpenProject(location: ProjectLocation | null, role: CloudProjectRole | null): boolean {
  return location?.kind === 'cloud' && role === 'owner'
}

export async function deleteOpenCloudProject(location: ProjectLocation | null, role: CloudProjectRole | null, afterDeleted: () => void) {
  if (!canDeleteOpenProject(location, role) || location?.kind !== 'cloud') throw new Error('Only the Cloud Project owner can delete this project.')
  await deleteCloudProject(location.projectId)
  afterDeleted() // Never reset local state optimistically, or on a failed request.
}
