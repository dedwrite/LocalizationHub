import { useCallback, useEffect, useRef, useState } from 'react'
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
} from '@localizationhub/core'
import ExtractionReview from './ExtractionReview'
import './ScanGameFlow.css'

type ScannedFileResult = { path: string; size: number }

type Props = {
  onProjectCreated: (project: LocalizationProjectV3) => void
  onCancel: () => void
}

type Phase =
  | 'choosing'
  | 'scanning'
  | 'reviewing'
  | 'error'

export default function ScanGameFlow({ onProjectCreated, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('choosing')
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState('')
  const cancelledRef = useRef(false)

  const beginScan = useCallback(async (root: string) => {
    setPhase('scanning')
    setError('')

    try {
      const discovered = await invoke<ScannedFileResult[]>('scan_directory', { root })
      const files: ScanFile[] = discovered.map((file) => ({
        name: file.path.split('/').pop() ?? file.path,
        relativePath: file.path,
        size: file.size,
      }))

      const reader = {
        readText: async (file: ScanFile) => {
          // Tauri fs reads relative to the app's scope; for scan, we join the
          // root + relative path. The caller keeps root in scope.
          return readTextFile(`${root}/${file.relativePath}`)
        },
        readBinary: async (file: ScanFile) => {
          return new Uint8Array(await readFile(`${root}/${file.relativePath}`))
        },
      }

      const scanResult = await scanGame({
        files,
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

  useEffect(() => {
    void (async () => {
      const selected = await open({ directory: true, title: 'Choose a game folder or resource root' })
      if (typeof selected === 'string') {
        await beginScan(selected)
      } else {
        onCancel()
      }
    })()
  }, [beginScan, onCancel])

  function handleCreate(_entries: ExtractionResult['entries']) {
    if (!result) return
    const project = buildProjectFromExtraction(result, 'extracted-game.json')
    onProjectCreated(project)
  }

  if (phase === 'choosing' || phase === 'scanning') {
    return (
      <main className="scan-flow">
        <div className="scan-progress">
          <h1>{phase === 'choosing' ? 'Choose a game folder' : 'Scanning resources (read-only)…'}</h1>
          {progress && (
            <div className="scan-progress-line">
              <span>{progress.filesDiscovered} files discovered</span>
              <span>{progress.filesAnalyzed} analyzed</span>
              <span>{progress.candidateFiles} candidates</span>
              <span>{progress.entriesFound} entries found</span>
            </div>
          )}
          <div className="scan-progress-track">
            <div className="scan-progress-fill" style={{ width: progress && progress.filesDiscovered > 0 ? `${Math.min(100, (progress.filesAnalyzed / progress.candidateFiles) * 100)}%` : '0%' }} />
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
    return <ExtractionReview result={result} onCreateProject={handleCreate} onCancel={onCancel} />
  }

  return null
}
