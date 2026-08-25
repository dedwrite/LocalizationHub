const WORKFLOW_STATUSES = new Set([
  'draft',
  'translated',
  'needs-review',
  'approved',
])

export function isValidCloudProjectV3(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return false
  if (project.format !== 'LocalizationHubProject' || project.version !== 3) return false
  if (typeof project.sourceFileName !== 'string') return false
  if (!Array.isArray(project.entries) || project.entries.length === 0) return false
  if (!project.entries.every((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.translation === 'string')) return false
  if (!project.workflow || typeof project.workflow !== 'object' || Array.isArray(project.workflow)) return false
  if (!project.workflow.entries || typeof project.workflow.entries !== 'object' || Array.isArray(project.workflow.entries)) return false
  return Object.values(project.workflow.entries).every((state) => state && typeof state === 'object' && WORKFLOW_STATUSES.has(state.status))
}
