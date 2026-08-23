import type {
  LoadedProject,
  ProjectLocation,
  ProjectSaveOptions,
  ProjectStorage,
  SavedProject,
} from '@localizationhub/core'

import {
  getCloudProject,
  saveCloudProject,
} from './cloudProjectsApi'

function getCloudProjectId(
  location:
    ProjectLocation,
): string {
  if (
    location.kind !==
    'cloud'
  ) {
    throw new Error(
      'Cloud project storage only supports cloud project locations.',
    )
  }

  return location.projectId
}

function getBaseRevision(
  options?:
    ProjectSaveOptions,
): number {
  const revision =
    options?.baseRevision

  if (
    typeof revision !==
      'number' ||
    !Number.isInteger(
      revision,
    ) ||
    revision < 1
  ) {
    throw new Error(
      'Cloud project save requires a valid base revision.',
    )
  }

  return revision
}

export const cloudProjectStorage:
  ProjectStorage = {
    async load(
      location:
        ProjectLocation,
    ): Promise<LoadedProject> {
      const projectId =
        getCloudProjectId(
          location,
        )

      const snapshot =
        await getCloudProject(
          projectId,
        )

      return {
        project:
          snapshot.project,

        migratedFromVersion:
          null,

        revision:
          snapshot.revision,
      }
    },

    async save(
      location:
        ProjectLocation,

      project,

      options?:
        ProjectSaveOptions,
    ): Promise<SavedProject> {
      const projectId =
        getCloudProjectId(
          location,
        )

      const baseRevision =
        getBaseRevision(
          options,
        )

      const snapshot =
        await saveCloudProject(
          projectId,
          {
            project,
            baseRevision,
          },
        )

      return {
        revision:
          snapshot.revision,
      }
    },
  }
