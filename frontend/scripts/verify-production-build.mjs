#!/usr/bin/env node
/*
 * Production-build regression test.
 *
 * Builds the desktop frontend in production mode and verifies the compiled
 * bundle embeds the intended public Cloud API and collaboration endpoints
 * (i.e. the committed `.env.production` was applied), rather than leaving the
 * client on the disabled/localhost path.
 *
 * Only PUBLIC endpoint strings are asserted. No secrets are involved.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(frontendDir, 'dist')
const assetsDir = resolve(distDir, 'assets')

// Resolve Vite through Node's module resolution (respects workspace hoisting).
const vitePackageJson = require.resolve('vite/package.json')
const viteBin = resolve(dirname(vitePackageJson), 'bin', 'vite.js')

const EXPECTED = {
  cloudApiBaseUrl: 'https://localizationhub.app',
  collaborationServerUrl: 'wss://localizationhub-relay.onrender.com',
}

function fail(message) {
  console.error(`[verify-production-build] ${message}`)
  process.exit(1)
}

function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: 'inherit' })
  } catch {
    fail(`${command} ${args.join(' ')} failed.`)
  }
}

if (!existsSync(viteBin)) {
  fail(`Vite binary not found at ${viteBin}; run \`npm install\` first.`)
}

// Production build of the desktop frontend.
run(process.execPath, [viteBin, 'build', '--mode', 'production'], frontendDir)

if (!existsSync(assetsDir)) {
  fail(`Expected build output directory not found: ${assetsDir}`)
}

const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
if (jsFiles.length === 0) {
  fail(`No JavaScript bundle found in ${assetsDir}.`)
}

let bundledJs = ''
for (const file of jsFiles) {
  bundledJs += readFileSync(resolve(assetsDir, file), 'utf8')
}

for (const [key, expected] of Object.entries(EXPECTED)) {
  if (!bundledJs.includes(expected)) {
    fail(
      `Production bundle does not embed ${key} ("${expected}"). ` +
        'The desktop client would be Cloud-disabled. Check frontend/.env.production.',
    )
  }
}

const totalBytes = jsFiles.reduce(
  (sum, file) => sum + statSync(resolve(assetsDir, file)).size,
  0,
)

console.log(
  `[verify-production-build] OK — production bundle embeds Cloud API and collaboration endpoints (${jsFiles.length} bundle(s), ${totalBytes} bytes).`,
)
