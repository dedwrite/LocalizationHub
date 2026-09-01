import { useI18n } from '@localizationhub/i18n'
import { openGameSecret } from '../delight/gameSecrets'

export default function RtlShowcase() {
  const { t } = useI18n()
  return <article className="rtl-showcase" lang="ar" dir="rtl" data-i18n-skip>
    <div className="rtl-showcase-head" dir="ltr">
      <div><i aria-hidden="true" /><span>AR / RTL PREVIEW</span></div>
      <button type="button" className="rtl-game-rune" onClick={openGameSecret} aria-label={t('delight.gameSecret.open')} title={t('delight.gameSecret.hint')}><span aria-hidden="true">⌁</span></button>
    </div>
    <div className="rtl-showcase-context">
      <span><small>المتحدث</small><strong>الكابتن فيرا</strong></span>
      <span><small>المشهد</small><strong>البوابة الشمالية</strong></span>
      <span><small>الاتجاه</small><strong dir="ltr">RTL · AUTO</strong></span>
    </div>
    <div className="rtl-showcase-source" dir="ltr">
      <small>SOURCE / EN</small>
      <p>Hold the line, <mark>{'{player_name}'}</mark>. The Northern Gate does not fall tonight.</p>
    </div>
    <div className="rtl-showcase-translation">
      <div><small>الترجمة / AR</small><span>جاهزة للمراجعة</span></div>
      <p>اثبُت يا <mark dir="ltr">{'{player_name}'}</mark>. لن تسقط <em>البوابة الشمالية</em> الليلة.</p>
    </div>
    <div className="rtl-showcase-foot">
      <span><i aria-hidden="true" /> الرموز المحمية سليمة</span>
      <code dir="ltr">{'{player_name}'}</code>
      <b dir="ltr">0 ERRORS</b>
    </div>
  </article>
}
