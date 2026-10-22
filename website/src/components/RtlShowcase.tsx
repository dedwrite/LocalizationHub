import { useI18n } from "@localizationhub/i18n";
import { FridayClock } from "../delight/LittleSecrets";

export default function RtlShowcase() {
  const { t } = useI18n();
  return (
    <article
      className="rtl-showcase context-demo"
      id="arabic"
      aria-label={t("website.context.illustrative")}
      data-i18n-skip
    >
      <div className="rtl-showcase-head">
        <div>
          <i aria-hidden="true" />
          <span>{t("landing.context.example")}</span>
          <FridayClock hidden />
        </div>
      </div>
      <div className="rtl-showcase-context">
        <span>
          <small>{t("website.context.speaker")}</small>
          <strong>{t("website.context.speakerMira")}</strong>
        </span>
        <span>
          <small>{t("website.context.scene")}</small>
          <strong>{t("website.context.sceneRelay")}</strong>
        </span>
        <span>
          <small>{t("website.context.listener")}</small>
          <strong>{t("website.context.listenerPlayer")}</strong>
        </span>
      </div>
      <div className="rtl-showcase-source" dir="ltr">
        <small>{t("website.context.source")}</small>
        <p lang="en">
          Stay on this frequency, <mark dir="ltr">{"{player_name}"}</mark>. I can hear you through the static.
        </p>
      </div>
      <div className="rtl-showcase-translation">
        <div>
          <small>{t("website.context.translation")}</small>
          <span>{t("landing.context.review")}</span>
        </div>
        <p lang="ar" dir="rtl">
          ابقَ على هذا التردد يا <mark dir="ltr">{"{player_name}"}</mark>؛ أسمع صوتك وسط <em>التشويش</em>.
        </p>
      </div>
      <div className="rtl-showcase-foot">
        <span>
          <i aria-hidden="true" /> {t("landing.try.valid")}
        </span>
        <code dir="ltr">{"{player_name}"}</code>
        <b>{t("landing.context.directions")}</b>
      </div>
    </article>
  );
}
