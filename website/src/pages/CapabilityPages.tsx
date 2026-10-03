import { useI18n, type MessageKey } from '@localizationhub/i18n'
import { Header, Footer } from '../components/SiteChrome'
import { InternalLink } from '../internalNavigation'

/*
 * Reference pages, not marketing pages.
 *
 * The landing claims that Godot, Unreal and Unity text can be extracted and
 * that JSON, CSV and PO can be opened. These pages are where that claim can be
 * checked: one group per status, copied from the project's own compatibility
 * record, with the partial cases named as partial. Each page is the same
 * document shell the privacy and legal routes use, so a reader meets the same
 * typography on every inner page.
 */
export type CapabilityPageId = 'godot' | 'unreal' | 'unity' | 'json' | 'po' | 'memory'

type CapabilityGroup = { title: MessageKey; items: MessageKey[] }

/* Backticked segments in the copy are machine values — file extensions, keywords,
 * field names — so they print in the mono family. */
function copy(text: string) {
  return text.split('`').map((part, index) => index % 2 === 1 ? <code key={index}>{part}</code> : part)
}

const keys = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}.${index + 1}` as MessageKey)

export const capabilityPages: Record<CapabilityPageId, { title: MessageKey; lede: MessageKey; groups: CapabilityGroup[] }> = {
  godot: {
    title: 'capability.godot.title',
    lede: 'capability.godot.lede',
    groups: [
      { title: 'capability.godot.read.title', items: keys('capability.godot.read', 6) },
      { title: 'capability.godot.tool.title', items: keys('capability.godot.tool', 2) },
      { title: 'capability.godot.limits.title', items: keys('capability.godot.limits', 3) },
      { title: 'capability.godot.never.title', items: keys('capability.godot.never', 1) },
    ],
  },
  unreal: {
    title: 'capability.unreal.title',
    lede: 'capability.unreal.lede',
    groups: [
      { title: 'capability.unreal.read.title', items: keys('capability.unreal.read', 4) },
      { title: 'capability.unreal.tool.title', items: keys('capability.unreal.tool', 3) },
      { title: 'capability.unreal.limits.title', items: keys('capability.unreal.limits', 4) },
      { title: 'capability.unreal.never.title', items: keys('capability.unreal.never', 1) },
    ],
  },
  unity: {
    title: 'capability.unity.title',
    lede: 'capability.unity.lede',
    groups: [
      { title: 'capability.unity.read.title', items: keys('capability.unity.read', 5) },
      { title: 'capability.unity.tool.title', items: keys('capability.unity.tool', 2) },
      { title: 'capability.unity.limits.title', items: keys('capability.unity.limits', 2) },
      { title: 'capability.unity.never.title', items: keys('capability.unity.never', 1) },
    ],
  },
  json: {
    title: 'capability.json.title',
    lede: 'capability.json.lede',
    groups: [
      { title: 'capability.json.read.title', items: keys('capability.json.read', 5) },
      { title: 'capability.json.limits.title', items: keys('capability.json.limits', 3) },
      { title: 'capability.json.never.title', items: keys('capability.json.never', 1) },
    ],
  },
  po: {
    title: 'capability.po.title',
    lede: 'capability.po.lede',
    groups: [
      { title: 'capability.po.read.title', items: keys('capability.po.read', 5) },
      { title: 'capability.po.limits.title', items: keys('capability.po.limits', 3) },
    ],
  },
  memory: {
    title: 'capability.memory.title',
    lede: 'capability.memory.lede',
    groups: [
      { title: 'capability.memory.how.title', items: keys('capability.memory.how', 3) },
      { title: 'capability.memory.lives.title', items: keys('capability.memory.lives', 2) },
      { title: 'capability.memory.not.title', items: keys('capability.memory.not', 3) },
    ],
  },
}

/* Every reference page is one route with its own stable address, so an engine
 * or a format can be linked from outside the site without an anchor. */
export const referenceRoutes: Record<CapabilityPageId, { path: string; label: MessageKey }> = {
  /* Brand names keep the landing's own labels: an engine is not translated. */
  godot: { path: '/godot', label: 'landing.formats.godot.label' },
  unreal: { path: '/unreal', label: 'landing.formats.unreal.label' },
  unity: { path: '/unity', label: 'landing.formats.unity.label' },
  json: { path: '/formats/json', label: 'capability.json.label' },
  po: { path: '/formats/po', label: 'capability.po.label' },
  memory: { path: '/features/translation-memory', label: 'capability.memory.label' },
}

export const referenceOrder: CapabilityPageId[] = ['godot', 'unreal', 'unity', 'json', 'po', 'memory']

/** The hub: the same titles and ledes the pages use, listed for reading. */
export function ReferenceIndex() {
  const { t } = useI18n()
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} data-i18n-skip className="inner-page capability-page">
        <p className="eyebrow">{t('capability.eyebrow')}{t('capability.index.nav')}</p>
        <article>
          <h1>{t('capability.index.title')}</h1>
          <p className="page-lede">{t('capability.index.lede')}</p>
          <ul className="capability-index">
            {referenceOrder.map((id) => (
              <li key={id}>
                <InternalLink href={referenceRoutes[id].path}>
                  <strong>{t(capabilityPages[id].title)}</strong>
                  <span>{copy(t(capabilityPages[id].lede))}</span>
                </InternalLink>
              </li>
            ))}
          </ul>
          <p className="capability-note">{t('capability.note')}</p>
        </article>
      </main>
      <Footer />
    </>
  )
}

export function CapabilityPage({ page }: { page: CapabilityPageId }) {
  const { t } = useI18n()
  const content = capabilityPages[page]
  const related = referenceOrder.filter((id) => id !== page)
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} data-i18n-skip className="inner-page capability-page">
        <p className="eyebrow">
          {t('capability.eyebrow')}
          {t(referenceRoutes[page].label)}
        </p>
        <article>
          <h1>{t(content.title)}</h1>
          <p className="page-lede">{t(content.lede)}</p>
          {content.groups.map((group) => (
            <section key={group.title} className="capability-group">
              <h2>{t(group.title)}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{copy(t(item))}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className="capability-note">{t('capability.note')}</p>
          <div className="capability-next">
            <InternalLink className="button button-primary" href="/app/local">
              {t('capability.openEditor')}
            </InternalLink>
            <span>{t('capability.windowsNote')}</span>
            <InternalLink href="/download">{t('website.nav.download')}</InternalLink>
          </div>
          <nav className="capability-related" aria-label={t('capability.index.title')}>
            <InternalLink href="/reference">{t('capability.index.title')}</InternalLink>
            {related.map((id) => (
              <InternalLink key={id} href={referenceRoutes[id].path}>{t(referenceRoutes[id].label)}</InternalLink>
            ))}
          </nav>
        </article>
      </main>
      <Footer />
    </>
  )
}
