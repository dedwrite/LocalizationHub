const version = '0.9.10'
const githubUrl = 'https://github.com/dedwrite/LocalizationHub'
const assetUrl = `${githubUrl}/releases/download/v${version}/LocalizationHub_${version}_x64-setup.exe`

// Update only after the stable installer and checksum have been published and verified.
export const site = {
  name: 'LocalizationHub',
  version,
  githubUrl,
  releasesUrl: `${githubUrl}/releases`,
  desktopRelease: {
    installerUrl: assetUrl,
    checksumUrl: `${assetUrl}.sha256`,
    sha256: '9ddc36bbde45fea0c198c5549f09b6380b27b271a9833a210c4f07ca10e64495',
  },
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
