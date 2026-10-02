import { useI18n } from "@localizationhub/i18n";
import Reveal from "../components/Reveal";
import { Header, Footer } from "../components/SiteChrome";
import { InternalLink } from "../internalNavigation";
import TipCard from "../delight/TipCard";
import { FaqLocaleSecret } from "../delight/LittleSecrets";
import AmbientGreeting from "../delight/AmbientGreeting";
import GameMemeSecret from "../delight/GameMemeSecret";
import RtlShowcase from "../components/RtlShowcase";
import LiveEditorPreview from "../components/LiveEditorPreview";
import Icon from "../components/Icon";
import FormatGuide from "../components/FormatGuide";
import LanguageField from "../components/LanguageField";

function Feature({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: string;
}) {
  return (
    <article
      className="feature"
      data-reveal="up"
      data-reveal-delay={
        number === "02" ? "80ms" : number === "03" ? "160ms" : "0ms"
      }
    >
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

export default function Landing() {
  const { t } = useI18n();
  return (
    <div className="public-site" id="public-site">
      <LanguageField />
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-main"
        data-i18n-skip
      >
        <section className="hero" id="product">
          <div className="hero-intro">
            <div className="hero-copy">
              <h1>
                {t("website.hero.titleStart")}
                <br />
                <span className="hero-last-line">{t("website.hero.titleEnd")}</span>
              </h1>
              <p className="hero-category">{t("website.hero.eyebrowMixed")}</p>
            </div>
            <div className="hero-details">
              <p className="hero-description">{t("website.hero.description")}</p>
              <div className="hero-actions">
                <InternalLink className="button button-primary" href="/app/local">
                  {t("website.hero.openLocal")}
                  <Icon name="arrow-up-right" />
                </InternalLink>
                <InternalLink className="button button-quiet" href="/download">
                  {t("website.hero.downloadWindows")}
                  <Icon name="arrow-down" />
                </InternalLink>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <LiveEditorPreview />
          </div>
        </section>
        {/* Scope facts and the sample entry used to crowd the headline. They are
            one measured rail under it, where they read as a spec rather than a
            second claim. */}
        <div className="signal-strip" aria-label={t("website.hero.characteristics")}>
          <span>{t("landing.hero.browser")}</span>
          <span>{t("landing.hero.desktop")}</span>
          <span>{t("website.hero.localFirst")}</span>
          <span>{t("website.hero.protectedTokens")}</span>
          <span>{t("website.signal.optionalCloud")}</span>
        </div>
        <section className="section extraction-section" id="engines">
          <div className="section-intro">
            <h2>
              {t("website.engines.titleStart")}
              <br />
              <i>{t("website.engines.titleEnd")}</i>
            </h2>
            <p>{t("website.engines.body")}</p>
          </div>
          <FormatGuide />
          <p className="section-note">
            <span className="engine-boundary">
              {t("website.extraction.readOnlyCaps")}
            </span>{" "}
            {t("website.engines.readOnlyNote")}
          </p>
        </section>
        <Reveal variant="up">
          <section className="section extraction-section" id="extraction">
            <details className="extraction-details">
              <summary>
                {t("landing.extraction.details")}
                <Icon name="plus" size={18} />
              </summary>
              <div
                className="workflow-line extraction-flow"
                aria-label={t("website.extraction.pipeline")}
              >
                {[
                  [
                    "01",
                    t("website.extraction.gameFolder"),
                    t("website.extraction.gameFolderText"),
                  ],
                  [
                    "02",
                    t("website.extraction.scan"),
                    t("website.extraction.scanText"),
                  ],
                  [
                    "03",
                    t("website.extraction.review"),
                    t("website.extraction.reviewText"),
                  ],
                  [
                    "04",
                    t("common.labels.project"),
                    t("website.extraction.project"),
                  ],
                ].map(([n, title, text]) => (
                  <div className="workflow-step" key={n}>
                    <span>{n}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <small>
                      {n === "01"
                        ? t("website.extraction.input")
                        : n === "02"
                          ? t("website.extraction.scan")
                          : n === "03"
                            ? t("website.extraction.review")
                            : t("website.extraction.readyTranslate")}
                    </small>
                  </div>
                ))}
              </div>
              <p className="section-note">{t("website.extraction.safety")}</p>
            </details>
          </section>
        </Reveal>

        <Reveal variant="left">
          <section className="section context-section" id="context">
            <div className="section-intro">
              <h2>
                {t("website.context.titleStart")}
                <br />
                <i>{t("website.context.titleEnd")}</i>
              </h2>
              <p>{t("website.context.description")}</p>
            </div>
            <RtlShowcase />
          </section>
        </Reveal>

        <Reveal variant="right">
          <section className="section craft-section" id="workspace">
            <div className="section-intro">
              <h2>
                {t("website.feature.titleStart")}
                <br />
                <i>{t("website.feature.titleEnd")}</i>
              </h2>
              <p>{t("website.feature.workspaceDescription")}</p>
            </div>
            <div className="feature-grid" id="workflow">
              <Feature
                number="01"
                title={t("website.feature.translationWorkflow")}
              >
                {t("website.feature.translationWorkflowText")}
              </Feature>
              <Feature number="02" title={t("website.feature.terminology")}>
                {t("website.feature.terminologyText")}
              </Feature>
              <Feature number="03" title={t("website.feature.team")}>
                {t("website.feature.teamText")}
              </Feature>
              <Feature number="04" title={t("website.feature.productivity")}>
                {t("website.feature.productivityText")}
              </Feature>
            </div>
          </section>
        </Reveal>

        <Reveal variant="left">
          <section className="section split-section" id="cloud">
            <div className="split-label">
              <h2>{t("website.surface.kicker")}</h2>
            </div>
            <div className="surface surface-local">
              <h3>{t("website.surface.localProjects")}</h3>
              <p>{t("website.surface.localText")}</p>
              <span className="surface-tag">
                {t("website.surface.localFirstCaps")}
              </span>
            </div>
            <div className="surface surface-cloud">
              <h3>{t("website.surface.cloudProjects")}</h3>
              <p>{t("website.surface.cloudText")}</p>
              <span className="surface-tag">
                {t("website.surface.optionalCloud")}
              </span>
            </div>
            <aside className="privacy-brief" id="privacy">
              <div>
                <h2>
                  {t("website.privacy.titleStart")}{" "}
                  {t("website.privacy.titleEnd")}
                </h2>
                <p>{t("website.privacy.body")}</p>
              </div>
              <InternalLink href="/privacy">
                {t("landing.privacy.details")} <Icon name="arrow-up-right" size={14} />
              </InternalLink>
            </aside>
          </section>
        </Reveal>

        <section className="field-notes" data-i18n-skip>
          <div>
            <span className="field-notes-kicker">{t("delight.notes")}</span>
            <h2>{t("delight.notesTitle")}</h2>
            <p>{t("delight.notesBody")}</p>
            <AmbientGreeting />
          </div>
          <TipCard context="landing" />
        </section>

        <Reveal variant="fade">
          <section className="section faq-section" id="faq">
            <div className="section-intro">
              <h2>
                {t("website.faq.titleStart")}
                <br />
                <i>{t("website.faq.titleEnd")}</i>
                <FaqLocaleSecret />
              </h2>
            </div>
            <div className="faq-list">
              {[
                [
                  t("landing.faq.windowsQuestion"),
                  t("landing.download.access"),
                ],
                [
                  t("website.faq.offlineQuestion"),
                  t("website.faq.offlineAnswer"),
                ],
                [t("website.faq.localQuestion"), t("website.faq.localAnswer")],
                [
                  t("website.faq.mtPrivacyQuestion"),
                  t("website.faq.mtPrivacyAnswer"),
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <Icon name="plus" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>
        <section className="closing-invite">
          <div>
            <h2>{t("landing.closing.title")}</h2>
            <p>{t("landing.closing.body")}</p>
          </div>
          <InternalLink className="button button-primary" href="/app/local">
            {t("website.hero.openLocal")} <Icon name="arrow-up-right" />
          </InternalLink>
        </section>
      </main>
      <GameMemeSecret />
      <Footer />
    </div>
  );
}
