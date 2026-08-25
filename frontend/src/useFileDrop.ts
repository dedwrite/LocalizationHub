import {
  useEffect,
} from 'react'

import {
  getCurrentWebview,
} from '@tauri-apps/api/webview'

type FileDropHandlers = {
  enabled: boolean
  onLocalizationFile: (
    path: string,
  ) => void | Promise<void>
  onProjectFile: (
    path: string,
  ) => void | Promise<void>
  onUnsupportedFile?: (
    path: string,
  ) => void
}

export function useFileDrop({
  enabled,
  onLocalizationFile,
  onProjectFile,
  onUnsupportedFile,
}: FileDropHandlers) {
  useEffect(
    () => {
      if (!enabled) {
        return
      }

      let unlisten:
        | (() => void)
        | undefined

      const setup =
        async () => {
          unlisten =
            await getCurrentWebview()
              .onDragDropEvent(
                (event) => {
                  if (
                    event.payload.type !==
                    'drop'
                  ) {
                    return
                  }

                  const path =
                    event.payload.paths[0]

                  if (!path) {
                    return
                  }

                  const normalized =
                    path.toLowerCase()

                  if (
                    normalized.endsWith(
                      '.lhproj',
                    )
                  ) {
                    void onProjectFile(
                      path,
                    )

                    return
                  }

                  if (normalized.endsWith('.json') || normalized.endsWith('.csv') || normalized.endsWith('.po')) {
                    void onLocalizationFile(
                      path,
                    )

                    return
                  }

                  onUnsupportedFile?.(
                    path,
                  )
                },
              )
        }

      void setup()

      return () => {
        unlisten?.()
      }
    },
    [
      enabled,
      onLocalizationFile,
      onProjectFile,
      onUnsupportedFile,
    ],
  )
}