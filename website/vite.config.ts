import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: process.cwd().endsWith('website') ? '.' : 'website',
  plugins: [react(), {
    name: 'web-build-manifest',
    generateBundle(_options, bundle) {
      // Identify the code actually built, not the package version or git HEAD.
      // Two deployments of v0.9.0 can contain different import/parser code.
      const entries = Object.values(bundle)
        .filter((item) => item.type === 'chunk' && item.isEntry)
        .map((item) => item.fileName).sort()
      this.emitFile({ type: 'asset', fileName: 'web-build.json', source: JSON.stringify({ entries }) })
    },
  }],
})
