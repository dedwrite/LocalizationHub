import {
  useMemo,
  useState,
} from 'react'

import {
  open,
  save,
} from '@tauri-apps/plugin-dialog'

import {
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

import {
  validateProtectedTokens,
  type TokenProfileId,
} from './tokens'

import {
  isFullyProtectedText,
} from './tokens/protection'

import {
  describeParsedDocument,
  parseLocalizationFile,
  type LocalizationFileFormat,
  type ParsedLocalizationDocument,
  type ParsedLocalizationEntry,
  type RecordArraySchema,
} from './parsers'

import {
  exportLocalizationDocument,
} from './exporters'

import TokenProfileSelect from './TokenProfileSelect'

import './App.css'

type TranslationEntry =
  ParsedLocalizationEntry

type EntryFilter =
  | 'all'
  | 'untranslated'
  | 'translated'

type StoredDocumentInfo = {
  parser: 'json'
  format: LocalizationFileFormat
  sourceText: string
  schema?: RecordArraySchema
}

type LocalizationProjectV2 = {
  format: 'LocalizationHubProject'
  version: 2

  sourceFileName: string
  selectedEntryId: string | null
  tokenProfile: TokenProfileId

  document: StoredDocumentInfo

  entries: TranslationEntry[]
}

type LegacyTranslationEntry = {
  key: string
  source: string
  translation: string
}

type LocalizationProjectV1 = {
  format: 'LocalizationHubProject'
  version: 1

  sourceFileName: string
  selectedKey: string | null
  tokenProfile?: TokenProfileId

  entries: LegacyTranslationEntry[]
}

function App() {
  const [
    entries,
    setEntries,
  ] =
    useState<TranslationEntry[]>([])

  const [
    fileName,
    setFileName,
  ] =
    useState('')

  const [
    selectedEntryId,
    setSelectedEntryId,
  ] =
    useState<string | null>(null)

  const [
    documentInfo,
    setDocumentInfo,
  ] =
    useState<StoredDocumentInfo | null>(
      null,
    )

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('')

  const [
    entryFilter,
    setEntryFilter,
  ] =
    useState<EntryFilter>('all')

  const [
    tokenProfile,
    setTokenProfile,
  ] =
    useState<TokenProfileId>(
      'generic',
    )

  /*
   * نحسب الـentries اللي مصدرها
   * كامل عبارة عن شيء محمي.
   *
   * أمثلة:
   *
   * :: wait
   * $ play_anim CharacterA idle
   * -> next_scene
   * [...]
   *
   * useMemo مهم هنا لأن الملفات
   * ممكن تحتوي آلاف الأسطر.
   */
  const fullyProtectedEntryIds =
    useMemo(
      () => {
        const ids =
          new Set<string>()

        for (
          const entry
          of entries
        ) {
          if (
            isFullyProtectedText(
              entry.source,
              tokenProfile,
            )
          ) {
            ids.add(
              entry.id,
            )
          }
        }

        return ids
      },
      [
        entries,
        tokenProfile,
      ],
    )

  const protectedCount =
    fullyProtectedEntryIds.size

  const translatableCount =
    entries.length -
    protectedCount

  /*
   * Protected entries لا تدخل
   * في تقدم الترجمة.
   */
  const translatedCount =
    entries.filter(
      (entry) =>
        !fullyProtectedEntryIds.has(
          entry.id,
        ) &&
        entry.translation.trim() !== '',
    ).length

  const untranslatedCount =
    translatableCount -
    translatedCount

  const progress =
    translatableCount === 0
      ? 0
      : Math.round(
          (
            translatedCount /
            translatableCount
          ) * 100,
        )

  const selectedEntry =
    entries.find(
      (entry) =>
        entry.id ===
        selectedEntryId,
    ) ?? null

  const selectedFullyProtected =
    selectedEntry
      ? fullyProtectedEntryIds.has(
          selectedEntry.id,
        )
      : false

  const selectedValidation =
    selectedEntry
      ? validateProtectedTokens(
          selectedEntry.source,
          selectedEntry.translation,
          tokenProfile,
        )
      : null

  const currentDocument:
    ParsedLocalizationDocument | null =
      documentInfo
        ? {
            ...documentInfo,
            entries,
          }
        : null

  const documentDescription =
    currentDocument
      ? describeParsedDocument(
          currentDocument,
        )
      : ''

  const normalizedSearch =
    searchQuery
      .trim()
      .toLowerCase()

  const filteredEntries =
    entries.filter(
      (entry) => {
        const isProtected =
          fullyProtectedEntryIds.has(
            entry.id,
          )

        const isTranslated =
          !isProtected &&
          entry.translation.trim() !== ''

        const context =
          entry.context ?? ''

        const notes =
          entry.notes ?? ''

        const matchesSearch =
          !normalizedSearch ||
          entry.key
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          entry.source
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          entry.translation
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          context
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          notes
            .toLowerCase()
            .includes(
              normalizedSearch,
            )

        const matchesFilter =
          entryFilter ===
            'all' ||
          (
            entryFilter ===
              'translated' &&
            isTranslated
          ) ||
          (
            entryFilter ===
              'untranslated' &&
            !isProtected &&
            !isTranslated
          )

        return (
          matchesSearch &&
          matchesFilter
        )
      },
    )

  async function handleOpenFile() {
    const selected =
      await open({
        multiple: false,
        directory: false,

        filters: [
          {
            name: 'JSON',
            extensions: [
              'json',
            ],
          },
        ],
      })

    if (!selected) {
      return
    }

    try {
      const content =
        await readTextFile(
          selected,
        )

      const normalizedPath =
        selected.replace(
          /\\/g,
          '/',
        )

      const name =
        normalizedPath
          .split('/')
          .pop() ??
        selected

      const result =
        parseLocalizationFile(
          content,
          name,
        )

      if (!result.ok) {
        alert(
          result.reason,
        )

        return
      }

      const document =
        result.document

      if (
        document.entries.length === 0
      ) {
        alert(
          'لم يتم العثور على نصوص قابلة للترجمة.',
        )

        return
      }

      setEntries(
        document.entries,
      )

      setDocumentInfo({
        parser:
          document.parser,

        format:
          document.format,

        sourceText:
          document.sourceText,

        schema:
          document.schema,
      })

      setFileName(
        name,
      )

      setSelectedEntryId(
        document.entries[0].id,
      )

      setSearchQuery('')
      setEntryFilter('all')

      /*
       * الملفات الجديدة تبدأ على
       * Generic، وبعدها المستخدم
       * يختار المحرك المناسب.
       */
      setTokenProfile(
        'generic',
      )
    } catch (error) {
      console.error(
        error,
      )

      alert(
        'حدث خطأ أثناء فتح الملف.',
      )
    }
  }

  async function handleSaveProject() {
    if (
      entries.length === 0 ||
      !documentInfo
    ) {
      return
    }

    const baseName =
      fileName.replace(
        /\.[^/.]+$/,
        '',
      ) ||
      'localization-project'

    const selectedPath =
      await save({
        defaultPath:
          `${baseName}.lhproj`,

        filters: [
          {
            name:
              'LocalizationHub Project',

            extensions: [
              'lhproj',
            ],
          },
        ],
      })

    if (!selectedPath) {
      return
    }

    const project:
      LocalizationProjectV2 = {
        format:
          'LocalizationHubProject',

        version: 2,

        sourceFileName:
          fileName,

        selectedEntryId,

        tokenProfile,

        document:
          documentInfo,

        entries,
      }

    try {
      const projectContent =
        JSON.stringify(
          project,
          null,
          2,
        )

      await writeTextFile(
        selectedPath,
        projectContent,
      )

      alert(
        'تم حفظ المشروع بنجاح.',
      )
    } catch (error) {
      console.error(
        error,
      )

      alert(
        'فشل حفظ المشروع.',
      )
    }
  }

  async function handleExportFile() {
    if (!currentDocument) {
      return
    }

    /*
     * حماية إضافية:
     *
     * لو كان هناك entry محمي بالكامل
     * لكنه يحتوي Translation قديمة،
     * لا نصدر الملف حتى يتم تنظيفها.
     *
     * لا نحذف بيانات المستخدم بصمت.
     */
    const protectedWithTranslation =
      entries.filter(
        (entry) =>
          fullyProtectedEntryIds.has(
            entry.id,
          ) &&
          entry.translation.trim() !== '',
      )

    if (
      protectedWithTranslation.length >
      0
    ) {
      alert(
        `Export blocked: ${protectedWithTranslation.length.toLocaleString()} protected entries contain translation text. Clear them before export.`,
      )

      return
    }

    const baseName =
      fileName.replace(
        /\.[^/.]+$/,
        '',
      ) ||
      'localization'

    const selectedPath =
      await save({
        defaultPath:
          `${baseName}_translated.json`,

        filters: [
          {
            name: 'JSON',
            extensions: [
              'json',
            ],
          },
        ],
      })

    if (!selectedPath) {
      return
    }

    try {
      const output =
        exportLocalizationDocument(
          currentDocument,
        )

      await writeTextFile(
        selectedPath,
        output,
      )

      alert(
        'تم تصدير ملف JSON بنجاح.',
      )
    } catch (error) {
      console.error(
        error,
      )

      alert(
        'فشل تصدير الملف. قد يكون المشروع قديمًا ولا يحتوي على بيانات المصدر الأصلية.',
      )
    }
  }

  async function handleOpenProject() {
    const selected =
      await open({
        multiple: false,
        directory: false,

        filters: [
          {
            name:
              'LocalizationHub Project',

            extensions: [
              'lhproj',
            ],
          },
        ],
      })

    if (!selected) {
      return
    }

    try {
      const content =
        await readTextFile(
          selected,
        )

      const parsed:
        | LocalizationProjectV1
        | LocalizationProjectV2 =
          JSON.parse(
            content,
          )

      if (
        parsed.format !==
        'LocalizationHubProject'
      ) {
        alert(
          'ملف المشروع غير صالح.',
        )

        return
      }

      if (
        !Array.isArray(
          parsed.entries,
        ) ||
        parsed.entries.length === 0
      ) {
        alert(
          'المشروع لا يحتوي على نصوص.',
        )

        return
      }

      if (
        parsed.version === 2
      ) {
        const project =
          parsed as
            LocalizationProjectV2

        setEntries(
          project.entries,
        )

        setFileName(
          project.sourceFileName,
        )

        setDocumentInfo(
          project.document,
        )

        const selectedExists =
          project.selectedEntryId &&
          project.entries.some(
            (entry) =>
              entry.id ===
              project.selectedEntryId,
          )

        setSelectedEntryId(
          selectedExists
            ? project.selectedEntryId
            : project.entries[0].id,
        )

        setTokenProfile(
          project.tokenProfile ??
            'generic',
        )

        setSearchQuery('')
        setEntryFilter('all')

        return
      }

      if (
        parsed.version === 1
      ) {
        const legacy =
          parsed as
            LocalizationProjectV1

        const migratedEntries:
          TranslationEntry[] =
            legacy.entries.map(
              (
                entry,
                index,
              ) => ({
                id:
                  `legacy:${index}:${entry.key}`,

                key:
                  entry.key,

                source:
                  entry.source,

                translation:
                  entry.translation,

                keyPath: [
                  entry.key,
                ],

                sourcePath: [
                  entry.key,
                ],
              }),
            )

        setEntries(
          migratedEntries,
        )

        setFileName(
          legacy.sourceFileName,
        )

        setDocumentInfo({
          parser:
            'json',

          format:
            'flat-json-object',

          sourceText:
            '',
        })

        const restored =
          migratedEntries.find(
            (entry) =>
              entry.key ===
              legacy.selectedKey,
          )

        setSelectedEntryId(
          restored?.id ??
            migratedEntries[0].id,
        )

        setTokenProfile(
          legacy.tokenProfile ??
            'generic',
        )

        setSearchQuery('')
        setEntryFilter('all')

        return
      }

      alert(
        'إصدار المشروع غير مدعوم.',
      )
    } catch (error) {
      console.error(
        error,
      )

      alert(
        'فشل فتح المشروع.',
      )
    }
  }

  function handleTranslationChange(
    id: string,
    value: string,
  ) {
    setEntries(
      (currentEntries) =>
        currentEntries.map(
          (entry) =>
            entry.id === id
              ? {
                  ...entry,

                  translation:
                    value,
                }
              : entry,
        ),
    )
  }

  if (
    entries.length === 0
  ) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <div className="brand-mark">
            LH
          </div>

          <h1>
            LocalizationHub
          </h1>

          <p>
            A collaborative workspace
            for game localization.
          </p>

          <div className="welcome-actions">
            <button
              className="primary-button"
              type="button"
              onClick={
                handleOpenFile
              }
            >
              Open File
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={
                handleOpenProject
              }
            >
              Open Project
            </button>

            <button
              className="secondary-button"
              type="button"
            >
              Join Project
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark small">
            LH
          </div>

          <div>
            <h1>
              LocalizationHub
            </h1>

            <span>
              {fileName}
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <TokenProfileSelect
            value={
              tokenProfile
            }
            onChange={
              setTokenProfile
            }
          />

          <div className="progress-info">
            <span>
              {
                translatedCount
                  .toLocaleString()
              }

              {' / '}

              {
                translatableCount
                  .toLocaleString()
              }
            </span>

            <strong>
              {progress}%
            </strong>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={
              handleSaveProject
            }
          >
            Save Project
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={
              handleExportFile
            }
          >
            Export JSON
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={
              handleOpenFile
            }
          >
            Open File
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="entries-summary">
              <strong>
                Entries
              </strong>

              <span>
                {
                  filteredEntries
                    .length
                    .toLocaleString()
                }

                {' / '}

                {
                  entries.length
                    .toLocaleString()
                }
              </span>
            </div>

            <input
              className="search-input"
              type="text"
              value={
                searchQuery
              }
              onChange={
                (event) =>
                  setSearchQuery(
                    event.target.value,
                  )
              }
              placeholder="Search keys or text..."
            />

            <div className="filter-tabs">
              <button
                type="button"
                className={
                  entryFilter ===
                  'all'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() =>
                  setEntryFilter(
                    'all',
                  )
                }
              >
                All

                <span>
                  {
                    entries.length
                  }
                </span>
              </button>

              <button
                type="button"
                className={
                  entryFilter ===
                  'untranslated'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() =>
                  setEntryFilter(
                    'untranslated',
                  )
                }
              >
                Untranslated

                <span>
                  {
                    untranslatedCount
                  }
                </span>
              </button>

              <button
                type="button"
                className={
                  entryFilter ===
                  'translated'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() =>
                  setEntryFilter(
                    'translated',
                  )
                }
              >
                Translated

                <span>
                  {
                    translatedCount
                  }
                </span>
              </button>
            </div>

            {
              protectedCount > 0 && (
                <div className="entries-summary">
                  <span>
                    Protected
                  </span>

                  <span>
                    {
                      protectedCount
                        .toLocaleString()
                    }
                  </span>
                </div>
              )
            }
          </div>

          <div className="entry-list">
            {
              filteredEntries.length > 0
                ? filteredEntries.map(
                    (entry) => {
                      const isProtected =
                        fullyProtectedEntryIds.has(
                          entry.id,
                        )

                      const isTranslated =
                        !isProtected &&
                        entry.translation
                          .trim() !== ''

                      const validation =
                        isProtected
                          ? null
                          : validateProtectedTokens(
                              entry.source,
                              entry.translation,
                              tokenProfile,
                            )

                      const hasTokenError =
                        isTranslated &&
                        Boolean(
                          validation
                            ?.hasErrors,
                        )

                      const hasTokenWarning =
                        isTranslated &&
                        !hasTokenError &&
                        Boolean(
                          validation
                            ?.hasWarnings,
                        )

                      const isSelected =
                        entry.id ===
                        selectedEntryId

                      let statusClass = ''

                      if (isProtected) {
                        statusClass =
                          'protected'
                      } else if (
                        hasTokenError
                      ) {
                        statusClass =
                          'token-warning'
                      } else if (
                        hasTokenWarning
                      ) {
                        statusClass =
                          'token-warning'
                      } else if (
                        isTranslated
                      ) {
                        statusClass =
                          'translated'
                      }

                      const entryTitle =
                        entry.context
                          ? `${entry.context} · ${entry.key}`
                          : entry.key

                      return (
                        <button
                          type="button"
                          key={
                            entry.id
                          }
                          className={
                            `entry-item ${
                              isSelected
                                ? 'selected'
                                : ''
                            }`
                          }
                          title={
                            isProtected
                              ? `Protected · ${entryTitle}`
                              : entryTitle
                          }
                          onClick={() =>
                            setSelectedEntryId(
                              entry.id,
                            )
                          }
                        >
                          <span
                            className={
                              `status-dot ${statusClass}`
                            }
                          />

                          <span className="entry-key">
                            {
                              entry.key
                            }
                          </span>
                        </button>
                      )
                    },
                  )
                : (
                  <div className="empty-search">
                    No matching entries.
                  </div>
                )
            }
          </div>
        </aside>

        <section className="editor-panel">
          {
            selectedEntry &&
            selectedValidation && (
              <>
                <div className="editor-header">
                  <span className="editor-label">
                    {
                      selectedEntry
                        .context
                        ? `Key · ${selectedEntry.context}`
                        : 'Key'
                    }
                  </span>

                  <h2>
                    {
                      selectedEntry
                        .key
                    }
                  </h2>

                  {
                    documentDescription && (
                      <span className="editor-label">
                        {
                          documentDescription
                        }
                      </span>
                    )
                  }
                </div>

                <div className="editor-section">
                  <label>
                    Source
                  </label>

                  <div
                    className="source-text"
                    dir="auto"
                  >
                    {
                      selectedEntry
                        .source
                    }
                  </div>
                </div>

                {
                  selectedValidation
                    .sourceTokens
                    .length > 0 && (
                    <div className="token-panel">
                      <div className="token-panel-header">
                        <strong>
                          Protected Tokens
                        </strong>

                        <span>
                          {
                            selectedValidation
                              .sourceTokens
                              .length
                          }
                        </span>
                      </div>

                      <div className="token-list">
                        {
                          selectedValidation
                            .sourceTokens
                            .map(
                              (
                                token,
                                index,
                              ) => {
                                /*
                                 * Fully protected entry طبيعي
                                 * تكون ترجمتها فاضية.
                                 *
                                 * لذلك لا نصبغ Tokens فيها
                                 * كـMissing.
                                 */
                                const isMissing =
                                  !selectedFullyProtected &&
                                  selectedValidation
                                    .missingTokens
                                    .some(
                                      (
                                        missing,
                                      ) =>
                                        missing.raw ===
                                        token.raw,
                                    )

                                return (
                                  <code
                                    key={
                                      `${token.start}-${token.raw}-${index}`
                                    }
                                    className={
                                      isMissing
                                        ? 'token-chip missing'
                                        : 'token-chip'
                                    }
                                  >
                                    {
                                      token.raw
                                    }
                                  </code>
                                )
                              },
                            )
                        }
                      </div>
                    </div>
                  )
                }

                {
                  selectedEntry.notes &&
                  selectedEntry.notes
                    .trim() !== '' && (
                    <div className="editor-section">
                      <label>
                        Notes
                      </label>

                      <div
                        className="source-text"
                        dir="auto"
                      >
                        {
                          selectedEntry
                            .notes
                        }
                      </div>
                    </div>
                  )
                }

                {
                  selectedFullyProtected
                    ? (
                      <div className="editor-section translation-section">
                        <label>
                          Translation
                        </label>

                        <div className="token-panel">
                          <div className="token-panel-header">
                            <strong>
                              Protected — Not translatable
                            </strong>

                            <span>
                              ENGINE
                            </span>
                          </div>

                          <p>
                            This entry is fully protected and must remain exactly as it appears in the source.
                          </p>

                          {
                            selectedEntry
                              .translation
                              .trim() !== '' && (
                              <div className="token-warning-box">
                                <strong>
                                  Protected entry contains translation text
                                </strong>

                                <p>
                                  This translation will not be exported until it is cleared.
                                </p>

                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() =>
                                    handleTranslationChange(
                                      selectedEntry.id,
                                      '',
                                    )
                                  }
                                >
                                  Clear Translation
                                </button>
                              </div>
                            )
                          }
                        </div>
                      </div>
                    )
                    : (
                      <div className="editor-section translation-section">
                        <label htmlFor="translation">
                          Translation
                        </label>

                        <textarea
                          id="translation"
                          dir="auto"
                          value={
                            selectedEntry
                              .translation
                          }
                          onChange={
                            (event) =>
                              handleTranslationChange(
                                selectedEntry.id,
                                event.target.value,
                              )
                          }
                          placeholder="Enter translation..."
                        />
                      </div>
                    )
                }

                {
                  !selectedFullyProtected &&
                  selectedEntry
                    .translation
                    .trim() !== '' &&
                  (
                    selectedValidation
                      .hasErrors ||
                    selectedValidation
                      .hasWarnings
                  ) && (
                    <div className="token-warning-box">
                      <strong>
                        {
                          selectedValidation
                            .hasErrors
                            ? 'Protected token error'
                            : 'Protected token warning'
                        }
                      </strong>

                      {
                        selectedValidation
                          .missingTokens
                          .length > 0 && (
                          <div className="token-warning-section">
                            <span>
                              Missing
                            </span>

                            <div>
                              {
                                selectedValidation
                                  .missingTokens
                                  .map(
                                    (
                                      token,
                                      index,
                                    ) => (
                                      <code
                                        key={
                                          `missing-${token.start}-${index}`
                                        }
                                      >
                                        {
                                          token.raw
                                        }
                                      </code>
                                    ),
                                  )
                              }
                            </div>
                          </div>
                        )
                      }

                      {
                        selectedValidation
                          .extraTokens
                          .length > 0 && (
                          <div className="token-warning-section">
                            <span>
                              Extra
                            </span>

                            <div>
                              {
                                selectedValidation
                                  .extraTokens
                                  .map(
                                    (
                                      token,
                                      index,
                                    ) => (
                                      <code
                                        key={
                                          `extra-${token.start}-${index}`
                                        }
                                      >
                                        {
                                          token.raw
                                        }
                                      </code>
                                    ),
                                  )
                              }
                            </div>
                          </div>
                        )
                      }

                      {
                        selectedValidation
                          .placementIssues
                          .length > 0 && (
                          <div className="token-warning-section">
                            <span>
                              Warning
                            </span>

                            <div>
                              {
                                selectedValidation
                                  .placementIssues
                                  .map(
                                    (
                                      issue,
                                      index,
                                    ) => (
                                      <p
                                        key={
                                          `placement-${issue.kind}-${index}`
                                        }
                                      >
                                        {
                                          issue.message
                                        }
                                      </p>
                                    ),
                                  )
                              }
                            </div>
                          </div>
                        )
                      }

                      {
                        selectedValidation
                          .structureIssues
                          .length > 0 && (
                          <div className="token-warning-section">
                            <span>
                              Error
                            </span>

                            <div>
                              {
                                selectedValidation
                                  .structureIssues
                                  .map(
                                    (
                                      issue,
                                      index,
                                    ) => (
                                      <p
                                        key={
                                          `structure-${issue.kind}-${index}`
                                        }
                                      >
                                        {
                                          issue.message
                                        }
                                      </p>
                                    ),
                                  )
                              }
                            </div>
                          </div>
                        )
                      }
                    </div>
                  )
                }

                <footer className="editor-footer">
                  <span>
                    {
                      selectedFullyProtected
                        ? 'Protected · Not translatable'
                        : selectedEntry
                            .translation
                            .trim() === ''
                          ? 'Not translated'
                          : selectedValidation
                              .hasErrors
                            ? 'Token error'
                            : selectedValidation
                                .hasWarnings
                              ? 'Translated with warnings'
                              : 'Translated'
                    }
                  </span>

                  <span>
                    {
                      selectedFullyProtected
                        ? 'Excluded from progress'
                        : `${selectedEntry.translation.length} characters`
                    }
                  </span>
                </footer>
              </>
            )
          }
        </section>
      </div>
    </main>
  )
}

export default App