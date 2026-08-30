import type { EntryContext, ParsedDialogueContext } from '@localizationhub/core'
import { useI18n, type MessageKey } from '@localizationhub/i18n'
import type { ReactNode } from 'react'

/** Existing compact Desktop context display, using canonical parsed/extracted context. */
export default function DialogueContextStrip({ context }: { context: EntryContext | ParsedDialogueContext }) {
  const { t } = useI18n()
  const genderKeys: Record<string, MessageKey> = {
    male: 'workspace.context.male', female: 'workspace.context.female', neutral: 'workspace.context.neutral',
  }
  const gender = (value?: string) => value && value !== 'unknown'
    ? ` (${genderKeys[value] ? t(genderKeys[value]) : value})` : ''
  const parts: ReactNode[] = []
  if (context.speaker) parts.push(<span key="speaker">{t('extraction.context.speaker')} <bdi>{context.speaker}</bdi>{gender(context.speakerGender)}</span>)
  if (context.listeners?.length) {
    parts.push(<span key="listeners">→ {t('extraction.source.listeners')}: {context.listeners.map((name, index) => <span key={index}>{index > 0 && ', '}<bdi>{name}</bdi>{gender(context.listenerGenders?.[index])}</span>)}</span>)
  } else if (context.listener) {
    parts.push(<span key="listener">→ {t('extraction.context.listener')} <bdi>{context.listener}</bdi>{gender(context.listenerGender)}</span>)
  }
  if (context.scene) parts.push(<span key="scene">{t('extraction.context.scene')} <bdi>{context.scene}</bdi></span>)
  if (context.conversationId) parts.push(<span key="conversation">{t('workspace.context.conversation')} <bdi>{context.conversationId}</bdi></span>)
  if (!parts.length) return null
  return <div className="source-text" data-i18n-skip>{parts.map((part, index) => <span key={index}>{index > 0 && ' · '}{part}</span>)}</div>
}
