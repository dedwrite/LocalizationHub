import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const tests = readdirSync(
  new URL('../collaboration-server/tests/', import.meta.url),
)
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => `collaboration-server/tests/${file}`)
const result = spawnSync(process.execPath, ['--test', ...tests], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'test' },
  stdio: 'inherit',
})
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
