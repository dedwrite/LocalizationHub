import type { MessageCatalog } from '../types'

/*
 * The reference pages: what LocalizationHub actually reads, per engine and per
 * format. Every status here is copied from the project's own compatibility
 * record, which states what was validated against real game files and what is
 * only partially proven. Nothing on these pages promises more than that — the
 * pages exist so a visitor can check the claim instead of trusting the landing.
 */
export const capabilityMessages = {
  'capability.eyebrow': { en: 'Product reference · ', ar: 'مرجع المنتج · ' },
  'capability.note': {
    en: 'Statuses come from the project’s tested compatibility record. Every “read directly” line was validated against real game files or fixtures; partial support is written as partial, and an external tool is named as a tool you configure yourself.',
    ar: 'الحالات مأخوذة من سجل التوافق المُختبَر في المشروع. كل سطر في «يُقرأ مباشرة» تم التحقق منه على ملفات ألعاب حقيقية أو عيّنات اختبار؛ والدعم الجزئي مكتوب كجزئي، والأداة الخارجية مذكورة كأداة تُعدّها بنفسك.',
  },
  'capability.index.nav': { en: 'Reference', ar: 'المرجع' },
  'capability.index.title': { en: 'What LocalizationHub reads', ar: 'ما يقرأه LocalizationHub' },
  'capability.index.lede': {
    en: 'Six short pages on the engines, formats and systems behind the workspace: what is read directly, what needs a tool you configure, and what is still partial. Each one is written from the same tested record the compatibility notes use.',
    ar: 'ست صفحات قصيرة عن المحركات والصيغ والأنظمة التي تعمل خلف مساحة العمل: ما يُقرأ مباشرة، وما يحتاج أداة تُعدّها بنفسك، وما زال جزئيًا. كل صفحة مكتوبة من سجل الاختبار نفسه المستخدم في ملاحظات التوافق.',
  },
  'capability.json.label': { en: 'JSON and CSV', ar: 'JSON وCSV' },
  'capability.po.label': { en: 'PO and POT', ar: 'PO وPOT' },
  'capability.memory.label': { en: 'Translation memory', ar: 'ذاكرة الترجمة' },
  'capability.openEditor': { en: 'Open a file in the browser editor', ar: 'افتح ملفًا في محرر المتصفح' },
  'capability.windowsNote': {
    en: 'Game archives are read by the Windows build, where the archive tools run on your machine.',
    ar: 'تُقرأ أرشيفات الألعاب في نسخة ويندوز، حيث تعمل أدوات الأرشيف على جهازك.',
  },

  /* ---- Godot ---------------------------------------------------------- */
  'capability.godot.title': { en: 'Godot, read as it ships', ar: 'غودوت كما يُشحن' },
  'capability.godot.lede': {
    en: 'A Godot project keeps its text in very different places: CSV tables, PO catalogues, scene properties, scripts, JSON databases, and — in some games — a custom binary story format. Each one is read as its own surface, never as “some strings in a folder”.',
    ar: 'يحتفظ مشروع غودوت بنصوصه في أماكن متباعدة: جداول CSV، وكتالوجات PO، وخصائص المشاهد، والسكربتات، وقواعد بيانات JSON، وفي بعض الألعاب صيغة قصة ثنائية خاصة. كل سطح يُقرأ على حدة، لا كـ«نصوص في مجلد».',
  },
  'capability.godot.read.title': { en: 'Read directly', ar: 'يُقرأ مباشرة' },
  'capability.godot.read.1': { en: 'CSV localization tables: first column keys, one column per locale, `_` comment rows.', ar: 'جداول CSV: المفتاح في العمود الأول، وعمود لكل لغة، وأسطر التعليق التي تبدأ بـ`_`.' },
  'capability.godot.read.2': { en: 'Gettext PO and POT catalogues, including plural forms, translator comments and source references.', ar: 'كتالوجات PO وPOT، بما فيها صيغ الجمع وتعليقات المترجمين ومراجع المصدر.' },
  'capability.godot.read.3': { en: 'Text scenes (`.tscn`) and resources (`.tres`): user-facing properties only, never `res://uid` paths.', ar: 'المشاهد النصية (`.tscn`) والموارد (`.tres`): الخصائص الموجّهة للمستخدم فقط، ولا مسارات `res://uid` أبدًا.' },
  'capability.godot.read.4': { en: 'GDScript: calls to `tr()`, `tr_n()` and `TranslationServer.translate()` only. Plain string literals and paths stay out on purpose.', ar: 'سكربتات GDScript: نداءات `tr()` و`tr_n()` و`TranslationServer.translate()` فقط. النصوص العادية والمسارات مستبعدة عن قصد.' },
  'capability.godot.read.5': { en: 'JSON databases with locale variants: `fb.json` plus `fb_ja.json` become one entry with its variants attached, not two unrelated strings.', ar: 'قواعد بيانات JSON مع تنويعات اللغة: `fb.json` مع `fb_ja.json` يصبحان نصًا واحدًا بمتغيّراته، لا نصين منفصلين.' },
  'capability.godot.read.6': { en: 'Until Then story dialogue (`.inkb`) natively: speaker lines, thoughts, beats and inline commands, with the previous speaker inherited on continuation lines.', ar: 'حوارات قصة Until Then (`.inkb`) تُقرأ داخليًا: أسطر المتحدثين والأفكار والإيقاعات والأوامر المضمّنة، مع وراثة المتحدث السابق في أسطر المتابعة.' },
  'capability.godot.tool.title': { en: 'Needs a tool you configure', ar: 'يحتاج أداة تُعدّها بنفسك' },
  'capability.godot.tool.1': { en: '`.pck` archives: a configured GDRE build unpacks the archive into a folder you own, and every text surface above continues from there.', ar: 'أرشيفات `.pck`: نسخة GDRE تُعدّها بنفسك تفك الأرشيف إلى مجلد تملكه، ثم تُقرأ الأسطح أعلاه من هناك.' },
  'capability.godot.tool.2': { en: 'Binary `.res`/`.scn` and `.gdc`: converted to text on a copy, then parsed. The original file is never rewritten.', ar: 'الملفات الثنائية `.res`/`.scn` و`.gdc`: تُحوَّل إلى نص على نسخة ثم تُقرأ. الملف الأصلي لا يُعاد كتابته أبدًا.' },
  'capability.godot.limits.title': { en: 'Known limits', ar: 'حدود معروفة' },
  'capability.godot.limits.1': { en: '`OptimizedTranslation` (`.translation`): the values are recoverable, the keys are one-way hashes and are genuinely absent from the file.', ar: '`OptimizedTranslation` (`.translation`): القيم قابلة للاستعادة، أما المفاتيح فهي بصمات أحادية الاتجاه وغائبة فعلًا عن الملف.' },
  'capability.godot.limits.2': { en: 'Choices behind `$ ftb.request_player_choice` are structurally ambiguous between narration and internals, so they are reported as a boundary instead of invented as options.', ar: 'الخيارات خلف `$ ftb.request_player_choice` متشابهة بنيويًا بين السرد والدواخل، فتُذكر كحدّ صريح بدل اختلاق خيارات.' },
  'capability.godot.limits.3': { en: 'A project that ships fully compiled, with no readable source text, produces a clear “nothing translatable found” result instead of a guess.', ar: 'المشروع المُجمَّع كاملًا، بلا نصوص مصدرية قابلة للقراءة، يعطي نتيجة واضحة «لا يوجد نص قابل للترجمة» بدل تخمين.' },
  'capability.godot.never.title': { en: 'Never touched', ar: 'لا يُلمس أبدًا' },
  'capability.godot.never.1': { en: 'Nothing is written back into a `.pck`, `.res` or `.scn`. Extraction is read-only, and the archive checksum is verified again after a run.', ar: 'لا شيء يُكتب داخل `.pck` أو `.res` أو `.scn`. القراءة للاستخراج فقط، ويُتحقق من بصمة الأرشيف مرة أخرى بعد كل تشغيل.' },

  /* ---- Unreal --------------------------------------------------------- */
  'capability.unreal.title': { en: 'Unreal, read from its own localisation containers', ar: 'أنريل، من حاويات التعريب الخاصة به' },
  'capability.unreal.lede': {
    en: 'Unreal keeps text in LOCRES containers, metadata sidecars and exported tables, then packs them inside archives. LocalizationHub reads the containers itself and orchestrates a verified tool only where the archive format requires one.',
    ar: 'يحفظ أنريل النصوص في حاويات LOCRES وملفات البيانات الوصفية والجداول المُصدَّرة، ثم يضمّها داخل أرشيفات. يقرأ LocalizationHub الحاويات بنفسه، ولا يستعين بأداة موثّقة إلا حيث تتطلب صيغة الأرشيف ذلك.',
  },
  'capability.unreal.read.title': { en: 'Read directly', ar: 'يُقرأ مباشرة' },
  'capability.unreal.read.1': { en: '`.locres` in both compact and optimized (CRC32 / CityHash64) layouts, validated against a shipping engine catalogue of 54,314 entries.', ar: 'ملفات `.locres` بالتنسيقين المدمج والمحسَّن (CRC32 / CityHash64)، وقد تم التحقق منها على كتالوج محرك حقيقي فيه 54,314 نصًا.' },
  'capability.unreal.read.2': { en: '`.locmeta`: native culture and compiled cultures, kept as metadata and never turned into entries.', ar: '`.locmeta`: اللغة الأصلية واللغات المُجمَّعة، تُحفظ كبيانات وصفية ولا تتحول إلى نصوص.' },
  'capability.unreal.read.3': { en: 'String Table CSV and structured JSON dumps of `FText`, DataTable and DialogueWave assets.', ar: 'جداول النصوص CSV وملفات JSON المُصدَّرة من أصول `FText` وDataTable وDialogueWave.' },
  'capability.unreal.read.4': { en: 'Rich markup (`<Bold>`, `<img id=…>`, colour tags) preserved as protected tokens rather than stripped.', ar: 'الوسوم الغنية (`<Bold>` و`<img id=…>` ووسوم الألوان) تُحفظ كرموز محمية بدل إزالتها.' },
  'capability.unreal.tool.title': { en: 'Needs a tool you configure', ar: 'يحتاج أداة تُعدّها بنفسك' },
  'capability.unreal.tool.1': { en: '`.pak`: a configured repak build unpacks into a temporary folder, and the LOCRES inside continue through the same reader — 55,950 entries from 50 containers in a validated run.', ar: 'أرشيفات `.pak`: نسخة repak تُعدّها بنفسك تفك الأرشيف إلى مجلد مؤقت، ثم تُقرأ ملفات LOCRES داخله بالمحرك نفسه — 55,950 نصًا من 50 حاوية في تشغيل موثّق.' },
  'capability.unreal.tool.2': { en: '`.utoc` / `.ucas` (IoStore): the same contract with retoc, including the `.ucas` companion file.', ar: 'ملفات `.utoc` / `.ucas` (IoStore): العقد نفسه مع retoc، مع ملف `.ucas` المرافق.' },
  'capability.unreal.tool.3': { en: 'Binary `.uasset` to JSON with a UAssetDumper build, when the asset version is one it can read.', ar: 'تحويل `.uasset` الثنائي إلى JSON عبر UAssetDumper، عندما تكون نسخة الأصل ضمن النسخ التي يقرأها.' },
  'capability.unreal.limits.title': { en: 'Known limits', ar: 'حدود معروفة' },
  'capability.unreal.limits.1': { en: 'Legacy LOCRES without a magic header is read, but has not been validated against a real legacy file yet.', ar: 'تنسيق LOCRES القديم بلا ترويسة يُقرأ، لكنه لم يُتحقق منه بعد على ملف قديم حقيقي.' },
  'capability.unreal.limits.2': { en: 'UE5.x `.uasset` dialogue assets stop at “partial”: the pinned UAssetAPI version cannot read their version header, and guessing is not an option.', ar: 'أصول الحوار `.uasset` في UE5.x تتوقف عند «جزئي»: نسخة UAssetAPI المثبّتة لا تقرأ ترويسة نسختها، والتخمين ليس خيارًا.' },
  'capability.unreal.limits.3': { en: 'Encrypted archives are read only with an AES key you supply. The key is passed to the tool as an argument and is never stored, logged or uploaded.', ar: 'الأرشيفات المشفّرة تُقرأ فقط بمفتاح AES تقدّمه أنت. يُمرَّر المفتاح إلى الأداة كوسيط، ولا يُخزَّن ولا يُسجَّل ولا يُرفع.' },
  'capability.unreal.limits.4': { en: 'Engine and plugin stock text (`Engine/…`, test namespaces) is auto-excluded from the list: it is not your game’s text.', ar: 'نصوص المحرك والإضافات (`Engine/…` ونطاقات الاختبار) تُستبعد تلقائيًا من القائمة، فهي ليست نصوص لعبتك.' },
  'capability.unreal.never.title': { en: 'Never touched', ar: 'لا يُلمس أبدًا' },
  'capability.unreal.never.1': { en: 'Nothing is written back into a `.pak`, `.utoc`, `.ucas` or `.uasset`.', ar: 'لا شيء يُكتب داخل `.pak` أو `.utoc` أو `.ucas` أو `.uasset`.' },

  /* ---- Unity ---------------------------------------------------------- */
  'capability.unity.title': { en: 'Unity, through a helper you configure', ar: 'يونتي عبر أداة مساعدة تُعدّها بنفسك' },
  'capability.unity.lede': {
    en: 'Unity text lives in Localization tables, TextAssets and serialized assets that only a type-aware reader can see. The text surfaces are read directly; the binary ones are handed to a pinned UnityPy helper.',
    ar: 'نصوص يونتي تعيش في جداول Localization وفي TextAssets وفي أصول مُسلسلة لا يراها إلا قارئ يعرف الأنواع. الأسطح النصية تُقرأ مباشرة، والثنائية تُسلَّم إلى أداة UnityPy مثبّتة.',
  },
  'capability.unity.read.title': { en: 'Read directly', ar: 'يُقرأ مباشرة' },
  'capability.unity.read.1': { en: 'Unity Localization String Table JSON: tables, locales, keys, and the Smart String flag.', ar: 'جداول Localization بصيغة JSON: الجداول واللغات والمفاتيح وعلم Smart String.' },
  'capability.unity.read.2': { en: 'Smart Strings with nested selectors and placeholders, kept protected through editing and export.', ar: 'نصوص Smart Strings بما فيها المحددات والعناصر النائبة المتداخلة، تبقى محمية أثناء التحرير والتصدير.' },
  'capability.unity.read.3': { en: 'TextAssets routed by content: JSON, CSV, Ink, Yarn, XML and YAML.', ar: 'ملفات TextAsset تُوجَّه حسب محتواها: JSON وCSV وInk وYarn وXML وYAML.' },
  'capability.unity.read.4': { en: 'Ink narrative JSON: `^line` dialogue, `*choice`, speaker prefixes and conversation order.', ar: 'حوارات Ink بصيغة JSON: أسطر `^line` وخيارات `*choice` وبادئات المتحدثين وترتيب المحادثة.' },
  'capability.unity.read.5': { en: 'Dialogue System (Pixel Crushers) databases: Dialogue Text, Menu Text and actor/item display names, with speaker and listener resolved from the asset’s own ids.', ar: 'قواعد Dialogue System (Pixel Crushers): نص الحوار ونص القائمة وأسماء الشخصيات والعناصر، مع تحديد المتحدث والمستمع من معرّفات الأصل نفسه.' },
  'capability.unity.tool.title': { en: 'Needs a tool you configure', ar: 'يحتاج أداة تُعدّها بنفسك' },
  'capability.unity.tool.1': { en: '`resources.assets`, `sharedassets*.assets`, `.bundle` and `.unity3d`: a pinned UnityPy helper dumps text-bearing objects to JSON — 22,564 dialogue strings from a shipping bundle in a validated run.', ar: 'ملفات `resources.assets` و`sharedassets*.assets` و`.bundle` و`.unity3d`: أداة UnityPy مثبّتة تُخرج الأصول النصية إلى JSON — 22,564 نص حوار من حزمة لعبة حقيقية في تشغيل موثّق.' },
  'capability.unity.tool.2': { en: 'The helper is inventory-first: textures, meshes, shaders and audio are listed and never deserialized.', ar: 'الأداة تبدأ بالجرد: الصور والمجسمات والتظليل والصوت تُدرج في القائمة ولا تُفكَّك أبدًا.' },
  'capability.unity.limits.title': { en: 'Known limits', ar: 'حدود معروفة' },
  'capability.unity.limits.1': { en: 'Assets built with a stripped type tree produce no typed data: they appear as inventory with no entries and no guess.', ar: 'الأصول المبنيّة بشجرة أنواع مجرّدة لا تعطي بيانات مُصنَّفة: تظهر في الجرد بلا نصوص وبلا تخمين.' },
  'capability.unity.limits.2': { en: 'A schema with unusual field names is mapped by you in the Context Mapping review, never inferred from field position.', ar: 'المخطط الذي يستخدم أسماء حقول غير معتادة تقوم أنت بربطه في مراجعة «ربط السياق»، ولا يُستنتج من موضع الحقل.' },
  'capability.unity.never.title': { en: 'Never touched', ar: 'لا يُلمس أبدًا' },
  'capability.unity.never.1': { en: 'Unity serialized assets are never rewritten, and asset injection is not offered at all.', ar: 'الأصول المُسلسلة في يونتي لا تُعاد كتابتها، ولا يُقدَّم أي حقن داخل الأصول.' },

  /* ---- JSON ----------------------------------------------------------- */
  'capability.json.title': { en: 'JSON and CSV, without guessing which string is text', ar: 'JSON وCSV بلا تخمين أي نص هو نص مترجم' },
  'capability.json.lede': {
    en: 'A JSON file is not a translation file. The analyzer reads structure you can point at, and when your schema uses its own field names you map them — instead of hoping the tool guessed right.',
    ar: 'ملف JSON ليس ملف ترجمة. يقرأ المحلل بنية يمكنك الإشارة إليها، وإذا كان مخططك يستخدم أسماء حقوله الخاصة تربطها أنت — بدل أن تأمل أن التخمين كان صائبًا.',
  },
  'capability.json.read.title': { en: 'Read directly', ar: 'يُقرأ مباشرة' },
  'capability.json.read.1': { en: 'Structured JSON and CSV records: keys with their text, and key/value pairs that are clearly copy rather than configuration.', ar: 'سجلات JSON وCSV المهيكلة: المفاتيح مع نصوصها، والأزواج التي تبدو نصوصًا لا إعدادات.' },
  'capability.json.read.2': { en: 'The UI-text fields that dominate real databases: `name`, `title`, `description`, `category`.', ar: 'حقول النصوص الشائعة في قواعد البيانات الحقيقية: `name` و`title` و`description` و`category`.' },
  'capability.json.read.3': { en: 'Dialogue context already present in the file: speaker, listener, both genders, scene, conversation, node, choice group, voice and portrait — from explicit field names only.', ar: 'سياق الحوار الموجود فعلًا في الملف: المتحدث والمستمع والجنس لكل منهما والمشهد والمحادثة والعقدة ومجموعة الخيارات والصوت والصورة — من أسماء حقول صريحة فقط.' },
  'capability.json.read.4': { en: 'Nested speaker objects and top-level character databases: an id becomes the character’s display name and gender by structure, not by resemblance.', ar: 'كائنات المتحدثين المتداخلة وقواعد بيانات الشخصيات: يتحول المعرّف إلى اسم العرض والجنس بالبنية، لا بالتشابه.' },
  'capability.json.read.5': { en: 'Locale variants collapse: `fb.json` with `fb_ja.json` becomes one entry with its variants attached instead of unrelated duplicates.', ar: 'تنويعات اللغة تتجمع: `fb.json` مع `fb_ja.json` يصبحان نصًا واحدًا بمتغيّراته بدل تكرارات غير مترابطة.' },
  'capability.json.limits.title': { en: 'Known limits', ar: 'حدود معروفة' },
  'capability.json.limits.1': { en: 'Non-canonical field names (`char_from`, `sex_a`, `body`) are mapped by you in the Context Mapping review. Nothing is inferred from position or from the text itself.', ar: 'أسماء الحقول غير المعتادة (`char_from` و`sex_a` و`body`) تربطها أنت في مراجعة «ربط السياق». لا شيء يُستنتج من الموضع ولا من النص نفسه.' },
  'capability.json.limits.2': { en: 'A schema whose text nothing identifies is reported as unclassified rather than extracted.', ar: 'المخطط الذي لا يدل شيء فيه على نصوصه يُصنَّف «غير محدد» بدل أن يُستخرج.' },
  'capability.json.limits.3': { en: 'Binary files are classified, never scanned for printable strings: a byte scan is a guess, not an extraction.', ar: 'الملفات الثنائية تُصنَّف ولا تُفحص بحثًا عن نصوص مطبوعة: فحص البايتات تخمين، لا استخراج.' },
  'capability.json.never.title': { en: 'Never touched', ar: 'لا يُلمس أبدًا' },
  'capability.json.never.1': { en: 'Your original file is not rewritten. Export produces a new file in the same format you opened.', ar: 'ملفك الأصلي لا يُعاد كتابته. التصدير ينتج ملفًا جديدًا بالصيغة نفسها التي فتحتها.' },

  /* ---- PO ------------------------------------------------------------- */
  'capability.po.title': { en: 'Gettext PO and POT, with references intact', ar: 'Gettext PO وPOT مع المراجع كاملة' },
  'capability.po.lede': {
    en: 'PO is the format translators already know: `msgctxt` disambiguation, translator comments and source references. LocalizationHub keeps all of it when it reads the file, and writes it back on export.',
    ar: 'PO صيغة يعرفها المترجمون: تمييز بالسياق `msgctxt`، وتعليقات للمترجمين، ومراجع للمصدر. يحتفظ LocalizationHub بها كلها عند القراءة، ويعيد كتابتها عند التصدير.',
  },
  'capability.po.read.title': { en: 'Read directly', ar: 'يُقرأ مباشرة' },
  'capability.po.read.1': { en: '`msgid` and `msgstr` including escaped, multi-line strings.', ar: '`msgid` و`msgstr` بما فيها النصوص الممتدة على أسطر متعددة بالتهريب.' },
  'capability.po.read.2': { en: '`msgctxt` disambiguation, kept as context on the entry rather than merged away.', ar: 'التمييز بـ`msgctxt` يبقى سياقًا على النص ولا يُدمج أو يُهمل.' },
  'capability.po.read.3': { en: 'Translator comments (`#`) and source references (`#:`) shown with the entry instead of being dropped.', ar: 'تعليقات المترجمين (`#`) ومراجع المصدر (`#:`) تظهر مع النص بدل إسقاطها.' },
  'capability.po.read.4': { en: 'Arabic and CJK content survives the round trip, including the export back to PO.', ar: 'المحتوى العربي وشرق الآسيوي ينجو من الرحلة كاملة، بما فيها التصدير إلى PO.' },
  'capability.po.read.5': { en: 'Explicit context written in comments (`# Speaker: Mark`, `# Scene: School Hallway`) becomes real dialogue context, and the comments stay on the entry.', ar: 'السياق الصريح المكتوب في التعليقات (`# Speaker: Mark` أو `# Scene: School Hallway`) يصبح سياق حوار فعليًا، وتبقى التعليقات على النص.' },
  'capability.po.limits.title': { en: 'Known limits', ar: 'حدود معروفة' },
  'capability.po.limits.1': { en: 'Plural forms (`msgid_plural` with `msgstr[n]`) are built by the extraction path, where the plural index is known. Opening a PO file directly reads `msgid`/`msgstr`/`msgctxt`.', ar: 'صيغ الجمع (`msgid_plural` مع `msgstr[n]`) يبنيها مسار الاستخراج حيث يُعرف رقم الصيغة. أما فتح ملف PO مباشرة فيقرأ `msgid`/`msgstr`/`msgctxt`.' },
  'capability.po.limits.2': { en: 'A catalogue with no `msgid` entries is reported as empty instead of passing silently.', ar: 'الكتالوج بلا أي `msgid` يُبلَّغ عنه كفارغ بدل أن يمرّ بصمت.' },
  'capability.po.limits.3': { en: 'The catalogue header (`Plural-Forms`, project metadata) is not re-emitted: an exported catalogue is rebuilt from its entries.', ar: 'ترويسة الكتالوج (`Plural-Forms` وبيانات المشروع) لا تُعاد كتابتها: الكتالوج المُصدَّر يُبنى من نصوصه.' },

  /* ---- Translation memory --------------------------------------------- */
  'capability.memory.title': { en: 'Translation memory that stays in the project', ar: 'ذاكرة ترجمة تبقى داخل المشروع' },
  'capability.memory.lede': {
    en: 'Matching runs against the memory inside the project you already have open. Nothing is uploaded to look for a suggestion, and no memory is shared with anyone you did not invite.',
    ar: 'المطابقة تجري على الذاكرة الموجودة داخل المشروع المفتوح عندك. لا يُرفع شيء للبحث عن اقتراح، ولا تُشارك الذاكرة مع أي جهة لم تدعُها.',
  },
  'capability.memory.how.title': { en: 'How matching works', ar: 'كيف تعمل المطابقة' },
  'capability.memory.how.1': { en: 'The editor compares the current source with the project’s saved memory and shows a score next to every candidate.', ar: 'يقارن المحرر النص الحالي مع ذاكرة المشروع ويعرض درجة بجانب كل اقتراح.' },
  'capability.memory.how.2': { en: 'Matching is similarity, not exactness, and weak matches stay out of the way below the threshold.', ar: 'المطابقة تشابه لا تطابق تام، والاقتراحات الضعيفة تبقى بعيدة دون حدّ التشابه.' },
  'capability.memory.how.3': { en: 'Applying a candidate edits the draft like any other change: it is undoable, and it stays unsaved until you save.', ar: 'تطبيق الاقتراح يعدّل المسودة كأي تعديل آخر: يمكن التراجع عنه، ويبقى غير محفوظ حتى تحفظ أنت.' },
  'capability.memory.lives.title': { en: 'Where the memory lives', ar: 'أين تعيش الذاكرة' },
  'capability.memory.lives.1': { en: 'In a project opened from a file, the memory is part of that file on your machine.', ar: 'في مشروع مفتوح من ملف، الذاكرة جزء من ذلك الملف على جهازك.' },
  'capability.memory.lives.2': { en: 'In a Cloud Project it travels with the project the same way every entry does, and only to your own server address.', ar: 'في مشروع سحابي تنتقل الذاكرة مع المشروع كما تنتقل كل النصوص، وإلى عنوان خادمك أنت فقط.' },
  'capability.memory.not.title': { en: 'What it does not do', ar: 'ما لا تفعله' },
  'capability.memory.not.1': { en: 'No shared server memory across users or teams, and no measuring of your content.', ar: 'لا ذاكرة مشتركة بين المستخدمين أو الفرق، ولا قياس لمحتواك.' },
  'capability.memory.not.2': { en: 'No machine translation is requested by matching. An external provider is contacted only when you ask for it, with the text you selected.', ar: 'المطابقة لا تطلب ترجمة آلية. لا يُتصل بمزوّد خارجي إلا عندما تطلب ذلك، وبالنص الذي حدّدته.' },
  'capability.memory.not.3': { en: 'No suggestion is invented: a candidate is always a translation that already exists in the project.', ar: 'لا يُختلق اقتراح: كل مرشح ترجمة موجودة فعلًا في المشروع.' },
} satisfies MessageCatalog
