import { bootstrapSuperAdmin } from '../admin.mjs'

const username = process.env.LH_SUPER_ADMIN_USERNAME?.trim()
if (!username) throw new Error('LH_SUPER_ADMIN_USERNAME is required')
await bootstrapSuperAdmin(username)
console.log(JSON.stringify({ bootstrapped: true }))
