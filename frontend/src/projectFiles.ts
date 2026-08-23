import {
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

import {
  decodeLocalizationProject,
  ProjectStorageError,
  type LoadedProject,
  type LocalizationProjectV2,
  type ProjectLocation,
  type ProjectStorage,
  type SavedProject,
} from '@localizationhub/core'

function getLocalProjectPath(
  location: ProjectLocation,
): string {
  if (
    location.kind !==
    'local'
  ) {
    throw new Error(
      'Desktop project storage only supports local project locations.',
    )
  }

  return location.path
}

export const desktopProjectStorage:
  ProjectStorage = {
    async load(
      location:
        ProjectLocation,
    ): Promise<LoadedProject> {
      const path =
        getLocalProjectPath(
          location,
        )

      let content:
        string

      try {
        content =
          await readTextFile(
            path,
          )
      } catch {
        throw new ProjectStorageError(
          'read-failed',
          'Failed to read the local project file.',
        )
      }

      const decoded =
        decodeLocalizationProject(
          content,
        )

      if (!decoded.ok) {
        throw new ProjectStorageError(
          decoded.reason,
          `Invalid LocalizationHub project: ${decoded.reason}`,
        )
      }

      return {
        project:
          decoded.project,

        migratedFromVersion:
          decoded.migratedFromVersion,

        revision:
          null,
      }
    },

    async save(
      location:
        ProjectLocation,

      project:
        LocalizationProjectV2,
    ): Promise<SavedProject> {
      const path =
        getLocalProjectPath(
          location,
        )

      const content =
        JSON.stringify(
          project,
          null,
          2,
        )

      try {
        await writeTextFile(
          path,
          content,
        )
      } catch {
        throw new ProjectStorageError(
          'write-failed',
          'Failed to write the local project file.',
        )
      }

      return {
        revision:
          null,
      }
    },
  }

/*
 * Temporary compatibility helper.
 *
 * App.tsx still calls this directly.
 * We will migrate it to ProjectStorage next.
 */
export async function writeLocalizationProject(
  path: string,
  project: LocalizationProjectV2,
): Promise<void> {
  await desktopProjectStorage.save(
    {
      kind:
        'local',

      path,
    },

    project,
  )
}
