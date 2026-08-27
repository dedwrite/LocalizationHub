/*
 * Cross-Origin Resource Sharing policy for the LocalizationHub backend.
 *
 * Only trusted application origins are allowed. The desktop client runs under
 * the official Tauri v2 application origins below, and the web app is served
 * same-origin (so it does not need to appear here). Development uses local
 * Vite dev-server origins.
 *
 * SECURITY: this is an explicit allowlist. Never reflect arbitrary `Origin`
 * headers, never use `Access-Control-Allow-Origin: *`, and never add wildcards.
 */

const TAURI_APP_ORIGINS = [
  // Windows / Linux Tauri v2 production default.
  'http://tauri.localhost',
  // macOS Tauri v2 default (custom scheme).
  'tauri://localhost',
  // Windows / Linux when `app.windows.useHttpsScheme` is enabled.
  'https://tauri.localhost',
]

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export function getCorsAllowedOrigins() {
  return new Set([
    ...DEVELOPMENT_ORIGINS,
    ...TAURI_APP_ORIGINS,

    ...(
      process.env.CORS_ALLOWED_ORIGINS ??
      ''
    )
      .split(',')
      .map(
        (origin) =>
          origin.trim(),
      )
      .filter(Boolean),
  ])
}

const CORS_ALLOWED_ORIGINS =
  getCorsAllowedOrigins()

export function applyCorsHeaders(
  request,
  response,
) {
  const origin =
    request.headers.origin

  if (
    !origin ||
    !CORS_ALLOWED_ORIGINS.has(
      origin,
    )
  ) {
    return false
  }

  response.setHeader(
    'Access-Control-Allow-Origin',
    origin,
  )

  response.setHeader(
    'Vary',
    'Origin',
  )

  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  )

  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )

  return true
}
