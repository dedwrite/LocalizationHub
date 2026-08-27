import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import CustomProtectedPatterns from './CustomProtectedPatterns'
import './ToolsDependencies.css'

/*
 * Tools / Dependencies settings for the extraction pipeline.
 *
 * Configures optional external CLI tools for archive/binary formats. Paths are
 * stored locally only (never in projects, never in Cloud data). A tool is only
 * "Ready" after its per-tool version/test contract succeeds; a typed path is
 * merely "Configured (unverified)".
 */

export type ToolId = 'repak' | 'retoc' | 'uassetdumper' | 'gdre' | 'unitypy'

export type ToolStatus =
  | 'not-configured'
  | 'configured-unverified'
  | 'testing'
  | 'ready'
  | 'invalid'
  | 'unsupported-version'

export type ToolAdapter = {
  id: ToolId
  label: string
  engine: 'Unreal' | 'Godot' | 'Unity'
  description: string
  // Version-detection args. Empty means "no reliable version flag"; testing
  // then uses the probeArgs instead.
  versionArgs: string[]
  // Args used to prove the tool actually works (e.g. `--help`).
  probeArgs: string[]
  // When true, the tool has no version/probe command and can only be verified
  // by running it against a real asset during Scan Game.
  noProbe?: boolean
  // When true, a second config field (the UnityPy helper script) is shown.
  needsScript?: boolean
}

export const TOOL_ADAPTERS: ToolAdapter[] = [
  { id: 'repak', label: 'repak', engine: 'Unreal', description: 'Unreal .pak reader/writer', versionArgs: ['--version'], probeArgs: ['--help'] },
  { id: 'retoc', label: 'retoc', engine: 'Unreal', description: 'Unreal IoStore (.utoc/.ucas) reader', versionArgs: ['--version'], probeArgs: ['--help'] },
  { id: 'uassetdumper', label: 'UAssetDumper', engine: 'Unreal', description: 'Unreal .uasset → JSON (UE4.27)', versionArgs: [], probeArgs: [], noProbe: true },
  { id: 'gdre', label: 'gdre_tools', engine: 'Godot', description: 'Godot PCK/resource recovery', versionArgs: ['--gdre-version'], probeArgs: ['--help'] },
  { id: 'unitypy', label: 'UnityPy', engine: 'Unity', description: 'Unity serialized-asset reader (Python helper)', versionArgs: ['-c', 'import UnityPy; print(UnityPy.__version__)'], probeArgs: ['-c', 'import UnityPy; print(UnityPy.__version__)'], needsScript: true },
]

const STORAGE_KEY = 'localizationhub.tools'

type ToolState = { status: ToolStatus; version?: string }

function loadConfigs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export default function ToolsDependencies({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'dependencies' | 'profile'>('dependencies')
  const [configs, setConfigs] = useState<Record<string, string>>(loadConfigs)
  const [states, setStates] = useState<Record<string, ToolState>>({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  }, [configs])

  function deriveStatus(id: ToolId): ToolStatus {
    return states[id]?.status ?? (configs[id] ? 'configured-unverified' : 'not-configured')
  }

  async function browse(adapter: ToolAdapter) {
    const selected = await open({ directory: false, multiple: false, title: `Locate ${adapter.label}` })
    if (typeof selected === 'string') {
      setConfigs((current) => ({ ...current, [adapter.id]: selected }))
      // Editing the path resets to unverified.
      setStates((current) => ({ ...current, [adapter.id]: { status: 'configured-unverified' } }))
    }
  }

  async function testTool(adapter: ToolAdapter) {
    const path = configs[adapter.id]
    if (!path) return
    if (adapter.noProbe) return

    setStates((current) => ({ ...current, [adapter.id]: { status: 'testing' } }))

    try {
      // Use version args if present; otherwise probe with the probe args.
      const args = adapter.versionArgs.length > 0 ? adapter.versionArgs : adapter.probeArgs
      const result = await invoke<{ code: number; stdout: string; stderr: string }>('run_external_tool', {
        executable: path,
        args,
      })
      const output = (result.stdout || result.stderr).trim()
      const firstLine = output.split('\n')[0]?.slice(0, 80) ?? ''

      if (result.code !== 0) {
        setStates((current) => ({ ...current, [adapter.id]: { status: 'invalid' } }))
        return
      }
      setStates((current) => ({
        ...current,
        [adapter.id]: { status: 'ready', version: firstLine || undefined },
      }))
    } catch {
      setStates((current) => ({ ...current, [adapter.id]: { status: 'invalid' } }))
    }
  }

  function clearTool(id: ToolId) {
    setConfigs((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setStates((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const depsTabClass = tab === 'dependencies' ? 'td-tab td-tab-active' : 'td-tab'
  const profileTabClass = tab === 'profile' ? 'td-tab td-tab-active' : 'td-tab'

  if (tab === 'profile') {
    return <CustomProtectedPatterns onClose={onClose} />
  }

  return (
    <main className="tools-deps">
      <header className="td-header">
        <h1>Tools / Dependencies</h1>
        <div className="td-header-actions">
          <button className={depsTabClass} onClick={() => setTab('dependencies')}>
            Dependencies
          </button>
          <button className={profileTabClass} onClick={() => setTab('profile')}>
            Extraction Profile
          </button>
          <button className="td-close" onClick={onClose}>Done</button>
        </div>
      </header>
      <p className="td-lede">
        Optional external tools unlock archive and binary engine formats. A tool is only Ready after its
        version test succeeds. Paths are stored locally only and never uploaded.
      </p>

      <div className="td-list">
        {TOOL_ADAPTERS.map((adapter) => {
          const status = deriveStatus(adapter.id)
          return (
            <section key={adapter.id} className="td-card">
              <div className="td-card-head">
                <strong>{adapter.label}</strong>
                <span className={`td-status td-${status}`}>{status.replace(/-/g, ' ')}</span>
              </div>
              <p className="td-desc">{adapter.engine} · {adapter.description}</p>
              <div className="td-row">
                <input
                  className="td-path"
                  value={configs[adapter.id] ?? ''}
                  onChange={(event) => {
                    setConfigs((current) => ({ ...current, [adapter.id]: event.target.value }))
                    setStates((current) => ({ ...current, [adapter.id]: { status: 'configured-unverified' } }))
                  }}
                  placeholder="Executable path"
                  aria-label={`${adapter.label} path`}
                />
                <button className="td-button" onClick={() => browse(adapter)}>Browse</button>
                <button
                  className="td-button"
                  onClick={() => testTool(adapter)}
                  disabled={!configs[adapter.id] || status === 'testing' || adapter.noProbe}
                  title={adapter.noProbe ? 'No version probe available; verified during Scan Game' : undefined}
                >
                  {status === 'testing' ? 'Testing…' : 'Test'}
                </button>
                <button className="td-button" onClick={() => clearTool(adapter.id)} disabled={!configs[adapter.id]}>Clear</button>
              </div>
              {adapter.needsScript && (
                <div className="td-row">
                  <input
                    className="td-path"
                    value={configs['unitypyScript'] ?? ''}
                    onChange={(event) => setConfigs((current) => ({ ...current, unitypyScript: event.target.value }))}
                    placeholder="UnityPy helper script (.py) — ships with the app by default"
                    aria-label="UnityPy helper script path"
                  />
                </div>
              )}
              {states[adapter.id]?.version && <p className="td-version">{states[adapter.id].version}</p>}
            </section>
          )
        })}
      </div>
    </main>
  )
}
