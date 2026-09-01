import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { ensurePublicWebsiteDirectory, servePublicWebsite } from '../public-website.mjs'

const fixtureDirectories = []

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'localizationhub-website-'))
  fixtureDirectories.push(directory)
  await mkdir(path.join(directory, 'assets'))
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><title>Website</title>')
  await writeFile(path.join(directory, 'assets', 'app-abc123.js'), 'console.log(1)')
  await writeFile(path.join(directory, 'manifest.webmanifest'), '{"name":"LocalizationHub","display":"standalone"}')
  await writeFile(path.join(directory, 'web-build.json'), '{"entries":["assets/app-abc123.js"]}')
  await writeFile(path.join(directory, 'localizationhub-logo.jpg'), 'jpg')
  await writeFile(path.join(directory, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://localizationhub.app/sitemap.xml\n')
  await writeFile(path.join(directory, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://localizationhub.app/</loc></url></urlset>\n')
  await writeFile(path.join(path.dirname(directory), 'outside-secret.txt'), 'secret')
  return directory
}

function responseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers },
    end(body) { this.body = body },
  }
}

afterEach(async () => {
  await Promise.all(fixtureDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('public website serving', () => {
  it('never caches the deployed build identity, including HEAD responses', async () => {
    const directory = await createFixture()
    for (const method of ['GET', 'HEAD']) {
      const response = responseRecorder()
      assert.equal(await servePublicWebsite({ method, url: '/web-build.json' }, response, directory), true)
      assert.equal(response.headers['Cache-Control'], 'no-store')
      assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8')
      if (method === 'HEAD') assert.equal(response.body, undefined)
      else assert.deepEqual(JSON.parse(response.body), { entries: ['assets/app-abc123.js'] })
    }
  })
  it('serves the root and direct SPA routes from a fixture', async () => {
    const directory = await createFixture()
    for (const url of ['/', '/download', '/privacy', '/terms', '/some-random-page']) {
      const response = responseRecorder()
      assert.equal(await servePublicWebsite({ method: 'GET', url }, response, directory), true)
      assert.equal(response.statusCode, 200)
      assert.equal(response.headers['Content-Type'], 'text/html; charset=utf-8')
      assert.equal(response.headers['Cache-Control'], 'no-cache')
    }
  })

  it('serves assets with MIME and immutable cache headers', async () => {
    const directory = await createFixture()
    const response = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'GET', url: '/assets/app-abc123.js' }, response, directory), true)
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['Content-Type'], 'text/javascript; charset=utf-8')
    assert.equal(response.headers['Cache-Control'], 'public, max-age=31536000, immutable')
    const logo = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'GET', url: '/localizationhub-logo.jpg' }, logo, directory), true)
    assert.equal(logo.headers['Content-Type'], 'image/jpeg')
  })

  it('serves manifest.webmanifest with the correct JSON MIME type', async () => {
    const directory = await createFixture()
    const response = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'GET', url: '/manifest.webmanifest' }, response, directory), true)
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['Content-Type'], 'application/manifest+json; charset=utf-8')
    assert.equal(response.headers['Cache-Control'], 'public, max-age=86400')
  })

  it('serves robots.txt and sitemap.xml with crawl-friendly MIME types', async () => {
    const directory = await createFixture()
    const robots = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'GET', url: '/robots.txt' }, robots, directory), true)
    assert.equal(robots.statusCode, 200)
    assert.equal(robots.headers['Content-Type'], 'text/plain; charset=utf-8')
    assert.match(String(robots.body), /Sitemap:\s+https:\/\/localizationhub\.app\/sitemap\.xml/)

    const sitemap = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'GET', url: '/sitemap.xml' }, sitemap, directory), true)
    assert.equal(sitemap.statusCode, 200)
    assert.equal(sitemap.headers['Content-Type'], 'application/xml; charset=utf-8')
    assert.match(String(sitemap.body), /https:\/\/localizationhub\.app\//)
  })

  it('supports HEAD without a response body', async () => {
    const directory = await createFixture()
    const response = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'HEAD', url: '/' }, response, directory), true)
    assert.equal(response.statusCode, 200)
    assert.equal(response.body, undefined)
  })

  it('does not handle backend paths and rejects traversal outside the dist root', async () => {
    const directory = await createFixture()
    for (const url of ['/api/does-not-exist', '/api?query=1', '/health?query=1', '/verify-email', '/favicon.ico?query=1', '/apple-touch-icon.png', '/../outside-secret.txt', '/assets/%2e%2e/outside-secret.txt']) {
      const response = responseRecorder()
      assert.equal(await servePublicWebsite({ method: 'GET', url }, response, directory), false)
    }
  })


  it('serves unique prerendered privacy HTML instead of the home shell', async () => {
    const directory = await createFixture()
    await mkdir(path.join(directory, 'privacy'))
    await writeFile(path.join(directory, 'privacy', 'index.html'), '<!doctype html><title>Privacy — LocalizationHub</title><link rel="canonical" href="https://localizationhub.app/privacy" />')
    const response = responseRecorder()
    assert.equal(await servePublicWebsite({ method: 'GET', url: '/privacy' }, response, directory), true)
    assert.equal(response.statusCode, 200)
    assert.match(String(response.body), /Privacy — LocalizationHub/)
    assert.match(String(response.body), /rel="canonical" href="https:\/\/localizationhub.app\/privacy"/)
    assert.equal(response.headers['Cache-Control'], 'no-cache')
  })
  it('fails clearly when the enabled website build is missing', async () => {
    assert.throws(() => ensurePublicWebsiteDirectory(path.join(tmpdir(), 'missing-localizationhub-website')), /website build is missing/i)
  })
})
