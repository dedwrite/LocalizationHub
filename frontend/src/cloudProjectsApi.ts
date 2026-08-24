import type {
  CloudProjectSnapshot,
  CloudProjectSummary,
  CreateCloudProjectRequest,
  CreateCloudProjectResponse,
  GetCloudProjectResponse,
  ListCloudProjectsResponse,
  SaveCloudProjectRequest,
  SaveCloudProjectResponse,
} from '@localizationhub/core'

import {
  getAuthToken,
} from './authSession'

type CloudProjectsApiErrorCode =
  | 'disabled'
  | 'network-error'
  | 'invalid-response'
  | 'invalid-request'
  | 'unauthorized'
  | 'email-verification-required'
  | 'project-not-found'
  | 'revision-conflict'
  | 'not-found'
  | 'internal-error'

export class CloudProjectsApiError
  extends Error {
  readonly code:
    CloudProjectsApiErrorCode

  readonly currentRevision?:
    number

  constructor(
    code:
      CloudProjectsApiErrorCode,

    message:
      string,

    currentRevision?:
      number,
  ) {
    super(message)

    this.name =
      'CloudProjectsApiError'

    this.code =
      code

    this.currentRevision =
      currentRevision
  }
}

function getCloudApiBaseUrl():
  string {
  const configured =
    import.meta.env
      .VITE_CLOUD_API_URL
      ?.trim()

  if (configured) {
    return configured
      .replace(/\/$/, '')
  }

  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8787'
  }

  throw new CloudProjectsApiError(
    'disabled',
    'Cloud Projects are not enabled in this build.',
  )
}

async function requestJson<T>(
  path:
    string,

  init?:
    RequestInit,
): Promise<T> {
  const baseUrl =
    getCloudApiBaseUrl()

  const authToken =
    getAuthToken()

  let response:
    Response

  try {
    response =
      await fetch(
        `${baseUrl}${path}`,
        {
          ...init,

          headers: {
            Accept:
              'application/json',

            ...(init?.body
              ? {
                  'Content-Type':
                    'application/json; charset=utf-8',
                }
              : {}),

            ...(authToken
              ? {
                  Authorization:
                    `Bearer ${authToken}`,
                }
              : {}),

            ...init?.headers,
          },
        },
      )
  } catch {
    throw new CloudProjectsApiError(
      'network-error',
      'Could not connect to the Cloud Projects API.',
    )
  }

  let body:
    unknown

  try {
    body =
      await response.json()
  } catch {
    throw new CloudProjectsApiError(
      'invalid-response',
      'Cloud Projects API returned an invalid response.',
    )
  }

  if (!response.ok) {
    const errorBody =
      body as {
        error?:
          unknown

        message?:
          unknown

        currentRevision?:
          unknown
      }

    const code =
      typeof errorBody.error ===
        'string'
        ? errorBody.error
        : 'invalid-response'

    const serverMessage =
      typeof errorBody.message ===
        'string'
        ? errorBody.message
        : null

    if (
      code ===
        'not-found' &&
      serverMessage ===
        'Cloud project API is disabled.'
    ) {
      throw new CloudProjectsApiError(
        'disabled',
        'Cloud Projects are disabled on this server.',
      )
    }

    if (
      code ===
      'revision-conflict'
    ) {
      throw new CloudProjectsApiError(
        'revision-conflict',
        'The cloud project was changed by another client.',
        typeof errorBody.currentRevision ===
          'number'
          ? errorBody.currentRevision
          : undefined,
      )
    }

    const knownCodes:
      CloudProjectsApiErrorCode[] = [
        'invalid-request',
        'unauthorized',
        'email-verification-required',
        'project-not-found',
        'not-found',
        'internal-error',
      ]

    const normalizedCode =
      knownCodes.includes(
        code as
          CloudProjectsApiErrorCode,
      )
        ? code as
            CloudProjectsApiErrorCode
        : 'invalid-response'

    const fallbackMessages:
      Partial<
        Record<
          CloudProjectsApiErrorCode,
          string
        >
      > = {
        'invalid-request':
          'The Cloud Project request was rejected.',

        'email-verification-required':
          'Verify your email before using Cloud Projects.',

        'project-not-found':
          'The Cloud Project could not be found.',

        'not-found':
          'The Cloud Projects API endpoint could not be found.',

        'internal-error':
          'The Cloud Projects service encountered an internal error.',

        'invalid-response':
          'The Cloud Projects service returned an invalid response.',
      }

    throw new CloudProjectsApiError(
      normalizedCode,
      serverMessage ??
        fallbackMessages[
          normalizedCode
        ] ??
        `Cloud Projects API request failed with HTTP ${response.status}.`,
    )
  }

  return body as T
}

export function getCloudProjectsErrorMessage(
  error:
    unknown,

  fallback:
    string,
): string {
  if (
    error instanceof
      CloudProjectsApiError
  ) {
    return error.message
  }

  return fallback
}

export async function createCloudProject(
  request:
    CreateCloudProjectRequest,
): Promise<CloudProjectSnapshot> {
  const response =
    await requestJson<
      CreateCloudProjectResponse
    >(
      '/api/projects',
      {
        method:
          'POST',

        body:
          JSON.stringify(
            request,
          ),
      },
    )

  return response.project
}

export async function listCloudProjects():
  Promise<CloudProjectSummary[]> {
  const response =
    await requestJson<
      ListCloudProjectsResponse
    >(
      '/api/projects',
    )

  return response.projects
}

export async function getCloudProject(
  projectId:
    string,
): Promise<CloudProjectSnapshot> {
  const response =
    await requestJson<
      GetCloudProjectResponse
    >(
      `/api/projects/${encodeURIComponent(projectId)}`,
    )

  return response.project
}

export async function saveCloudProject(
  projectId:
    string,

  request:
    SaveCloudProjectRequest,
): Promise<CloudProjectSnapshot> {
  const response =
    await requestJson<
      SaveCloudProjectResponse
    >(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method:
          'PUT',

        body:
          JSON.stringify(
            request,
          ),
      },
    )

  return response.project
}
