// Production Super Admin bootstrap (local, against production DB).
// Loads collaboration-server/.env.local for DATABASE_URL, uses
// LH_SUPER_ADMIN_USERNAME from the environment. Prints no secrets.
//
// Steps: verify account exists & is verified → set site_role='super_admin'.
import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootstrapSuperAdmin } from '../admin.mjs'

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url))
if (!existsSync(envPath)) throw new Error('.env.local not found')
loadEnvFile(envPath)

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in .env.local')

const username = process.env.LH_SUPER_ADMIN_USERNAME?.trim()
if (!username) throw new Error('LH_SUPER_ADMIN_USERNAME is required')

const host = new URL(process.env.DATABASE_URL).host
console.log(`Bootstrap target: ${host}`)

const result = await bootstrapSuperAdmin(username)
console.log(JSON.stringify({ bootstrapped: true, userId: result.id }))
