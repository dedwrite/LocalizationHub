import { expect, test } from '@playwright/test'
import { buildProjectFromExtraction } from '../../packages/core/src/extraction/projectFromExtraction'
import { extractInkb } from '../../packages/core/src/extraction/engines/inkb'
import { parseLocalizationFile } from '../../packages/core/src/parsers'
import { openEditor } from './helpers'

// Entirely synthetic; exercise the same extraction -> project -> Workspace path.
const body = Buffer.from('characters: {"Ada":"actor-a","Bo":"actor-b"}\0$ pass\0Ada: Synthetic greeting.\0Bo: Synthetic reply.\0NOP\0')
const project = buildProjectFromExtraction(extractInkb('synthetic/hall.inkb', Buffer.concat([Buffer.alloc(10), body])), 'synthetic.extracted')
const user = { id: 'test-user', username: 'tester', email: 'test@example.com', emailVerified: true, createdAt: '2026-08-30T00:00:00Z' }

const schemaRecord = { source: 'rdvt', chapter: '1', scene: '1a/$.inkb', entry_id: '1', speaker: 'Sofia', speaker_gender: 'female', receiver: 'KuyaGrab', receiver_gender: 'male', text_en: 'Hello!', text_ar: '', type: 'dialogue' }
function parsedProject(record: Record<string, unknown>) {
  const parsed = parseLocalizationFile(JSON.stringify([record]), 'synthetic.json')
  if (!parsed.ok) throw new Error(parsed.reason)
  return { ...project, sourceFileName: 'synthetic.json', document: parsed.document, entries: parsed.document.entries, selectedEntryId: parsed.document.entries[0].id, metadata: undefined }
}
const scenarios = [
  { name: 'extracted listener', project,
    en: 'Speaker: Ada · → Listener: Bo · Scene: synthetic/hall · Conversation: inkb:synthetic/hall',
    ar: 'المتحدث: Ada · → المستمع: Bo · المشهد: synthetic/hall · المحادثة: inkb:synthetic/hall',
    reference: 'Speaker: Ada | Listener: Bo | Scene: synthetic/hall | Conversation: inkb:synthetic/hall' },
  { name: 'explicit receiver schema', project: parsedProject(schemaRecord),
    en: 'Speaker: Sofia (female) · → Listener: KuyaGrab (male) · Scene: 1a/$.inkb',
    ar: 'المتحدث: Sofia (أنثى) · → المستمع: KuyaGrab (ذكر) · المشهد: 1a/$.inkb',
    reference: 'Speaker: Sofia (female) | Listener: KuyaGrab (male) | Scene: 1a/$.inkb' },
  { name: 'explicit listener group', project: parsedProject({ text: 'Hello, everyone!', sender: 'Sofia', receivers: [{ name: 'Mark', id: 'a', gender: 'male' }, { name: 'Ali', id: 'b', gender: 'male' }] }),
    en: 'Speaker: Sofia · → Listeners: Mark (male), Ali (male)',
    ar: 'المتحدث: Sofia · → المستمعون: Mark (ذكر), Ali (ذكر)',
    reference: 'Speaker: Sofia | Listener: Mark (male), Ali (male)' },
]

for (const scenario of scenarios) {
for (const locale of ['en', 'ar'] as const) {
  test(`${scenario.name} renders and reaches MT reference in ${locale}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((testUser) => {
      localStorage.setItem('localizationhub.auth.token', 'synthetic-token')
      localStorage.setItem('localizationhub.auth.user', JSON.stringify(testUser))
    }, user)
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const response = path === '/api/auth/me' ? { user }
        : path === '/api/projects/context-proof' ? { project: { id: 'context-proof', name: 'Synthetic dialogue', role: 'owner', revision: 1, project: scenario.project } }
        : { tracks: [], members: [], assignments: [], entries: [], comments: [], activity: [] }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
    })
    let instruction = ''
    await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
      instruction = route.request().postDataJSON().system_instruction.parts[0].text
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ترجمة اختبارية.' }] } }] }) })
    })
    await page.goto('/app/projects/context-proof')
    await openEditor(page)
    await page.locator('.lh-language-switcher select').selectOption(locale)
    const strip = page.locator('.dialogue-context-strip')
    await expect(strip).toBeVisible()
    await expect(strip.locator(':scope > span')).toHaveText(scenario[locale].split(' · '))
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'en' ? 'ltr' : 'rtl')
    await page.screenshot({ path: testInfo.outputPath(`listener-${locale}.png`) })
    await page.locator('.mt-toggle').click()
    await page.locator('input[name="mt-provider-key"]').fill('synthetic-test-key')
    await page.locator('.mt-actions button').first().click()
    await expect(page.locator('.mt-result')).toBeVisible()
    expect(instruction.match(/Listener:/g)).toHaveLength(1)
    expect(instruction).toContain(scenario.reference)
    expect(instruction).not.toContain('(unknown)')
    expect(errors).toEqual([])
  })
}
}
