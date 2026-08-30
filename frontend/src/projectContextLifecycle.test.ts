/// <reference types="node" />
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { decodeLocalizationProject, parseLocalizationFile, type LocalizationProjectV3 } from '@localizationhub/core'
import { desktopProjectStorage } from './projectFiles'
import { cloudProjectStorage } from './cloudProjectStorage'
import { createCloudProject } from './cloudProjectsApi'

// Replace only native filesystem IPC; exercise the real Desktop storage code.
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (path: string) => readFile(path, 'utf8'),
  writeTextFile: (path: string, content: string) => writeFile(path, content, 'utf8'),
}))
vi.mock('./authSession', () => ({ getAuthToken: () => 'synthetic-token' }))
vi.mock('./runtimeConfig', () => ({ getCloudApiBaseUrl: () => 'http://test.invalid' }))
afterEach(() => vi.unstubAllGlobals())

it('retains Caloy/Mark through Desktop open state, .lhproj save/reopen, cloud request and cloud storage load', async () => {
  const text = await readFile(new URL('../../tests/fixtures/caloy-mark.json', import.meta.url), 'utf8')
  const parsed = parseLocalizationFile(text, 'caloy-mark.json')
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) return
  // App's open-file state keeps these entries; createCurrentProject includes
  // that same state, with no DTO reconstruction or context re-parsing.
  const entries = parsed.document.entries
  const context = entries[0].dialogueContext
  expect(context).toMatchObject({ speaker: 'Caloy', speakerGender: 'male', listener: 'Mark', listenerGender: 'male', scene: '4/Assembly.1d.inkb' })
  const project: LocalizationProjectV3 = { format: 'LocalizationHubProject', version: 3, sourceFileName: 'caloy-mark.json', selectedEntryId: entries[0].id, tokenProfile: 'auto', document: parsed.document, entries, workflow: { entries: {} } }
  const directory = await mkdtemp(join(tmpdir(), 'lh-context-lifecycle-'))
  const path = join(directory, 'test.lhproj')
  try {
    await desktopProjectStorage.save({ kind: 'local', path }, project)
    const serialized = await readFile(path, 'utf8')
    expect(JSON.parse(serialized).entries[0].dialogueContext).toEqual(context)
    const decoded = decodeLocalizationProject(serialized)
    expect(decoded.ok && decoded.project.entries[0].dialogueContext).toEqual(context)
    const reopened = await desktopProjectStorage.load({ kind: 'local', path })
    expect(reopened.project.entries[0].dialogueContext).toEqual(context)
    let stored: any
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'POST' || init.method === 'PUT') stored = JSON.parse(init.body as string).project
      return new Response(JSON.stringify({ project: { id: 'test-project', name: 'Synthetic', role: 'owner', revision: 1, updatedAt: '2026-08-30T00:00:00Z', project: stored } }), { status: 200 })
    }))
    await createCloudProject({ name: 'Synthetic', project: reopened.project })
    expect(stored.entries[0].dialogueContext).toEqual(context)
    const loaded = await cloudProjectStorage.load({ kind: 'cloud', projectId: 'test-project' })
    expect(loaded.project.entries[0].dialogueContext).toEqual(context)
    await cloudProjectStorage.save({ kind: 'cloud', projectId: 'test-project' }, loaded.project, { baseRevision: 1 })
    expect(stored.entries[0].dialogueContext).toEqual(context)
    expect(stored.entries[0].source).toBe(JSON.parse(text)[0].text_en)
  } finally {
    await unlink(path).catch(() => undefined)
    await rmdir(directory)
  }
})
