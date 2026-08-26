/*
 * Client-side structural validation for LocalizationHub Project V3 payloads.
 *
 * A lightweight mirror of the server's Project V3 validator. Prevents sending
 * malformed payloads (including the historical bug where an updater function
 * was accidentally serialized) and surfaces a useful diagnostic instead of an
 * opaque `invalid-request`.
 */

const WORKFLOW_STATUSES = new Set(['draft', 'translated', 'needs-review', 'approved'])

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export function validateProjectV3(project: unknown): ValidationResult {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    return { ok: false, reason: 'Project payload is missing or not an object.' }
  }

  const value = project as Record<string, unknown>

  if (value.format !== 'LocalizationHubProject' || value.version !== 3) {
    return { ok: false, reason: 'Project is not a valid LocalizationHub Project V3.' }
  }

  if (typeof value.sourceFileName !== 'string') {
    return { ok: false, reason: 'Project source file name is missing.' }
  }

  if (!Array.isArray(value.entries)) {
    return { ok: false, reason: 'Project entries are missing.' }
  }

  const workflow = value.workflow
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return { ok: false, reason: 'Project workflow is missing.' }
  }

  const workflowEntries = (workflow as Record<string, unknown>).entries
  if (!workflowEntries || typeof workflowEntries !== 'object' || Array.isArray(workflowEntries)) {
    return { ok: false, reason: 'Project workflow entries are missing.' }
  }

  for (const state of Object.values(workflowEntries as Record<string, unknown>)) {
    if (!state || typeof state !== 'object' || !WORKFLOW_STATUSES.has((state as { status?: string }).status ?? '')) {
      return { ok: false, reason: 'Project contains an invalid workflow status.' }
    }
  }

  return { ok: true }
}
