import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SITE = 'https://localizationhub.app'
const META_DESCRIPTION = 'LocalizationHub is a local-first game localization workspace for Godot, Unreal, and Unity, plus JSON, CSV, and gettext PO files.'

const publicPages = [
  {
    route: '/',
    relative: 'index.html',
    title: 'LocalizationHub — Game localization, local-first',
    description: META_DESCRIPTION,
    heading: 'Your game. Your words.',
    body: 'Translate and review game text. Open JSON, CSV, or PO files in the browser, or extract supported game text with the Windows app.',
  },
  {
    route: '/privacy',
    relative: 'privacy/index.html',
    title: 'Privacy — LocalizationHub',
    description: 'How LocalizationHub handles Local Projects, Cloud Projects, retention, deletion, logs, and analytics.',
    heading: 'Privacy, in plain language.',
    body: 'Local Projects stay on your machine unless you choose Cloud. Cloud Projects use authenticated accounts. The public site does not include third-party marketing analytics.',
  },
  {
    route: '/terms',
    relative: 'terms/index.html',
    title: 'Terms — LocalizationHub',
    description: 'Terms for using the LocalizationHub localization workspace.',
    heading: 'Terms for using the workspace.',
    body: 'Use LocalizationHub with localization files you already have. Keep backups of local projects. Respect Cloud project roles.',
  },
] as const

function applyPublicMeta(html: string, page: (typeof publicPages)[number]) {
  const canonical = `${SITE}${page.route === '/' ? '/' : page.route}`
  const ogImage = `${SITE}/og-card.png`
  let next = html
    .replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${page.description}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.title}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`)
  if (!next.includes('rel="canonical"')) {
    next = next.replace('</title>', `</title>\n    <link rel="canonical" href="${canonical}" />`)
  } else {
    next = next.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
  }
  const seo = `\n    <noscript><article><h1>${page.heading}</h1><p>${page.body}</p></article></noscript>`
  if (!next.includes('<noscript>')) next = next.replace('<div id="root"></div>', `<div id="root"></div>${seo}`)
  return next
}

function prerenderPublicPages(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'prerender-public-pages',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const source = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      for (const page of publicPages) {
        const target = path.join(outDir, page.relative)
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(target, applyPublicMeta(source, page))
      }
    },
  }
}

export default defineConfig({
  root: process.cwd().endsWith('website') ? '.' : 'website',
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  plugins: [react(), {
    name: 'web-build-manifest',
    generateBundle(_options, bundle) {
      const entries = Object.values(bundle)
        .filter((item) => item.type === 'chunk' && item.isEntry)
        .map((item) => item.fileName).sort()
      this.emitFile({ type: 'asset', fileName: 'web-build.json', source: JSON.stringify({ entries }) })
    },
  }, prerenderPublicPages()],
})
