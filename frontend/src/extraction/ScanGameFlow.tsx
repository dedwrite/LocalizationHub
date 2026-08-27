import { useCallback, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile, readTextFile } from '@tauri-apps/plugin-fs'
import {
  scanGame,
  buildProjectFromExtraction,
  type ExtractionResult,
  type ScanFile,
  type ScanProgress,
  type LocalizationProjectV3,
  type ContextFieldMapping,
} from '@localizationhub/core'
import ExtractionReview from './ExtractionReview'
import './ScanGameFlow.css'

type ScannedFileResult = { path: string; size: number }
type ScanDiscovery = { files: ScannedFileResult[]; directories: string[] }

type Props = {
  onProjectCreated: (project: LocalizationProjectV3) => void
  onCancel: () => void
}

type Phase = 'choosing' | 'scanning' | 'reviewing' | 'error'

export default function ScanGameFlow({ onProjectCreated, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('choosing')
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState('')
  const cancelledRef = useRef(false)
  // Retained so "Apply & Rerun" can re-run extraction against the same input.
  const discoveryRef = useRef<{ files: ScanFile[]; directories: string[] } | null>(null)

  const runScan = useCallback(async (discovery: { files: ScanFile[]; directories: string[] }, mappings?: ContextFieldMapping[]) => {
    setPhase('scanning')
    setError('')

    const reader = {
      // IO always uses the absolute path; provenance uses relativePath.
      readText: async (file: ScanFile) => readTextFile(file.absolutePath),
      readBinary: async (file: ScanFile) => new Uint8Array(await readFile(file.absolutePath)),
    }

    try {
      const scanResult = await scanGame({
        files: discovery.files,
        directories: discovery.directories,
        mappings,
        reader,
        signal: { get cancelled() { return cancelledRef.current } },
        onProgress: setProgress,
      })
      setResult(scanResult)
      setPhase('reviewing')
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Scan failed.')
      setPhase('error')
    }
  }, [])

  const beginFolderScan = useCallback(async (root: string) => {
    setPhase('scanning')
    const discovery = await invoke<ScanDiscovery>('scan_directory', { root })
    const files: ScanFile[] = discovery.files.map((file) => ({
      name: file.path.split('/').pop() ?? file.path,
      relativePath: file.path, // project-relative (safe provenance)
      absolutePath: `${root}/${file.path}`, // desktop runtime only
      size: file.size,
    }))
    discoveryRef.current = { files, directories: discovery.directories }
    await runScan({ files, directories: discovery.directories })
  }, [runScan])

  const beginFileScan = useCallback(async (filePath: string) => {
    setPhase('scanning')
    const name = filePath.split(/[\\/]/u).pop() ?? filePath
    const file: ScanFile = { name, relativePath: name, absolutePath: filePath, size: 0 }
    discoveryRef.current = { files: [file], directories: [] }
    await runScan({ files: [file], directories: [] })
  }, [runScan])

  async function chooseFolder() {
    const selected = await open({ directory: true, title: 'Choose a game folder or resource root' })
    if (typeof selected === 'string') await beginFolderScan(selected)
    else onCancel()
  }

  async function chooseFile() {
    const selected = await open({ directory: false, title: 'Choose a resource or archive file', multiple: false })
    if (typeof selected === 'string') await beginFileScan(selected)
  }

  function handleApplyMappings(mappings: ContextFieldMapping[]) {
    if (!discoveryRef.current) return
    void runScan(discoveryRef.current, mappings)
  }

  function handleCreate(includedEntryIds: Set<string>, sourceLocale?: string) {
    if (!result) return
    const project = buildProjectFromExtraction(result, 'extracted-game.json', includedEntryIds)
    // Preserve the user's source-language selection in the project language info.
    if (sourceLocale && project.document.language == null) {
      project.document.language = { sourceLocale, translationDirection: 'auto', sourceDirection: 'auto' }
    }
    onProjectCreated(project)
  }

  if (phase === 'choosing') {
    return (
      <main className="scan-flow">
        <div className="scan-progress">
          <h1>Scan Game</h1>
          <p className="scan-hint">Read-only extraction of localization text from game resources.</p>
          <div className="scan-choices">
            <button className="scan-choice" onClick={chooseFolder}>Select Game Folder</button>
            <button className="scan-choice" onClick={chooseFile}>Select Resource / File</button>
            <button className="scan-cancel" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </main>
    )
  }

  if (phase === 'scanning') {
    return (
      <main className="scan-flow">
        <div className="scan-progress">
          <h1>Scanning resources (read-only)…</h1>
          {progress && (
            <div className="scan-progress-line">
              <span>{progress.filesDiscovered} files discovered</span>
              <span>{progress.filesAnalyzed} analyzed</span>
              <span>{progress.candidateFiles} candidates</span>
              <span>{progress.entriesFound} entries found</span>
            </div>
          )}
          <div className="scan-progress-track">
            <div className="scan-progress-fill" style={{ width: progress && progress.candidateFiles > 0 ? `${Math.min(100, (progress.filesAnalyzed / progress.candidateFiles) * 100)}%` : '0%' }} />
          </div>
          <button className="scan-cancel" onClick={() => { cancelledRef.current = true; onCancel() }}>Cancel</button>
        </div>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main className="scan-flow">
        <div className="scan-progress">
          <h1>Scan failed</h1>
          <p className="scan-error">{error}</p>
          <button className="scan-cancel" onClick={onCancel}>Back</button>
        </div>
      </main>
    )
  }

  if (phase === 'reviewing' && result) {
    return <ExtractionReview result={result} onCreateProject={handleCreate} onApplyMappings={handleApplyMappings} onCancel={onCancel} />
  }

  return null
}
