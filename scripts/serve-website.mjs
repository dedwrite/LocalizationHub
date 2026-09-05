// Use the same defaults from npm and Playwright on Windows, macOS, and Linux.
process.env.SERVE_PUBLIC_WEBSITE ??= '1'
process.env.ENABLE_EXPERIMENTAL_CLOUD_API ??= '0'
await import('../collaboration-server/server.mjs')
