import type {
  LocalizationProjectV2,
} from './projectModel'

export type CloudProjectRole =
  | 'owner'
  | 'editor'
  | 'viewer'

export type CloudProjectSummary = {
  id:
    string

  name:
    string

  sourceFileName:
    string

  role:
    CloudProjectRole

  revision:
    number

  updatedAt:
    string
}

export type CloudProjectSnapshot = {
  id:
    string

  name:
    string

  role:
    CloudProjectRole

  revision:
    number

  updatedAt:
    string

  project:
    LocalizationProjectV2
}

export type CreateCloudProjectRequest = {
  name:
    string

  project:
    LocalizationProjectV2
}

export type CreateCloudProjectResponse = {
  project:
    CloudProjectSnapshot
}

export type SaveCloudProjectRequest = {
  project:
    LocalizationProjectV2

  baseRevision:
    number
}

export type SaveCloudProjectResponse = {
  project:
    CloudProjectSnapshot
}

export type ListCloudProjectsResponse = {
  projects:
    CloudProjectSummary[]
}

export type GetCloudProjectResponse = {
  project:
    CloudProjectSnapshot
}
