export const site = {
  name: 'LocalizationHub',
  version: '0.9.8',
  /*
   * The one public address the site is allowed to print. The Windows app is
   * distributed to approved testers, so no repository or release URL belongs on
   * a public page: every public path to the desktop build goes through this
   * mail address instead.
   */
  contactEmail: 'support@localizationhub.app',
  supportedPlatforms: ['Windows x64'],
  supportedFormats: ['JSON', 'CSV', 'gettext PO', 'LocalizationHub Project (.lhproj)'],
  /*
   * Supported game-engine families for read-only extraction. Careful wording:
   * direct parsing where native, external verified tools where not, and honest
   * partial boundaries. Full detail lives in docs/dev/v0.7-engine-compatibility.md.
   */
  supportedEngines: [
    { name: 'Godot', note: 'PCK extraction plus native CSV, PO, scenes, and INKB dialogue, with locale aggregation.' },
    { name: 'Unreal', note: 'LOCRES/LOCMETA plus verified PAK and IoStore tools; some UAsset versions remain partial.' },
    { name: 'Unity', note: 'UnityPy-assisted assets, TextAsset, and dialogue systems; stripped type trees remain limited.' },
  ],
} as const
