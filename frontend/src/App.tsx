import { useState } from 'react'

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
  describeParsedDocument,
  parseLocalizationFile,
  type LocalizationFileFormat,
  type ParsedLocalizationDocument,
  type ParsedLocalizationEntry,
  type RecordArraySchema,
} from './parsers'

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
  const [entries, setEntries] =
    useState<TranslationEntry[]>([])

  const [fileName, setFileName] =
    useState('')

  const [
    selectedEntryId,
    setSelectedEntryId,
  ] = useState<string | null>(null)

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
  ] = useState('')

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

  const translatedCount =
    entries.filter(
      (entry) =>
        entry.translation.trim() !== '',
    ).length

  const untranslatedCount =
    entries.length - translatedCount

  const progress =
    entries.length === 0
      ? 0
      : Math.round(
          (
            translatedCount /
            entries.length
          ) * 100,
        )

  const selectedEntry =
    entries.find(
      (entry) =>
        entry.id === selectedEntryId,
    ) ?? null

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
    entries.filter((entry) => {
      const isTranslated =
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
        entryFilter === 'all' ||
        (
          entryFilter ===
            'translated' &&
          isTranslated
        ) ||
        (
          entryFilter ===
            'untranslated' &&
          !isTranslated
        )

      return (
        matchesSearch &&
        matchesFilter
      )
    })

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
        alert(result.reason)
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

      setFileName(name)

      setSelectedEntryId(
        document.entries[0].id,
      )

      setSearchQuery('')
      setEntryFilter('all')
      setTokenProfile(
        'generic',
      )
    } catch (error) {
      console.error(error)

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
      console.error(error)

      alert(
        'فشل حفظ المشروع.',
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
          JSON.parse(content)

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

      /*
       * Project V2
       */
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

      /*
       * Legacy Project V1
       *
       * نخليه يفتح المشاريع القديمة
       * بدل ما نكسرها بعد تحديث البرنامج.
       */
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
          parser: 'json',

          format:
            'flat-json-object',

          /*
           * مشاريع V1 القديمة لم تكن
           * تحفظ النص الأصلي.
           */
          sourceText: '',
        })

        const oldSelected =
          legacy.selectedKey

        const restored =
          migratedEntries.find(
            (entry) =>
              entry.key ===
              oldSelected,
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
      console.error(error)

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
          <div className="progress-info">
            <span>
              {
                translatedCount
                  .toLocaleString()
              }
              {' / '}
              {
                entries.length
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
                    event.target
                      .value,
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
          </div>

          <div className="entry-list">
            {
              filteredEntries
                .length > 0
                ? filteredEntries.map(
                    (entry) => {
                      const isTranslated =
                        entry.translation
                          .trim() !== ''

                      const validation =
                        validateProtectedTokens(
                          entry.source,
                          entry.translation,
                          tokenProfile,
                        )

                      const hasTokenProblem =
                        isTranslated &&
                        !validation
                          .isValid

                      const isSelected =
                        entry.id ===
                        selectedEntryId

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
                            entry.context
                              ? `${entry.context} · ${entry.key}`
                              : entry.key
                          }
                          onClick={() =>
                            setSelectedEntryId(
                              entry.id,
                            )
                          }
                        >
                          <span
                            className={
                              `status-dot ${
                                hasTokenProblem
                                  ? 'token-warning'
                                  : isTranslated
                                    ? 'translated'
                                    : ''
                              }`
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
                                const isMissing =
                                  selectedValidation
                                    .missingTokens
                                    .some(
                                      (
                                        missing,
                                      ) =>
                                        missing
                                          .raw ===
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

                      <div className="source-text">
                        {
                          selectedEntry
                            .notes
                        }
                      </div>
                    </div>
                  )
                }

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
                          event.target
                            .value,
                        )
                    }
                    placeholder="Enter translation..."
                  />
                </div>

                {
                  selectedEntry
                    .translation
                    .trim() !== '' &&
                  (
                    selectedValidation
                      .missingTokens
                      .length > 0 ||
                    selectedValidation
                      .extraTokens
                      .length > 0
                  ) && (
                    <div className="token-warning-box">
                      <strong>
                        Protected token warning
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
                                          `missing-${token.raw}-${index}`
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
                                          `extra-${token.raw}-${index}`
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
                    </div>
                  )
                }

                <footer className="editor-footer">
                  <span>
                    {
                      selectedEntry
                        .translation
                        .trim() === ''
                        ? 'Not translated'
                        : selectedValidation
                            .isValid
                          ? 'Translated'
                          : 'Token warning'
                    }
                  </span>

                  <span>
                    {
                      selectedEntry
                        .translation
                        .length
                    }{' '}
                    characters
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