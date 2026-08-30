import { afterEach, expect, it, vi } from 'vitest'
import { canDeleteOpenProject, deleteOpenCloudProject } from './projectDeletion'
import { deleteCloudProject } from './cloudProjectsApi'
vi.mock('./cloudProjectsApi', () => ({ deleteCloudProject: vi.fn() }))
afterEach(() => vi.resetAllMocks())
it.each(['editor', 'viewer', null] as const)('does not expose or call Cloud deletion for %s', async (role) => {
  expect(canDeleteOpenProject({ kind: 'cloud', projectId: 'test' }, role)).toBe(false)
  await expect(deleteOpenCloudProject({ kind: 'cloud', projectId: 'test' }, role, vi.fn())).rejects.toThrow()
  expect(deleteCloudProject).not.toHaveBeenCalled()
})
it('never permits server deletion of ordinary .lhproj files', async () => {
  const local = { kind: 'local' as const, path: 'safe.lhproj' }
  expect(canDeleteOpenProject(local, 'owner')).toBe(false)
  await expect(deleteOpenCloudProject(local, 'owner', vi.fn())).rejects.toThrow()
  expect(deleteCloudProject).not.toHaveBeenCalled()
})
it('resets the workspace only after an owner deletion succeeds', async () => {
  let resolve!: () => void
  vi.mocked(deleteCloudProject).mockReturnValue(new Promise<void>((done) => { resolve = done }))
  const reset = vi.fn()
  const pending = deleteOpenCloudProject({ kind: 'cloud', projectId: 'owned' }, 'owner', reset)
  expect(reset).not.toHaveBeenCalled()
  resolve(); await pending
  expect(deleteCloudProject).toHaveBeenCalledWith('owned')
  expect(reset).toHaveBeenCalledOnce()
})
it('preserves workspace and dirty state on failure', async () => {
  vi.mocked(deleteCloudProject).mockRejectedValue(new Error('network'))
  const reset = vi.fn()
  await expect(deleteOpenCloudProject({ kind: 'cloud', projectId: 'owned' }, 'owner', reset)).rejects.toThrow('network')
  expect(reset).not.toHaveBeenCalled()
})
