import { parse as losslessParse } from 'lossless-json'
import { stringify as losslessStringify } from 'lossless-json'
import {
  useCallback,
  useEffect,
  useRef,
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
} from '@localizationhub/core'

import {
  describeParsedDocument,
  parseLocalizationFile,
  type ParsedLocalizationDocument,
  type ParsedLocalizationEntry,
} from '@localizationhub/core'

import {
  exportLocalizationDocument,
} from '@localizationhub/core'

import {
  analyzeExportValidation,
  ProjectStorageError,
} from '@localizationhub/core'

import type {
  CloudProjectSummary,
  LocalizationProjectV2,
  ProjectLocation,
  StoredDocumentInfo,
} from '@localizationhub/core'

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
  desktopProjectStorage,
} from './projectFiles'

import {
  cloudProjectStorage,
} from './cloudProjectStorage'

import {
  CloudProjectsApiError,
  createCloudProject,
  listCloudProjects,
} from './cloudProjectsApi'

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
import CollaborationPanel from './CollaborationPanel'
import WorkspaceCollaborationStatus from './WorkspaceCollaborationStatus'
import { useCollaborationSession, type CollaborationController } from './useCollaborationSession'
import LastSessionCard from './LastSessionCard'
import MachineTranslationPanel from './MachineTranslationPanel'

import Toast, {
  type ToastMessage,
  type ToastType,
} from './Toast'

import './App.css'

type TranslationEntry =
  ParsedLocalizationEntry

function App() {
  const [
    showCollaborationPanel,
    setShowCollaborationPanel,
  ] = useState(false)

  const collaborationRevisionsRef =
    useRef(
      new Map<string, number>(),
    )

  const collaborationPendingEditsRef =
    useRef(
      new Map<
        string,
        {
          translation:
            string

          baseRevision:
            number

          timeoutId:
            number
        }
      >(),
    )

  const [
    collaborationConflicts,
    setCollaborationConflicts,
  ] =
    useState(
      new Map<
        string,
        {
          entryId:
            string

          attemptedTranslation:
            string

          currentTranslation:
            string

          currentRevision:
            number

          participantId:
            string

          updatedAt:
            number
        }
      >(),
    )

  const collaboration:
    CollaborationController =
    useCollaborationSession({
      onProjectRequested:
        async () => {
          const project =
            createCurrentProject()

          /*
           * Host may create the collaboration
           * session before opening a project.
           *
           * In that case there is simply
           * nothing to send yet.
           */
          if (!project) {
            return
          }

          const projectJson =
            losslessStringify(
              project,
            )

          if (!projectJson) {
            return
          }

          await collaboration
            .sendProjectSnapshot({
              projectJson,

              sourceFileName:
                project.sourceFileName,

              sentAt:
                Date.now(),
            })
        },


      onTranslationUpdate:
        async (update) => {
          collaborationRevisionsRef
            .current
            .set(
              update.entryId,
              update.revision,
            )

          setEntries(
            (currentEntries) =>
              currentEntries.map(
                (entry) =>
                  entry.id ===
                  update.entryId
                    ? {
                        ...entry,

                        translation:
                          update.translation,
                      }
                    : entry,
              ),
          )

          setIsDirty(
            true,
          )
        },

      onTranslationConflict:
        async (conflict) => {
          /*
           * Keep the translator's rejected
           * text so it can be reviewed or
           * restored later.
           */
          setCollaborationConflicts(
            (current) => {
              const next =
                new Map(
                  current,
                )

              next.set(
                conflict.entryId,
                conflict,
              )

              return next
            },
          )

          /*
           * We now know the authoritative
           * revision held by the relay.
           */
          collaborationRevisionsRef
            .current
            .set(
              conflict.entryId,
              conflict.currentRevision,
            )

          /*
           * Restore the accepted server
           * value instead of silently
           * overwriting another person's
           * translation.
           */
          setEntries(
            (currentEntries) =>
              currentEntries.map(
                (entry) =>
                  entry.id ===
                  conflict.entryId
                    ? {
                        ...entry,

                        translation:
                          conflict.currentTranslation,
                      }
                    : entry,
              ),
          )

          setIsDirty(
            true,
          )

          showToast(
            'error',
            'Translation conflict detected. Your edit was preserved for review.',
          )
        },

      onProjectSnapshot:
        async (snapshot) => {
          try {
            const parsed =
              losslessParse(
                snapshot.projectJson,
              )

            if (
              typeof parsed !== 'object' ||
              parsed === null ||
              Array.isArray(parsed)
            ) {
              throw new Error(
                'Invalid collaboration project.'
              )
            }

            const project =
              parsed as unknown as
                LocalizationProjectV2

            const projectVersion =
              Number(
                String(
                  project.version,
                ),
              )

            if (
              project.format !==
                'LocalizationHubProject' ||
              projectVersion !== 2 ||
              !Array.isArray(
                project.entries,
              ) ||
              project.entries.length === 0 ||
              !project.document ||
              typeof project.sourceFileName !==
                'string'
            ) {
              throw new Error(
                'Unsupported collaboration project.'
              )
            }

            for (
              const pendingEdit of
                collaborationPendingEditsRef
                  .current
                  .values()
            ) {
              window.clearTimeout(
                pendingEdit.timeoutId,
              )
            }

            collaborationPendingEditsRef
              .current
              .clear()

            setCollaborationConflicts(
              new Map(),
            )

            collaborationRevisionsRef
              .current
              .clear()

            setEntries(
              project.entries,
            )

            setFileName(
              project.sourceFileName ||
                snapshot.sourceFileName,
            )

            /*
             * A collaboration snapshot
             * is not a local .lhproj file.
             *
             * Never Quick Save it over
             * an unrelated local project.
             */
            setProjectLocation(
              null,
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

            /*
             * The received snapshot is
             * our clean collaboration
             * baseline.
             */
            setIsDirty(
              false,
            )

            showToast(
              'success',
              `Received ${project.sourceFileName} from the collaboration host.`,
            )
          } catch (error) {
            console.error(
              'Failed to apply collaboration project snapshot.',
              error,
            )

            showToast(
              'error',
              'Could not open the project received from the host.',
            )
          }
        },    })

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
    projectLocation,
    setProjectLocation,
  ] =
    useState<ProjectLocation | null>(
      null,
    )

  const [
    cloudRevision,
    setCloudRevision,
  ] =
    useState<number | null>(
      null,
    )

  const [
    cloudProjectId,
    setCloudProjectId,
  ] =
    useState('')

  const [
    cloudProjects,
    setCloudProjects,
  ] =
    useState<CloudProjectSummary[]>(
      [],
    )

  const [
    cloudProjectsLoading,
    setCloudProjectsLoading,
  ] =
    useState(false)

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

  useEffect(
    () => {
      if (
        collaboration.status !==
          'connected' ||
        !collaboration.session
      ) {
        return
      }

      void collaboration
        .sendEntrySelection({
          entryId:
            selectedEntryId,
        })
        .catch(
          (error) => {
            console.error(
              'Failed to sync entry selection.',
              error,
            )
          },
        )
    },
    [
      selectedEntryId,
      collaboration.status,
      collaboration.session
        ?.sessionId,
      collaboration
        .sendEntrySelection,
    ],
  )

  const selectedEntry =
    entries.find(
      (entry) =>
        entry.id ===
        selectedEntryId,
    ) ?? null


  const selectedCollaborationConflict =
    selectedEntry
      ? collaborationConflicts.get(
          selectedEntry.id,
        ) ??
        null
      : null
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
        {
          kind:
            'local',

          path,
        },
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

    setProjectLocation(
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

      setProjectLocation(
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

  async function handleCreateCloudProject() {
    const project =
      createCurrentProject()

    if (!project) {
      return
    }

    try {
      const projectName =
        project.sourceFileName
          .replace(
            /\.[^.]+$/,
            '',
          )
          .trim() ||
        'Cloud Project'

      const snapshot =
        await createCloudProject({
          name:
            projectName,

          project,
        })

      const location:
        ProjectLocation = {
          kind:
            'cloud',

          projectId:
            snapshot.id,
        }

      setProjectLocation(
        location,
      )

      setCloudRevision(
        snapshot.revision,
      )

      setCloudProjectId(
        snapshot.id,
      )

      setLastSession(
        rememberLastSession(
          location,
          project.sourceFileName,
        ),
      )

      setCloudProjects(
        (current) => [
          {
            id:
              snapshot.id,

            name:
              snapshot.name,

            sourceFileName:
              snapshot.project.sourceFileName,

            role:
              snapshot.role,

            revision:
              snapshot.revision,

            updatedAt:
              snapshot.updatedAt,
          },

          ...current.filter(
            (item) =>
              item.id !==
              snapshot.id,
          ),
        ],
      )

      setIsDirty(
        false,
      )

      showToast(
        'success',
        'Cloud Project created successfully.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'Could not create Cloud Project.',
      )
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
      await desktopProjectStorage.save(
        {
          kind:
            'local',

          path:
            selectedPath,
        },

        project,
      )

      setProjectLocation({
        kind:
          'local',

        path:
          selectedPath,
      })

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
      !projectLocation
    ) {
      await handleSaveProjectAs()

      return
    }

try {
      if (
        projectLocation.kind ===
          'local'
      ) {
        await desktopProjectStorage.save(
          projectLocation,

          project,
        )
      } else {
        if (
          cloudRevision ===
            null
        ) {
          throw new Error(
            'Cloud project revision is missing.',
          )
        }

        const saved =
          await cloudProjectStorage.save(
            projectLocation,

            project,

            {
              baseRevision:
                cloudRevision,
            },
          )

        setCloudRevision(
          saved.revision,
        )
      }

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

      if (
        error instanceof
          CloudProjectsApiError &&
        error.code ===
          'revision-conflict'
      ) {
        showToast(
          'warning',
          'تعذر الحفظ: المشروع تغيّر على السحابة.',
        )

        if (
          projectLocation.kind ===
            'cloud'
        ) {
          const shouldReload =
            await confirm(
              'توجد نسخة أحدث على السحابة.\n\nهل تريد إعادة تحميلها الآن؟\n\nملاحظة: سيتم استبدال التعديلات المحلية غير المحفوظة.',

              {
                title:
                  'Cloud Project Conflict',

                kind:
                  'warning',
              },
            )

          if (
            shouldReload
          ) {
            await loadProjectFromLocation(
              projectLocation,
            )
          }
        }

        return
      }

      showToast(
        'error',
        'فشل حفظ المشروع.',
      )
    }
  }

  async function loadProjectFromLocation(
    location:
      ProjectLocation,

    openedFromRecent =
      false,
  ) {
    const selected =
      location.kind ===
        'local'
        ? location.path
        : null

    try {
      const storage =
        location.kind ===
          'local'
          ? desktopProjectStorage
          : cloudProjectStorage

      const loaded =
        await storage.load(
          location,
        )

      const project =
        loaded.project

      setEntries(
        project.entries,
      )

      setFileName(
        project.sourceFileName,
      )

      setDocumentInfo(
        project.document,
      )

      /*
       * Legacy v1 projects must use Save As
       * so they are written back as v2.
       */
      setProjectLocation(
        loaded.migratedFromVersion === 1
          ? null
          : location,
      )

      setCloudRevision(
        location.kind ===
          'cloud'
          ? loaded.revision
          : null,
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

      if (
        location.kind ===
          'local'
      ) {
        rememberProject(
          location.path,
          project.sourceFileName,
        )
      } else {
        setLastSession(
          rememberLastSession(
            location,
            project.sourceFileName,
          ),
        )
      }

      showToast(
        loaded.migratedFromVersion === 1
          ? 'info'
          : 'success',

        loaded.migratedFromVersion === 1
          ? 'تم فتح المشروع القديم وترحيله للتنسيق الحالي.'
          : 'تم فتح المشروع بنجاح.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      if (
        error instanceof
        ProjectStorageError
      ) {
        if (
          error.code ===
          'read-failed'
        ) {
          if (
            selected !==
              null &&
            lastSession?.location.kind ===
              'local' &&
            lastSession.location.path ===
              selected
          ) {
            forgetSession()
          }

          if (
            openedFromRecent
          ) {
            setRecentProjects(
              removeRecentProject(
                selected!,
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

        switch (
          error.code
        ) {
          case 'invalid-format':
            showToast(
              'error',
              'ملف المشروع غير صالح.',
            )
            return

          case 'empty-project':
            showToast(
              'warning',
              'المشروع لا يحتوي على نصوص.',
            )
            return

          case 'unsupported-version':
            showToast(
              'error',
              'إصدار المشروع غير مدعوم.',
            )
            return

          case 'invalid-json':
            showToast(
              'error',
              'فشل فتح المشروع. قد يكون الملف تالفًا أو غير صالح.',
            )
            return
        }
      }

      showToast(
        'error',
        'فشل فتح المشروع. قد يكون الملف تالفًا أو غير صالح.',
      )
    }
  }

  async function loadProjectFromPath(
    selected:
      string,

    openedFromRecent =
      false,
  ) {
    await loadProjectFromLocation(
      {
        kind:
          'local',

        path:
          selected,
      },

      openedFromRecent,
    )
  }

  async function handleRefreshCloudProjects() {
    setCloudProjectsLoading(
      true,
    )

    try {
      const projects =
        await listCloudProjects()

      setCloudProjects(
        projects,
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        'Could not load Cloud Projects.',
      )
    } finally {
      setCloudProjectsLoading(
        false,
      )
    }
  }

  /*
   * Auto-load Cloud Projects when the Cloud API is available.
   *
   * Development uses the local API automatically.
   * Production waits until VITE_CLOUD_API_URL is configured.
   */
  useEffect(
    () => {
      const cloudApiAvailable =
        import.meta.env.DEV ||
        Boolean(
          import.meta.env
            .VITE_CLOUD_API_URL
            ?.trim(),
        )

      if (
        !cloudApiAvailable
      ) {
        return
      }

      void handleRefreshCloudProjects()
    },
    [],
  )

  async function handleOpenCloudProject() {
    const projectId =
      cloudProjectId.trim()

    if (!projectId) {
      return
    }

    await loadProjectFromLocation({
      kind:
        'cloud',

      projectId,
    })
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

      setProjectLocation(
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

    if (
      collaboration.session &&
      collaboration.status ===
        'connected'
    ) {
      const existingPending =
        collaborationPendingEditsRef
          .current
          .get(
            id,
          )

      /*
       * Keep the revision from the start
       * of this editing burst.
       *
       * If another participant changes
       * the same entry meanwhile, the
       * server can correctly detect the
       * stale edit.
       */
      const baseRevision =
        existingPending
          ?.baseRevision ??
        collaborationRevisionsRef
          .current
          .get(
            id,
          ) ??
        0

      if (existingPending) {
        window.clearTimeout(
          existingPending.timeoutId,
        )
      }

      const timeoutId =
        window.setTimeout(
          () => {
            const pending =
              collaborationPendingEditsRef
                .current
                .get(
                  id,
                )

            if (!pending) {
              return
            }

            collaborationPendingEditsRef
              .current
              .delete(
                id,
              )

            void collaboration
              .sendTranslationUpdate({
                entryId:
                  id,

                translation:
                  pending.translation,

                baseRevision:
                  pending.baseRevision,
              })
              .catch(
                (error) => {
                  console.error(
                    'Failed to sync translation update.',
                    error,
                  )
                },
              )
          },
          300,
        )

      collaborationPendingEditsRef
        .current
        .set(
          id,
          {
            translation:
              value,

            baseRevision,

            timeoutId,
          },
        )
    }
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
                onClick={() => {
                  setShowCollaborationPanel(
                    (current) =>
                      !current,
                  )
                }}
              >
                {
                  showCollaborationPanel
                    ? 'Close Collaboration'
                    : 'Join Project'
                }
              </button>
            </div>

            <div className="cloud-project-open">
              <input
                className="cloud-project-input"
                type="text"
                value={
                  cloudProjectId
                }
                placeholder="Cloud Project ID"
                aria-label="Cloud Project ID"
                onChange={(
                  event,
                ) => {
                  setCloudProjectId(
                    event.target.value,
                  )
                }}
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                      'Enter'
                  ) {
                    void handleOpenCloudProject()
                  }
                }}
              />

              <button
                className="secondary-button"
                type="button"
                disabled={
                  cloudProjectId
                    .trim()
                    .length === 0
                }
                onClick={() => {
                  void handleOpenCloudProject()
                }}
              >
                Open Cloud
              </button>
            </div>

            <section className="cloud-projects-panel">
              <div className="cloud-projects-header">
                <div>
                  <strong>
                    My Cloud Projects
                  </strong>

                  <span>
                    Experimental
                  </span>
                </div>

                <button
                  className="secondary-button"
                  type="button"
                  disabled={
                    cloudProjectsLoading
                  }
                  onClick={() => {
                    void handleRefreshCloudProjects()
                  }}
                >
                  {
                    cloudProjectsLoading
                      ? 'Loading...'
                      : 'Refresh'
                  }
                </button>
              </div>

              {
                cloudProjects.length >
                  0 ? (
                  <div className="cloud-projects-list">
                    {
                      cloudProjects.map(
                        (
                          project,
                        ) => (
                          <div
                            className="cloud-project-card"
                            key={
                              project.id
                            }
                          >
                            <div className="cloud-project-card-info">
                              <strong>
                                {
                                  project.name
                                }
                              </strong>

                              <span>
                                {
                                  project.sourceFileName
                                }
                              </span>

                              <small>
                                Revision {
                                  project.revision
                                }
                                {'\u00B7'}
                                {
                                  project.role
                                }
                              </small>
                            </div>

                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setCloudProjectId(
                                  project.id,
                                )

                                void loadProjectFromLocation({
                                  kind:
                                    'cloud',

                                  projectId:
                                    project.id,
                                })
                              }}
                            >
                              Open
                            </button>
                          </div>
                        ),
                      )
                    }
                  </div>
                ) : (
                  <p className="cloud-projects-empty">
                    {
                      cloudProjectsLoading
                        ? 'Loading Cloud Projects...'
                        : 'No Cloud Projects yet.'
                    }
                  </p>
                )
              }
            </section>

            <WelcomeDropZone />

            {
              showCollaborationPanel && (
                <CollaborationPanel
                  collaboration={
                    collaboration
                  }
                />
              )
            }

            {
              lastSession && (
                <LastSessionCard
                  session={
                    lastSession
                  }

                  onResume={() => {
                    void loadProjectFromLocation(
                      lastSession.location,

                      lastSession.location.kind ===
                        'local',
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

            {
              collaboration.session && (
                <WorkspaceCollaborationStatus
                  session={
                    collaboration.session
                  }

                  status={
                    collaboration.status
                  }

                  entries={
                    entries
                  }

                  onSelectEntry={
                    setSelectedEntryId
                  }

                  onLeave={
                    collaboration.leaveSession
                  }
                />
              )
            }

            <TokenProfileSelect
              value={
                tokenProfile
              }
              onChange={
                handleTokenProfileChange
              }
            />

            <div
              className={`project-location-badge ${
                projectLocation?.kind ??
                'unsaved'
              }`}
              title={
                projectLocation?.kind ===
                'cloud'
                  ? `Cloud Project \u00B7 Revision ${
                      cloudRevision ??
                      '?'
                    }`
                  : projectLocation?.kind ===
                      'local'
                    ? 'Local Project'
                    : 'Project has not been saved yet'
              }
            >
              <span
                className="project-location-dot"
                aria-hidden="true"
              />

              {
                projectLocation?.kind ===
                  'cloud'
                  ? `Cloud \u00B7 r${
                      cloudRevision ??
                      '?'
                    }`
                  : projectLocation?.kind ===
                      'local'
                    ? 'Local'
                    : 'Unsaved'
              }
            </div>

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

            {
              projectLocation?.kind !==
                'cloud' && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    void handleCreateCloudProject()
                  }}
                  title="Create a Cloud copy of this project"
                >
                  Save to Cloud
                </button>
              )
            }

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

                          presenceNames={
                            collaboration
                              .session
                              ?.participants
                              .filter(
                                (participant) =>
                                  participant
                                    .selectedEntryId ===
                                  entry.id,
                              )
                              .map(
                                (participant) =>
                                  participant
                                    .displayName,
                              ) ??
                            []
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

                          {
                            selectedCollaborationConflict && (
                              <div className="collaboration-conflict-card">
                                <div className="collaboration-conflict-header">
                                  <div>
                                    <strong>
                                      Translation Conflict
                                    </strong>

                                    <p>
                                      Another participant changed this entry while you were editing it.
                                    </p>
                                  </div>

                                  <span>
                                    Review
                                  </span>
                                </div>

                                <div className="collaboration-conflict-versions">
                                  <div className="collaboration-conflict-version">
                                    <span>
                                      Mine
                                    </span>

                                    <div className="collaboration-conflict-text">
                                      {
                                        selectedCollaborationConflict
                                          .attemptedTranslation
                                      }
                                    </div>
                                  </div>

                                  <div className="collaboration-conflict-version">
                                    <span>
                                      Theirs
                                    </span>

                                    <div className="collaboration-conflict-text">
                                      {
                                        selectedCollaborationConflict
                                          .currentTranslation
                                      }
                                    </div>
                                  </div>
                                </div>

                                <div className="collaboration-conflict-actions">
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => {
                                      const entryId =
                                        selectedCollaborationConflict
                                          .entryId

                                      setCollaborationConflicts(
                                        (current) => {
                                          const next =
                                            new Map(
                                              current,
                                            )

                                          next.delete(
                                            entryId,
                                          )

                                          return next
                                        },
                                      )

                                      showToast(
                                        'success',
                                        'Kept the latest collaborative translation.',
                                      )
                                    }}
                                  >
                                    Keep Theirs
                                  </button>

                                  <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() => {
                                      const conflict =
                                        selectedCollaborationConflict

                                      setEntries(
                                        (currentEntries) =>
                                          currentEntries.map(
                                            (entry) =>
                                              entry.id ===
                                              conflict.entryId
                                                ? {
                                                    ...entry,

                                                    translation:
                                                      conflict.attemptedTranslation,
                                                  }
                                                : entry,
                                          ),
                                      )

                                      setIsDirty(
                                        true,
                                      )

                                      setCollaborationConflicts(
                                        (current) => {
                                          const next =
                                            new Map(
                                              current,
                                            )

                                          next.delete(
                                            conflict.entryId,
                                          )

                                          return next
                                        },
                                      )

                                      void collaboration
                                        .sendTranslationUpdate({
                                          entryId:
                                            conflict.entryId,

                                          translation:
                                            conflict.attemptedTranslation,

                                          baseRevision:
                                            conflict.currentRevision,
                                        })
                                        .catch(
                                          (error) => {
                                            console.error(
                                              'Failed to resolve translation conflict.',
                                              error,
                                            )

                                            showToast(
                                              'error',
                                              'Could not apply your conflict resolution.',
                                            )
                                          },
                                        )
                                    }}
                                  >
                                    Keep Mine
                                  </button>
                                </div>
                              </div>
                            )
                          }
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

