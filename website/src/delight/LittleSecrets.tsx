import { useId, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'

/** Deliberate, local-only discoveries. No global shortcut, sound or timer. */
export function FooterSecret() {
  const { t } = useI18n()
  const id = useId()
  const [taps, setTaps] = useState(0)
  const open = taps >= 3
  return <div className="little-secret" data-i18n-skip>
    <button className="secret-trigger" type="button" aria-label={t(open ? 'delight.secretClose' : 'delight.secret')} aria-expanded={open} aria-controls={id} title={t('delight.secretHint')} onClick={() => setTaps(value => value >= 3 ? 0 : value + 1)} onKeyDown={event => { if (event.key === 'Escape') setTaps(0) }}><span aria-hidden="true">{'{…}'}</span></button>
    <div id={id} className="secret-note" hidden={!open} role="status"><strong>{t('delight.secretTitle')}</strong><span>{t('delight.secretBody')}</span></div>
  </div>
}

export function FridayClock() {
  const { t } = useI18n()
  const id = useId()
  const [open, setOpen] = useState(false)
  return <><button type="button" className="friday-clock" aria-expanded={open} aria-controls={id} onClick={event => { setOpen(!open); event.currentTarget.focus() }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}><bdi>Friday · 11:59 PM</bdi></button><span id={id} className="friday-note" hidden={!open} role="status" data-i18n-skip><b>{t('delight.friday')}</b> {t('delight.fridayBody')}</span></>
}

/** Quiet local-only discovery on the Local trust row. */
export function OnDeviceSecret({ label }: { label: string }) {
  const { t } = useI18n()
  const id = useId()
  const [open, setOpen] = useState(false)
  return <span className="on-device-secret" data-i18n-skip>
    <button type="button" className="on-device-secret-trigger" aria-expanded={open} aria-controls={id} onClick={event => { setOpen(value => !value); event.currentTarget.focus() }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>{label}</button>
    <span id={id} className="on-device-secret-note" hidden={!open} role="status"><b>{t('delight.onDeviceSecret')}</b> {t('delight.onDeviceSecretBody')}</span>
  </span>
}

/** Hidden footnote beside the FAQ heading — localization craft, not product chrome. */
export function FaqLocaleSecret() {
  const { t } = useI18n()
  const id = useId()
  const [open, setOpen] = useState(false)
  return <span className="faq-locale-secret" data-i18n-skip>
    <button
      type="button"
      className="faq-locale-secret-trigger"
      aria-label={t(open ? 'delight.localeSecretClose' : 'delight.localeSecret')}
      aria-expanded={open}
      aria-controls={id}
      title={t('delight.localeSecretHint')}
      onClick={event => { setOpen(value => !value); event.currentTarget.focus() }}
      onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}
    >
      <span aria-hidden="true">※</span>
    </button>
    <span id={id} className="faq-locale-secret-note" hidden={!open} role="status">
      <b>{t('delight.localeSecretTitle')}</b> {t('delight.localeSecretBody')}
    </span>
  </span>
}
