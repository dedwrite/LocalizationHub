/*
 * Centralized desktop runtime configuration.
 *
 * The desktop client resolves Cloud API and collaboration endpoints here so
 * every consumer (auth, Cloud Projects, Cloud workflow, collaboration socket)
 * shares one authoritative, normalized resolution path.
 *
 * SECURITY: `VITE_*` values are PUBLIC client configuration only. They must
 * never contain secrets, credentials, tokens, or API keys — only public
 * service endpoints.
 */

const CLOUD_API_URL =
  import.meta.env.VITE_CLOUD_API_URL?.trim()

const COLLABORATION_SERVER_URL =
  import.meta.env.VITE_COLLABORATION_SERVER_URL?.trim()

function normalizeHttpUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

/*
 * Thrown when a production build has no Cloud API endpoint configured. Callers
 * map this to their own user-facing "disabled" error while preserving the
 * safeguard that prevents a Cloud-disabled client from failing silently.
 */
export class CloudApiNotConfiguredError
  extends Error {
  constructor() {
    super(
      'Cloud API is not configured in this build.',
    )

    this.name =
      'CloudApiNotConfiguredError'
  }
}

export function getCloudApiBaseUrl():
  string {
  if (CLOUD_API_URL) {
    return normalizeHttpUrl(
      CLOUD_API_URL,
    )
  }

  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8787'
  }

  throw new CloudApiNotConfiguredError()
}

export function isCloudApiEnabled():
  boolean {
  return (
    import.meta.env.DEV ||
    Boolean(CLOUD_API_URL)
  )
}

export function getCollaborationServerUrl():
  string {
  if (COLLABORATION_SERVER_URL) {
    return COLLABORATION_SERVER_URL
  }

  if (import.meta.env.PROD) {
    return 'wss://localizationhub-relay.onrender.com'
  }

  return 'ws://127.0.0.1:8787'
}

/*
 * Derives the HTTP(S) base URL for the collaboration relay from the WebSocket
 * URL so the ticket endpoint is always reached on the same service.
 */
export function getCollaborationHttpUrl():
  string {
  return getCollaborationServerUrl()
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
}
