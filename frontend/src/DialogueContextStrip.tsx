import type { EntryContext, ParsedDialogueContext } from '@localizationhub/core'
import { useI18n, type MessageKey } from '@localizationhub/i18n'
import type { ReactNode } from 'react'

/** Chip-style dialogue context: speaker and listener stay visually distinct. */
export default function DialogueContextStrip({ context }: { context: EntryContext | ParsedDialogueContext }) {
  const { t } = useI18n()
  const genderKeys: Record<string, MessageKey> = {
    male: 'workspace.context.male', female: 'workspace.context.female', neutral: 'workspace.context.neutral',
  }
  const gender = (value?: string) => value && value !== 'unknown'
    ? ` (${genderKeys[value] ? t(genderKeys[value]) : value})` : ''
  const parts: ReactNode[] = []
  if (context.speaker) {
    parts.push(
      <span className="context-person" data-role="speaker" key="speaker">
        <span className="context-field-label">{t('extraction.context.speaker')}</span>{' '}
        <bdi>{context.speaker}</bdi>{gender(context.speakerGender)}
      </span>,
    )
  }
  if (context.listeners?.length) {
    parts.push(
      <span className="context-person" data-role="listener" key="listeners">
        → <span className="context-field-label">{t('extraction.source.listeners')}:</span>{' '}
        {context.listeners.map((name, index) => (
          <span key={index}>{index > 0 && ', '}<bdi>{name}</bdi>{gender(context.listenerGenders?.[index])}</span>
        ))}
      </span>,
    )
  } else if (context.listener) {
    parts.push(
      <span className="context-person" data-role="listener" key="listener">
        → <span className="context-field-label">{t('extraction.context.listener')}</span>{' '}
        <bdi>{context.listener}</bdi>{gender(context.listenerGender)}
      </span>,
    )
  }
  if (context.scene) {
    parts.push(
      <span className="context-detail" key="scene">
        <span className="context-field-label">{t('extraction.context.scene')}</span>{' '}
        <bdi>{context.scene}</bdi>
      </span>,
    )
  }
  if (context.conversationId) {
    parts.push(
      <span className="context-detail" key="conversation">
        <span className="context-field-label">{t('workspace.context.conversation')}</span>{' '}
        <bdi>{context.conversationId}</bdi>
      </span>,
    )
  }
  if (!parts.length) return null
  return <div className="dialogue-context-strip" data-i18n-skip>{parts}</div>
}
