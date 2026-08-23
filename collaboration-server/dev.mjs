/*
 * LocalizationHub development server launcher.
 *
 * Enables development-only Cloud Project APIs before
 * loading the collaboration relay.
 *
 * Production `npm start` remains unchanged and keeps
 * experimental Cloud APIs disabled unless explicitly enabled.
 */

process.env.ENABLE_EXPERIMENTAL_CLOUD_API ??= '1'

await import('./server.mjs')
