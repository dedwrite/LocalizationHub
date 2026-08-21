import {
  useEffect,
  useRef,
} from 'react'

export function useSaveAsShortcut(
  onSaveAs:
    () => void | Promise<void>,
) {
  const onSaveAsRef =
    useRef(
      onSaveAs,
    )

  useEffect(
    () => {
      onSaveAsRef.current =
        onSaveAs
    },
    [
      onSaveAs,
    ],
  )

  useEffect(
    () => {
      function handleKeyDown(
        event: KeyboardEvent,
      ) {
        const isSaveAs =
          (
            event.ctrlKey ||
            event.metaKey
          ) &&
          event.shiftKey &&
          event.key.toLowerCase() ===
            's'

        if (
          !isSaveAs
        ) {
          return
        }

        event.preventDefault()

        void onSaveAsRef.current()
      }

      window.addEventListener(
        'keydown',
        handleKeyDown,
      )

      return () => {
        window.removeEventListener(
          'keydown',
          handleKeyDown,
        )
      }
    },
    [],
  )
}