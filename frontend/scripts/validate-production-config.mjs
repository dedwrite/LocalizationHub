#!/usr/bin/env node
/*
 * Release gate: fail a production desktop build when required public Cloud
 * configuration is missing or invalid.
 *
 * This runs before `vite build` in production mode so a Cloud-disabled
 * installer cannot be produced silently. Only PUBLIC endpoints are required —
 * never secrets.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = resolve(frontendDir, '.env.production')

const REQUIRED = {
  VITE_CLOUD_API_URL: /^https?:\/\/\S+$/i,
  VITE_COLLABORATION_SERVER_URL: /^wss?:\/\/\S+$/i,
}

function fail(message) {
  console.error(`[validate-production-config] ${message}`)
  process.exit(1)
}

if (!existsSync(envFile)) {
  fail(
    `Missing ${envFile}. A production desktop build requires committed public endpoint configuration (see frontend/.env.production).`,
  )
}

const content = readFileSync(envFile, 'utf8')
const values = {}
for (const line of content.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.+)\s*$/)
  if (match) values[match[1]] = match[2].trim()
}

for (const [name, pattern] of Object.entries(REQUIRED)) {
  const value = values[name]
  if (!value) {
    fail(`Missing required ${name} in ${envFile}.`)
  }
  if (!pattern.test(value)) {
    fail(`Invalid ${name} value "${value}" in ${envFile} (expected a public URL).`)
  }
}

console.log(
  '[validate-production-config] OK — production Cloud configuration present.',
)
