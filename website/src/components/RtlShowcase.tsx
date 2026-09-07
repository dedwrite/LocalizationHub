import { useI18n } from "@localizationhub/i18n";
import { FridayClock } from "../delight/LittleSecrets";
import { openGameSecret } from "../delight/gameSecrets";

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
        <button
          type="button"
          className="rtl-game-rune"
          onClick={openGameSecret}
          aria-label={t("delight.gameSecret.open")}
          title={t("delight.gameSecret.hint")}
        >
          <span aria-hidden="true">⌁</span>
        </button>
      </div>
      <div className="rtl-showcase-context">
        <span>
          <small>{t("website.context.speaker")}</small>
          <strong>{t("website.context.speakerVeyra")}</strong>
        </span>
        <span>
          <small>{t("website.context.scene")}</small>
          <strong>{t("website.context.sceneGate")}</strong>
        </span>
        <span>
          <small>{t("website.context.listener")}</small>
          <strong>{t("website.context.listenerPlayer")}</strong>
        </span>
      </div>
      <div className="rtl-showcase-source" dir="ltr">
        <small>{t("website.context.source")}</small>
        <p lang="en">
          Hold the line, <mark dir="ltr">{"{player_name}"}</mark>. The Northern
          Gate does not fall tonight.
        </p>
      </div>
      <div className="rtl-showcase-translation">
        <div>
          <small>{t("website.context.translation")}</small>
          <span>{t("landing.context.review")}</span>
        </div>
        <p lang="ar" dir="rtl">
          اثبُت يا <mark dir="ltr">{"{player_name}"}</mark>. لن تسقط{" "}
          <em>البوابة الشمالية</em> الليلة.
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
