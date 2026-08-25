import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: process.cwd().endsWith('website') ? '.' : 'website',
  plugins: [react()],
})
