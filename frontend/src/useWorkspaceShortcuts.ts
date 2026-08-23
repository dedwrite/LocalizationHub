import {
  useEffect,
} from 'react'

type WorkspaceShortcutsOptions = {
  onOpenFile:
    () => void | Promise<void>

  onOpenProject:
    () => void | Promise<void>

  onHome:
    () => void | Promise<void>

  hasOpenWorkspace:
    boolean
}

function isEditableTarget(
  target:
    EventTarget | null,
) {
  if (
    !(target instanceof HTMLElement)
  ) {
    return false
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function useWorkspaceShortcuts({
  onOpenFile,
  onOpenProject,
  onHome,
  hasOpenWorkspace,
}: WorkspaceShortcutsOptions) {
  useEffect(
    () => {
      function handleKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          isEditableTarget(
            event.target,
          )
        ) {
          return
        }

        if (
          !event.ctrlKey ||
          event.altKey
        ) {
          return
        }

        /*
         * Ctrl + Shift + O
         * Open Project
         */
        if (
          event.shiftKey &&
          event.key.toLowerCase() ===
            'o'
        ) {
          event.preventDefault()

          void onOpenProject()

          return
        }

        /*
         * Ctrl + O
         * Open JSON file
         */
        if (
          !event.shiftKey &&
          event.key.toLowerCase() ===
            'o'
        ) {
          event.preventDefault()

          void onOpenFile()

          return
        }

        /*
         * Ctrl + H
         * Return Home
         */
        if (
          !event.shiftKey &&
          event.key.toLowerCase() ===
            'h' &&
          hasOpenWorkspace
        ) {
          event.preventDefault()

          void onHome()
        }
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
    [
      onOpenFile,
      onOpenProject,
      onHome,
      hasOpenWorkspace,
    ],
  )
}