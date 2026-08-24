import {
  existsSync,
} from 'node:fs'

import {
  loadEnvFile,
} from 'node:process'

import {
  fileURLToPath,
} from 'node:url'

/*
 * LocalizationHub development server launcher.
 *
 * Local development secrets live in
 * collaboration-server/.env.local.
 *
 * Set LOCAL_ENV=test to load a separate
 * collaboration-server/.env.test.local, which
 * points at an isolated test database instead
 * of the production database.
 *
 * Production `npm start` does not load any of
 * these files.
 */

const localEnvName =
  process.env.LOCAL_ENV ===
    'test'
    ? '.env.test.local'
    : '.env.local'

const localEnvPath =
  fileURLToPath(
    new URL(
      localEnvName,
      import.meta.url,
    ),
  )

if (
  existsSync(
    localEnvPath,
  )
) {
  loadEnvFile(
    localEnvPath,
  )

  console.log(
    `[dev] Loaded collaboration-server/${localEnvName}`,
  )
} else {
  console.log(
    `[dev] No ${localEnvName} found.`,
  )
}

process.env.ENABLE_EXPERIMENTAL_CLOUD_API ??=
  '1'

await import(
  './server.mjs'
)
