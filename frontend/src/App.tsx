import {
  useCallback,
  useState,
} from 'react'

import {
  confirm,
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
  type ParsedLocalizationDocument,
  type ParsedLocalizationEntry,
} from './parsers'

import {
  exportLocalizationDocument,
} from './exporters'

import {
  analyzeExportValidation,
} from './exportValidation'

import {
  useProtectedEntryIds,
} from './useProtectedEntryIds'

import {
  useReviewEntryIds,
} from './useReviewEntryIds'

import {
  useEntryCollections,
  type EntryFilter,
} from './useEntryCollections'

import {
  writeLocalizationProject,
  type LocalizationProjectV2,
  type StoredDocumentInfo,
} from './projectFiles'

import {
  chooseProjectSavePath,
} from './projectSaveDialog'

import {
  confirmUnsavedChanges,
} from './confirmUnsavedChanges'

import {
  useUnsavedCloseGuard,
} from './useUnsavedCloseGuard'

import {
  useSaveAsShortcut,
} from './useSaveAsShortcut'



import {
  useFileDrop,
} from './useFileDrop'

import {
  useWorkspaceShortcuts,
} from './useWorkspaceShortcuts'
import {
  clearRecentProjects,
  getRecentProjects,
  rememberRecentProject,
  removeRecentProject,
  type RecentProject,
} from './recentProjects'

import {
  clearLastSession,
  getLastSession,
  rememberLastSession,
} from './lastSession'

import TokenProfileSelect from './TokenProfileSelect'
import TranslationEditor from './TranslationEditor'
import EntryListItem from './EntryListItem'
import DedwriteMark from './DedwriteMark'
import RecentProjects from './RecentProjectsPanel'
import WelcomeDropZone from './WelcomeDropZone'
import LastSessionCard from './LastSessionCard'
import MachineTranslationPanel from './MachineTranslationPanel'

import Toast, {
  type ToastMessage,
  type ToastType,
} from './Toast'

import './App.css'

type TranslationEntry =
  ParsedLocalizationEntry

type LegacyTranslationEntry = {
  key:
    string

  source:
    string

  translation:
    string
}

type LocalizationProjectV1 = {
  format:
    'LocalizationHubProject'

  version:
    1

  sourceFileName:
    string

  selectedKey:
    string | null

  tokenProfile?:
    TokenProfileId

  entries:
    LegacyTranslationEntry[]
}

function App() {
  const [
    lastSession,
    setLastSession,
  ] =
    useState(
      () =>
        getLastSession(),
    )

  const [
    entries,
    setEntries,
  ] =
    useState<TranslationEntry[]>(
      [],
    )

  const [
    fileName,
    setFileName,
  ] =
    useState('')

  const [
    projectPath,
    setProjectPath,
  ] =
    useState<string | null>(
      null,
    )

  const [
    isDirty,
    setIsDirty,
  ] =
    useState(false)

  const [
    selectedEntryId,
    setSelectedEntryId,
  ] =
    useState<string | null>(
      null,
    )

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
    useState<EntryFilter>(
      'all',
    )

  const [
    tokenProfile,
    setTokenProfile,
  ] =
    useState<TokenProfileId>(
      'generic',
    )

  const [
    recentProjects,
    setRecentProjects,
  ] =
    useState<RecentProject[]>(
      () =>
        getRecentProjects(),
    )

  const [
    toast,
    setToast,
  ] =
    useState<ToastMessage | null>(
      null,
    )

  useUnsavedCloseGuard(
    isDirty,
  )

  const dismissToast =
    useCallback(
      () => {
        setToast(
          null,
        )
      },
      [],
    )

  const showToast =
    useCallback(
      (
        type:
          ToastType,

        message:
          string,
      ) => {
        setToast({
          id:
            Date.now(),

          type,

          message,
        })
      },
      [],
    )

  const fullyProtectedEntryIds =
    useProtectedEntryIds(
      entries,
      tokenProfile,
    )

  const {
    errorEntryIds,
    warningEntryIds,
    needsReviewEntryIds,
  } =
    useReviewEntryIds(
      entries,
      fullyProtectedEntryIds,
      tokenProfile,
    )

  const {
    translatedCount,
    errorCount,
    warningCount,
    needsReviewCount,
    filteredEntries,
    navigableEntries,
  } =
    useEntryCollections({
      entries,
      fullyProtectedEntryIds,
      errorEntryIds,
      warningEntryIds,
      needsReviewEntryIds,
      searchQuery,
      entryFilter,
    })

  const protectedCount =
    fullyProtectedEntryIds.size

  const translatableCount =
    entries.length -
    protectedCount

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

  const sourceDirection =
    documentInfo
      ?.language
      ?.sourceDirection ??
    'auto'

  const translationDirection =
    documentInfo
      ?.language
      ?.translationDirection ??
    'auto'

  const sourceLocale =
    documentInfo
      ?.language
      ?.sourceLocale

  const translationLocale =
    documentInfo
      ?.language
      ?.translationLocale

  const translationPlaceholder =
    translationLocale
      ?.toLowerCase()
      .startsWith(
        'ar',
      )
      ? 'أدخل الترجمة...'
      : 'Enter translation...'

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

  function selectRelativeEntry(
    offset: number,
  ) {
    if (
      navigableEntries.length ===
      0
    ) {
      return
    }

    const currentIndex =
      navigableEntries.findIndex(
        (entry) =>
          entry.id ===
          selectedEntryId,
      )

    if (
      currentIndex === -1
    ) {
      const fallbackEntry =
        offset >= 0
          ? navigableEntries[0]
          : navigableEntries[
              navigableEntries.length -
                1
            ]

      setSelectedEntryId(
        fallbackEntry.id,
      )

      return
    }

    const nextIndex =
      (
        currentIndex +
        offset +
        navigableEntries.length
      ) %
      navigableEntries.length

    setSelectedEntryId(
      navigableEntries[
        nextIndex
      ].id,
    )
  }

  function selectRelativeUntranslated(
    direction: 1 | -1,
  ) {
    if (
      navigableEntries.length ===
      0
    ) {
      return
    }

    const currentIndex =
      navigableEntries.findIndex(
        (entry) =>
          entry.id ===
          selectedEntryId,
      )

    const startIndex =
      currentIndex === -1
        ? (
            direction === 1
              ? -1
              : 0
          )
        : currentIndex

    for (
      let step = 1;
      step <=
        navigableEntries.length;
      step += 1
    ) {
      const index =
        (
          startIndex +
          (
            step *
            direction
          ) +
          navigableEntries.length *
            2
        ) %
        navigableEntries.length

      const candidate =
        navigableEntries[
          index
        ]

      if (
        candidate.id ===
        selectedEntryId
      ) {
        continue
      }

      if (
        candidate.translation
          .trim() === ''
      ) {
        setSelectedEntryId(
          candidate.id,
        )

        return
      }
    }

    showToast(
      'info',
      'لا توجد Entries أخرى غير مترجمة.',
    )
  }

  function handleNextEntry() {
    selectRelativeEntry(
      1,
    )
  }

  function handlePreviousEntry() {
    selectRelativeEntry(
      -1,
    )
  }

  function handleNextUntranslated() {
    selectRelativeUntranslated(
      1,
    )
  }

  function handlePreviousUntranslated() {
    selectRelativeUntranslated(
      -1,
    )
  }

  function handleTokenProfileChange(
    nextProfile:
      TokenProfileId,
  ) {
    if (
      nextProfile ===
      tokenProfile
    ) {
      return
    }

    setTokenProfile(
      nextProfile,
    )

    setIsDirty(
      true,
    )
  }

  function forgetSession() {
    clearLastSession()

    setLastSession(
      null,
    )
  }

  function rememberProject(
    path: string,
    sourceFileName: string,
  ) {
    setRecentProjects(
      rememberRecentProject(
        path,
        sourceFileName,
      ),
    )

    setLastSession(
      rememberLastSession(
        path,
        sourceFileName,
      ),
    )
  }

  function handleRemoveRecentProject(
    project:
      RecentProject,
  ) {
    setRecentProjects(
      removeRecentProject(
        project.path,
      ),
    )
  }

  function handleClearRecentProjects() {
    clearRecentProjects()

    setRecentProjects(
      [],
    )
  }

  async function handleGoHome() {
    const canContinue =
      await confirmUnsavedChanges(
        isDirty,
      )

    if (
      !canContinue
    ) {
      return
    }

    forgetSession()

    setEntries(
      [],
    )

    setFileName(
      '',
    )

    setProjectPath(
      null,
    )

    setSelectedEntryId(
      null,
    )

    setDocumentInfo(
      null,
    )

    setSearchQuery(
      '',
    )

    setEntryFilter(
      'all',
    )

    setTokenProfile(
      'generic',
    )

    setIsDirty(
      false,
    )

    setToast(
      null,
    )
  }

  async function handleOpenFile() {
    const canContinue =
      await confirmUnsavedChanges(
        isDirty,
      )

    if (
      !canContinue
    ) {
      return
    }

    const selected =
      await open({
        multiple:
          false,

        directory:
          false,

        filters: [
          {
            name:
              'JSON',

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

      if (
        !result.ok
      ) {
        showToast(
          'error',
          result.reason,
        )

        return
      }

      const document =
        result.document

      if (
        document.entries
          .length === 0
      ) {
        showToast(
          'warning',
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

        language:
          document.language,
      })

      setFileName(
        name,
      )

      setProjectPath(
        null,
      )

      forgetSession()

      setSelectedEntryId(
        document.entries[0].id,
      )

      setSearchQuery('')

      setEntryFilter(
        'all',
      )

      setTokenProfile(
        'generic',
      )

      setIsDirty(
        false,
      )

      showToast(
        'success',
        `تم فتح ${name} بنجاح.`,
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'حدث خطأ أثناء فتح الملف.',
      )
    }
  }

  function createCurrentProject():
    LocalizationProjectV2 | null {
    if (
      entries.length === 0 ||
      !documentInfo
    ) {
      return null
    }

    return {
      format:
        'LocalizationHubProject',

      version:
        2,

      sourceFileName:
        fileName,

      selectedEntryId,

      tokenProfile,

      document:
        documentInfo,

      entries,
    }
  }

  async function handleSaveProjectAs() {
    const project =
      createCurrentProject()

    if (!project) {
      showToast(
        'warning',
        'لا يوجد مشروع لحفظه.',
      )

      return
    }

    const selectedPath =
      await chooseProjectSavePath(
        fileName,
      )

    if (
      !selectedPath
    ) {
      return
    }

    try {
      await writeLocalizationProject(
        selectedPath,
        project,
      )

      setProjectPath(
        selectedPath,
      )

      setIsDirty(
        false,
      )

      rememberProject(
        selectedPath,
        project.sourceFileName,
      )

      showToast(
        'success',
        'تم حفظ نسخة المشروع بنجاح.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'فشل حفظ نسخة المشروع.',
      )
    }
  }

  useSaveAsShortcut(
    handleSaveProjectAs,
  )

  async function handleSaveProject() {
    const project =
      createCurrentProject()

    if (!project) {
      showToast(
        'warning',
        'لا يوجد مشروع لحفظه.',
      )

      return
    }

    if (
      !projectPath
    ) {
      await handleSaveProjectAs()

      return
    }

    try {
      await writeLocalizationProject(
        projectPath,
        project,
      )

      setIsDirty(
        false,
      )

      showToast(
        'success',
        'تم حفظ المشروع.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'فشل حفظ المشروع.',
      )
    }
  }

  async function loadProjectFromPath(
    selected:
      string,

    openedFromRecent =
      false,
  ) {
    let content:
      string

    try {
      content =
        await readTextFile(
          selected,
        )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      if (
        lastSession?.projectPath ===
        selected
      ) {
        forgetSession()
      }


      if (
        openedFromRecent
      ) {
        setRecentProjects(
          removeRecentProject(
            selected,
          ),
        )

        showToast(
          'warning',
          'تعذر العثور على المشروع. تمت إزالته من Recent Projects.',
        )
      } else {
        showToast(
          'error',
          'فشل قراءة ملف المشروع.',
        )
      }

      return
    }

    try {
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
        showToast(
          'error',
          'ملف المشروع غير صالح.',
        )

        return
      }

      if (
        !Array.isArray(
          parsed.entries,
        ) ||
        parsed.entries
          .length === 0
      ) {
        showToast(
          'warning',
          'المشروع لا يحتوي على نصوص.',
        )

        return
      }

      if (
        parsed.version ===
        2
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

        setProjectPath(
          selected,
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

        setEntryFilter(
          'all',
        )

        setIsDirty(
          false,
        )

        rememberProject(
          selected,
          project.sourceFileName,
        )

        showToast(
          'success',
          'تم فتح المشروع بنجاح.',
        )

        return
      }

      if (
        parsed.version ===
        1
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

          language: {
            sourceDirection:
              'auto',

            translationDirection:
              'auto',
          },
        })

        /*
         * Legacy v1 لا نربطه مباشرة
         * بالمسار للحفظ.
         *
         * أول Save سيطلب Save As
         * ويحوله عمليًا إلى v2.
         */
        setProjectPath(
          null,
        )

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

        setEntryFilter(
          'all',
        )

        setIsDirty(
          false,
        )

        rememberProject(
          selected,
          legacy.sourceFileName,
        )

        showToast(
          'info',
          'تم فتح المشروع القديم وترحيله للتنسيق الحالي.',
        )

        return
      }

      showToast(
        'error',
        'إصدار المشروع غير مدعوم.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'فشل فتح المشروع. قد يكون الملف تالفًا أو غير صالح.',
      )
    }
  }

  async function handleOpenProject() {
    const canContinue =
      await confirmUnsavedChanges(
        isDirty,
      )

    if (
      !canContinue
    ) {
      return
    }

    const selected =
      await open({
        multiple:
          false,

        directory:
          false,

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

    if (
      !selected
    ) {
      return
    }

    await loadProjectFromPath(
      selected,
    )
  }

  async function handleOpenRecentProject(
    project:
      RecentProject,
  ) {
    const canContinue =
      await confirmUnsavedChanges(
        isDirty,
      )

    if (
      !canContinue
    ) {
      return
    }

    await loadProjectFromPath(
      project.path,
      true,
    )
  }

  async function handleDroppedJsonFile(
    selected:
      string,
  ) {
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

      if (
        !result.ok
      ) {
        showToast(
          'error',
          result.reason,
        )

        return
      }

      const document =
        result.document

      if (
        document.entries
          .length === 0
      ) {
        showToast(
          'warning',
          '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0646\u0635\u0648\u0635 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u0631\u062c\u0645\u0629.',
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

        language:
          document.language,
      })

      setFileName(
        name,
      )

      setProjectPath(
        null,
      )

      forgetSession()

      setSelectedEntryId(
        document.entries[0].id,
      )

      setSearchQuery(
        '',
      )

      setEntryFilter(
        'all',
      )

      setTokenProfile(
        'generic',
      )

      setIsDirty(
        false,
      )

      showToast(
        'success',
        `\u062a\u0645 \u0641\u062a\u062d ${name} \u0628\u0646\u062c\u0627\u062d.`,
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        '\u062a\u0639\u0630\u0631 \u0641\u062a\u062d \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062d\u0648\u0628.',
      )
    }
  }

  async function handleDroppedProjectFile(
    path:
      string,
  ) {
    await loadProjectFromPath(
      path,
    )
  }

  function handleUnsupportedDroppedFile(
    path:
      string,
  ) {
    const normalizedPath =
      path.replace(
        /\\/g,
        '/',
      )

    const name =
      normalizedPath
        .split('/')
        .pop() ??
      path

    showToast(
      'warning',
      `Unsupported file: ${name}. Use .json or .lhproj.`,
    )
  }

  useWorkspaceShortcuts({
    onOpenFile:
      handleOpenFile,

    onOpenProject:
      handleOpenProject,

    onHome:
      handleGoHome,

    hasOpenWorkspace:
      entries.length > 0,
  })

  useFileDrop({
    enabled:
      entries.length === 0,

    onJsonFile:
      handleDroppedJsonFile,

    onProjectFile:
      handleDroppedProjectFile,

    onUnsupportedFile:
      handleUnsupportedDroppedFile,
  })

  async function handleExportFile() {
    if (
      !currentDocument
    ) {
      showToast(
        'warning',
        'لا يوجد ملف لتصديره.',
      )

      return
    }

    const protectedWithTranslation =
      entries.filter(
        (entry) =>
          fullyProtectedEntryIds.has(
            entry.id,
          ) &&
          entry.translation
            .trim() !== '',
      )

    if (
      protectedWithTranslation
        .length > 0
    ) {
      setSelectedEntryId(
        protectedWithTranslation[0].id,
      )

      showToast(
        'error',
        `Export blocked: ${protectedWithTranslation.length.toLocaleString()} protected entries contain translation text.`,
      )

      return
    }

    const exportValidation =
      analyzeExportValidation(
        entries,
        fullyProtectedEntryIds,
        tokenProfile,
      )

    if (
      exportValidation.errorCount >
      0
    ) {
      setSearchQuery('')

      setEntryFilter(
        'errors',
      )

      setSelectedEntryId(
        exportValidation
          .errorEntryIds[0],
      )

      showToast(
        'error',
        `Export blocked: ${exportValidation.errorCount.toLocaleString()} translated entries contain token errors.`,
      )

      return
    }

    if (
      exportValidation.warningCount >
      0
    ) {
      const continueExport =
        await confirm(
          `${exportValidation.warningCount.toLocaleString()} translated entries contain token warnings. You can continue exporting, but reviewing them first is recommended.`,
          {
            title:
              'Token Warnings',

            kind:
              'warning',

            okLabel:
              'Continue Export',

            cancelLabel:
              'Review First',
          },
        )

      if (
        !continueExport
      ) {
        setSearchQuery('')

        setEntryFilter(
          'warnings',
        )

        setSelectedEntryId(
          exportValidation
            .warningEntryIds[0],
        )

        showToast(
          'warning',
          'تم إلغاء التصدير لعرض التحذيرات.',
        )

        return
      }
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
            name:
              'JSON',

            extensions: [
              'json',
            ],
          },
        ],
      })

    if (
      !selectedPath
    ) {
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

      showToast(
        'success',
        'تم تصدير ملف JSON بنجاح.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'فشل تصدير الملف. قد يكون المشروع قديمًا ولا يحتوي على بيانات المصدر الأصلية.',
      )
    }
  }

  function handleTranslationChange(
    id: string,
    value: string,
  ) {
    const currentEntry =
      entries.find(
        (entry) =>
          entry.id === id,
      )

    if (
      !currentEntry ||
      currentEntry.translation ===
        value
    ) {
      return
    }

    setEntries(
      (
        currentEntries,
      ) =>
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

    setIsDirty(
      true,
    )
  }

  if (
    entries.length ===
    0
  ) {
    return (
      <>
        <main className="welcome-screen">
          <div className="welcome-card">
            <img
              className="welcome-logo"
              src="/images/logo-center.jpg"
              alt="LocalizationHub"
            />

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
                title="Open File ? Ctrl+O"
                onClick={
                  handleOpenFile
                }
              >
                Open File
              </button>

              <button
                className="secondary-button"
                type="button"
                title="Open Project ? Ctrl+Shift+O"
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

            <WelcomeDropZone />

            {
              lastSession && (
                <LastSessionCard
                  session={
                    lastSession
                  }

                  onResume={() => {
                    void loadProjectFromPath(
                      lastSession.projectPath,
                      true,
                    )
                  }}

                  onDismiss={
                    forgetSession
                  }
                />
              )
            }


            <RecentProjects
              projects={
                recentProjects
              }

              onOpen={
                handleOpenRecentProject
              }

              onRemove={
                handleRemoveRecentProject
              }

              onClear={
                handleClearRecentProjects
              }
            />

            <div
              style={{
                marginTop:
                  recentProjects.length >
                  0
                    ? '1.1rem'
                    : '1.35rem',
              }}
            >
              <DedwriteMark />
            </div>
          </div>
        </main>

        <Toast
          toast={
            toast
          }
          onClose={
            dismissToast
          }
        />
      </>
    )
  }

  return (
    <>
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <img
              className="brand-mark brand-mark-image small"
              src="/images/logo-center.jpg"
              alt="LocalizationHub"
            />

            <div>
              <h1>
                LocalizationHub
              </h1>

              <span>
                {fileName}

                {
                  isDirty
                    ? ' • Unsaved'
                    : ' • Saved'
                }
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                void handleGoHome()
              }}
              title="Home ? Ctrl+H"
            >
              Home
            </button>

            <TokenProfileSelect
              value={
                tokenProfile
              }
              onChange={
                handleTokenProfileChange
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
              title="Save Project · Ctrl+S"
            >
              Save Project
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={
                handleSaveProjectAs
              }
              title="Save As · Ctrl+Shift+S"
            >
              Save As
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
              title="Open File ? Ctrl+O"
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
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Search keys or text..."
              />

              <div
                className="filter-tabs"
                style={{
                  gridTemplateColumns:
                    'repeat(3, minmax(0, 1fr))',
                }}
              >
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
                        .toLocaleString()
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
                        .toLocaleString()
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
                        .toLocaleString()
                    }
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    entryFilter ===
                    'errors'
                      ? 'filter-button active'
                      : 'filter-button'
                  }
                  onClick={() =>
                    setEntryFilter(
                      'errors',
                    )
                  }
                  title="Token errors that block export"
                >
                  Errors

                  <span>
                    {
                      errorCount
                        .toLocaleString()
                    }
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    entryFilter ===
                    'warnings'
                      ? 'filter-button active'
                      : 'filter-button'
                  }
                  onClick={() =>
                    setEntryFilter(
                      'warnings',
                    )
                  }
                  title="Token warnings that should be reviewed"
                >
                  Warnings

                  <span>
                    {
                      warningCount
                        .toLocaleString()
                    }
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    entryFilter ===
                    'needs-review'
                      ? 'filter-button active'
                      : 'filter-button'
                  }
                  onClick={() =>
                    setEntryFilter(
                      'needs-review',
                    )
                  }
                  title="All translations that need review"
                >
                  Review

                  <span>
                    {
                      needsReviewCount
                        .toLocaleString()
                    }
                  </span>
                </button>
              </div>

              {
                protectedCount >
                  0 && (
                  <div className="entries-summary protected-summary">
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
                filteredEntries
                  .length > 0
                  ? filteredEntries.map(
                      (entry) => (
                        <EntryListItem
                          key={
                            entry.id
                          }

                          entry={
                            entry
                          }

                          isProtected={
                            fullyProtectedEntryIds.has(
                              entry.id,
                            )
                          }

                          hasError={
                            errorEntryIds.has(
                              entry.id,
                            )
                          }

                          hasWarning={
                            warningEntryIds.has(
                              entry.id,
                            )
                          }

                          isSelected={
                            entry.id ===
                            selectedEntryId
                          }

                          onSelect={
                            setSelectedEntryId
                          }
                        />
                      ),
                    )
                  : (
                    <div className="empty-search">
                      {
                        entryFilter ===
                        'errors'
                          ? 'No token errors.'
                          : entryFilter ===
                              'warnings'
                            ? 'No token warnings.'
                            : entryFilter ===
                                'needs-review'
                              ? 'No entries need review.'
                              : 'No matching entries.'
                      }
                    </div>
                  )
              }
            </div>

            <div
              style={{
                flexShrink:
                  0,

                padding:
                  '0.55rem 0.75rem',

                borderTop:
                  '1px solid rgba(255, 255, 255, 0.06)',

                textAlign:
                  'center',
              }}
            >
              <DedwriteMark
                compact
              />
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
                      dir={
                        sourceDirection
                      }
                      lang={
                        sourceLocale
                      }
                    >
                      {
                        selectedEntry
                          .source
                      }
                    </div>
                  </div>

                  <MachineTranslationPanel
                    sourceLocale={
                      sourceLocale
                    }

                    targetLocale={
                      translationLocale
                    }
                  />



                  {
                    selectedValidation
                      .sourceTokens
                      .length >
                      0 && (
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
                                .trim() !==
                                '' && (
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
                          <label>
                            Translation
                          </label>

                          <TranslationEditor
                            value={
                              selectedEntry
                                .translation
                            }

                            tokenProfile={
                              tokenProfile
                            }

                            direction={
                              translationDirection
                            }

                            locale={
                              translationLocale
                            }

                            placeholderText={
                              translationPlaceholder
                            }

                            onChange={
                              (
                                value,
                              ) =>
                                handleTranslationChange(
                                  selectedEntry.id,
                                  value,
                                )
                            }

                            onSave={() => {
                              void handleSaveProject()
                            }}

                            onNextUntranslated={
                              handleNextUntranslated
                            }

                            onPreviousUntranslated={
                              handlePreviousUntranslated
                            }

                            onNext={
                              handleNextEntry
                            }

                            onPrevious={
                              handlePreviousEntry
                            }
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
                            .length >
                            0 && (
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
                            .length >
                            0 && (
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
                            .length >
                            0 && (
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
                            .length >
                            0 && (
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
                    <div className="footer-nav-group previous">
                      <button
                        className="footer-nav-button"
                        type="button"
                        onClick={
                          handlePreviousUntranslated
                        }
                        disabled={
                          untranslatedCount ===
                          0
                        }
                        title="Previous untranslated · Ctrl+Shift+Enter"
                      >
                        <span aria-hidden="true">
                          ←
                        </span>

                        Previous Untranslated
                      </button>
                    </div>

                    <div className="editor-footer-status">
                      <strong>
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
                      </strong>

                      <span>
                        {
                          selectedFullyProtected
                            ? 'Excluded from progress'
                            : `${selectedEntry.translation.length} characters`
                        }
                      </span>

                      <span className="footer-remaining">
                        {
                          untranslatedCount
                            .toLocaleString()
                        }

                        {' remaining'}
                      </span>
                    </div>

                    <div className="footer-nav-group next">
                      <button
                        className="footer-nav-button primary"
                        type="button"
                        onClick={
                          handleNextUntranslated
                        }
                        disabled={
                          untranslatedCount ===
                          0
                        }
                        title="Next untranslated · Ctrl+Enter"
                      >
                        Next Untranslated

                        <span aria-hidden="true">
                          →
                        </span>
                      </button>
                    </div>
                  </footer>
                </>
              )
            }
          </section>
        </div>
      </main>

      <Toast
        toast={
          toast
        }
        onClose={
          dismissToast
        }
      />
    </>
  )
}

export default App

