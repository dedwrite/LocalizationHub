import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './ToolsDependencies.css'

/*
 * Tools / Dependencies settings for the extraction pipeline.
 *
 * Configures optional external CLI tools for archive/binary formats. Paths are
 * stored locally only (never in projects, never in Cloud data). Status is
 * resolved by attempting `--version`; a non-zero/missing result is "Invalid".
 */

export type ToolId = 'repak' | 'retoc' | 'uassetdumper' | 'gdsdecomp' | 'unitypy'

export type ToolAdapter = {
  id: ToolId
  label: string
  engine: 'Unreal' | 'Godot' | 'Unity'
  description: string
  versionArgs: string[]
}

export const TOOL_ADAPTERS: ToolAdapter[] = [
  { id: 'repak', label: 'repak', engine: 'Unreal', description: 'Unreal .pak reader/writer', versionArgs: ['--version'] },
  { id: 'retoc', label: 'retoc', engine: 'Unreal', description: 'Unreal IoStore (.utoc/.ucas) reader', versionArgs: ['--version'] },
  { id: 'uassetdumper', label: 'UAssetDumper', engine: 'Unreal', description: 'Unreal .uasset → JSON', versionArgs: [] },
  { id: 'gdsdecomp', label: 'gdsdecomp', engine: 'Godot', description: 'Godot .pck extraction', versionArgs: ['--version'] },
  { id: 'unitypy', label: 'UnityPy', engine: 'Unity', description: 'Unity serialized-asset reader', versionArgs: ['--version'] },
]

const STORAGE_KEY = 'localizationhub.tools'

type ToolStatus = { id: ToolId; status: 'found' | 'not-configured' | 'invalid'; version?: string }

function loadConfigs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export default function ToolsDependencies({ onClose }: { onClose: () => void }) {
  const [configs, setConfigs] = useState<Record<string, string>>(loadConfigs)
  const [statuses, setStatuses] = useState<Record<string, ToolStatus>>({})
  const [testing, setTesting] = useState<ToolId | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  }, [configs])

  async function testTool(adapter: ToolAdapter) {
    const path = configs[adapter.id]
    if (!path) return
    setTesting(adapter.id)
    try {
      const result = await invoke<{ code: number; stdout: string; stderr: string }>('run_external_tool', {
        executable: path,
        args: adapter.versionArgs,
      })
      const version = (result.stdout || result.stderr).trim().split('\n')[0]?.slice(0, 80) ?? ''
      setStatuses((current) => ({
        ...current,
        [adapter.id]: { id: adapter.id, status: result.code === 0 ? 'found' : 'invalid', version: version || undefined },
      }))
    } catch {
      setStatuses((current) => ({ ...current, [adapter.id]: { id: adapter.id, status: 'invalid' } }))
    } finally {
      setTesting(null)
    }
  }

  function clearTool(id: ToolId) {
    setConfigs((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setStatuses((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  return (
    <main className="tools-deps">
      <header className="td-header">
        <h1>Tools / Dependencies</h1>
        <button className="td-close" onClick={onClose}>Done</button>
      </header>
      <p className="td-lede">
        Optional external tools unlock archive and binary engine formats. Configure a tool path to enable
        its adapter; paths are stored locally only and never uploaded.
      </p>

      <div className="td-list">
        {TOOL_ADAPTERS.map((adapter) => {
          const status = statuses[adapter.id]?.status ?? (configs[adapter.id] ? 'found' : 'not-configured')
          return (
            <section key={adapter.id} className="td-card">
              <div className="td-card-head">
                <strong>{adapter.label}</strong>
                <span className={`td-status td-${status}`}>{status.replace('-', ' ')}</span>
              </div>
              <p className="td-desc">{adapter.engine} · {adapter.description}</p>
              <div className="td-row">
                <input
                  className="td-path"
                  value={configs[adapter.id] ?? ''}
                  onChange={(event) => setConfigs((current) => ({ ...current, [adapter.id]: event.target.value }))}
                  placeholder="Executable path"
                  aria-label={`${adapter.label} path`}
                />
                <button className="td-button" onClick={() => testTool(adapter)} disabled={!configs[adapter.id] || testing === adapter.id}>
                  {testing === adapter.id ? 'Testing…' : 'Test'}
                </button>
                <button className="td-button" onClick={() => clearTool(adapter.id)} disabled={!configs[adapter.id]}>Clear</button>
              </div>
              {statuses[adapter.id]?.version && <p className="td-version">{statuses[adapter.id].version}</p>}
            </section>
          )
        })}
      </div>
    </main>
  )
}
