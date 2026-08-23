import {
  useEffect,
} from 'react'

import {
  getCurrentWebview,
} from '@tauri-apps/api/webview'

type FileDropHandlers = {
  enabled: boolean
  onJsonFile: (
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
  onJsonFile,
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

                  if (
                    normalized.endsWith(
                      '.json',
                    )
                  ) {
                    void onJsonFile(
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
      onJsonFile,
      onProjectFile,
      onUnsupportedFile,
    ],
  )
}