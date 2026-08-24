import { parse as losslessParse } from 'lossless-json'
import { stringify as losslessStringify } from 'lossless-json'
import {
  useCallback,
  useEffect,
  useRef,
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
  CloudProjectRole,
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
  getCloudProjectsErrorMessage,
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

import {
  getAuthErrorMessage,
  getCurrentAuthUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  restoreAuthSession,
  sendEmailVerification,
} from './authApi'

import {
  getAuthSession,
  rememberAuthSession,
  type AuthSession,
} from './authSession'

import AuthPanel from './AuthPanel'
import CloudProjectMembersPanel from './CloudProjectMembersPanel'
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

import ConfirmationModal from './ConfirmationModal'
import {
  showConfirmation,
} from './confirmation'

import './App.css'

type TranslationEntry =
  ParsedLocalizationEntry

function formatCloudProjectRole(
  role:
    CloudProjectRole | null,
): string {
  switch (role) {
    case 'owner':
      return 'Owner'

    case 'editor':
      return 'Editor'

    case 'viewer':
      return 'Viewer'

    default:
      return 'Unknown'
  }
}

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

  const workspaceReadOnlyRef =
    useRef(false)

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

          if (
            !workspaceReadOnlyRef
              .current
          ) {
            setIsDirty(
              true,
            )
          }
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

            setWorkspaceCloudRole(
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
    authSession,
    setAuthSession,
  ] =
    useState<AuthSession | null>(
      () =>
        getAuthSession(),
    )

  const [
    authRestoring,
    setAuthRestoring,
  ] =
    useState(
      true,
    )

  const [
    authActionLoading,
    setAuthActionLoading,
  ] =
    useState(
      false,
    )

  const cloudProjectsLocked =
    Boolean(
      authSession &&
        !authSession.user.emailVerified,
    )

  const [
    verificationWatchUntil,
    setVerificationWatchUntil,
  ] =
    useState<number | null>(
      null,
    )

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
    workspaceCloudRole,
    setWorkspaceCloudRole,
  ] =
    useState<CloudProjectRole | null>(
      null,
    )

  const workspaceReadOnly =
    projectLocation?.kind ===
      'cloud' &&
    workspaceCloudRole ===
      'viewer'

  workspaceReadOnlyRef.current =
    workspaceReadOnly

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
      workspaceReadOnly
    ) {
      showToast(
        'info',
        'Viewer access is read-only.',
      )

      return
    }

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

    setWorkspaceCloudRole(
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

      setWorkspaceCloudRole(
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
    if (
      !authSession
    ) {
      showToast(
        'error',
        'Sign in to use Cloud Projects.',
      )

      return
    }

    if (
      !authSession.user.emailVerified
    ) {
      showToast(
        'error',
        'Cloud Projects require a verified email.',
      )

      return
    }

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

      setWorkspaceCloudRole(
        snapshot.role,
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
        getCloudProjectsErrorMessage(
          error,
          'Could not create Cloud Project.',
        ),
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

      setWorkspaceCloudRole(
        null,
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
    if (
      workspaceReadOnly
    ) {
      showToast(
        'info',
        'Viewer access is read-only. Use Save As to create a local copy.',
      )

      return
    }

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
            await showConfirmation({
              title:
                'Cloud Project Conflict',
              message:
                'توجد نسخة أحدث على السحابة.\n\nهل تريد إعادة تحميلها الآن؟\n\nملاحظة: سيتم استبدال التعديلات المحلية غير المحفوظة.',
              confirmLabel:
                'Reload',
              cancelLabel:
                'Cancel',
              destructive: false,
            })

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

      setWorkspaceCloudRole(
        loaded.cloudRole,
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

  useEffect(
    () => {
      let cancelled =
        false

      void restoreAuthSession()
        .then(
          (
            restored,
          ) => {
            if (
              cancelled
            ) {
              return
            }

            setAuthSession(
              restored,
            )
          },
        )
        .catch(
          (
            error,
          ) => {
            console.error(
              'Failed to restore authentication session.',
              error,
            )
          },
        )
        .finally(
          () => {
            if (
              !cancelled
            ) {
              setAuthRestoring(
                false,
              )
            }
          },
        )

      return () => {
        cancelled =
          true
      }
    },
    [],
  )

  useEffect(
    () => {
      if (
        !authSession ||
        authSession.user.emailVerified
      ) {
        return
      }

      let cancelled =
        false

      let checking =
        false

      async function refreshVerificationStatus() {
        if (
          checking ||
          cancelled ||
          !authSession
        ) {
          return
        }

        checking =
          true

        try {
          const user =
            await getCurrentAuthUser(
              authSession.token,
            )

          if (
            cancelled ||
            !user.emailVerified
          ) {
            return
          }

          const updatedSession =
            rememberAuthSession({
              ...authSession,
              user,
            })

          setAuthSession(
            updatedSession,
          )

          setVerificationWatchUntil(
            null,
          )

          showToast(
            'success',
            'Email verified successfully.',
          )

          console.info(
            'Email verification status refreshed.',
          )
        } catch (
          error
        ) {
          console.error(
            'Could not refresh email verification status.',
            error,
          )
        } finally {
          checking =
            false
        }
      }

      function handleFocus() {
        void refreshVerificationStatus()
      }

      function handleVisibilityChange() {
        if (
          document.visibilityState ===
            'visible'
        ) {
          void refreshVerificationStatus()
        }
      }

      window.addEventListener(
        'focus',
        handleFocus,
      )

      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      let pollingTimer:
        ReturnType<typeof setInterval> |
        null =
          null

      if (
        verificationWatchUntil &&
        verificationWatchUntil >
          Date.now()
      ) {
        pollingTimer =
          setInterval(
            () => {
              if (
                Date.now() >=
                  verificationWatchUntil
              ) {
                setVerificationWatchUntil(
                  null,
                )

                if (
                  pollingTimer
                ) {
                  clearInterval(
                    pollingTimer,
                  )
                }

                return
              }

              void refreshVerificationStatus()
            },
            2000,
          )
      }

      return () => {
        cancelled =
          true

        window.removeEventListener(
          'focus',
          handleFocus,
        )

        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        )

        if (
          pollingTimer
        ) {
          clearInterval(
            pollingTimer,
          )
        }
      }
    },
    [
      authSession,
      verificationWatchUntil,
    ],
  )

  async function handleLoginAccount(
    username:
      string,

    password:
      string,
  ): Promise<boolean> {
    setAuthActionLoading(
      true,
    )

    try {
      const session =
        await loginAccount(
          username,
          password,
        )

      setAuthSession(
        session,
      )

      showToast(
        'success',
        `Signed in as @${session.user.username}.`,
      )

      return true
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        getAuthErrorMessage(
          error,
          'Could not sign in.',
        ),
      )

      return false
    } finally {
      setAuthActionLoading(
        false,
      )
    }
  }

  async function handleRegisterAccount(
    username:
      string,

    email:
      string,

    password:
      string,
  ): Promise<boolean> {
    setAuthActionLoading(
      true,
    )

    try {
      const session =
        await registerAccount(
          username,
          email,
          password,
        )

      setAuthSession(
        session,
      )

      showToast(
        'success',
        `Created account @${session.user.username}.`,
      )

      return true
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        getAuthErrorMessage(
          error,
          'Could not create account.',
        ),
      )

      return false
    } finally {
      setAuthActionLoading(
        false,
      )
    }
  }

  async function handleSendEmailVerification():
    Promise<void> {
    if (
      !authSession ||
      authSession.user.emailVerified
    ) {
      return
    }

    setAuthActionLoading(
      true,
    )

    try {
      const result =
        await sendEmailVerification(
          authSession.token,
        )

      if (
        result.alreadyVerified
      ) {
        const updatedSession =
          rememberAuthSession({
            ...authSession,

            user: {
              ...authSession.user,

              emailVerified:
                true,
            },
          })

        setAuthSession(
          updatedSession,
        )

        showToast(
          'success',
          'Email is already verified.',
        )

        return
      }

      setVerificationWatchUntil(
        Date.now() +
          10 * 60 * 1000,
      )

      showToast(
        'success',
        `Verification email sent to ${authSession.user.email}.`,
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        getAuthErrorMessage(
          error,
          'Could not send verification email.',
        ),
      )
    } finally {
      setAuthActionLoading(
        false,
      )
    }
  }

  async function handleLogoutAccount():
    Promise<void> {
    setAuthActionLoading(
      true,
    )

    try {
      await logoutAccount()

      showToast(
        'success',
        'Signed out.',
      )
    } catch (
      error
    ) {
      console.error(
        error,
      )

      showToast(
        'error',
        getAuthErrorMessage(
          error,
          'Signed out locally, but the server could not be reached.',
        ),
      )
    } finally {
      setAuthSession(
        null,
      )

      setCloudProjects(
        [],
      )

      if (
        lastSession
          ?.location.kind ===
          'cloud'
      ) {
        forgetSession()
      }

      setAuthActionLoading(
        false,
      )
    }
  }

  async function handleRefreshCloudProjects() {
    if (
      !authSession?.user.emailVerified
    ) {
      setCloudProjects(
        [],
      )

      return
    }

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
        getCloudProjectsErrorMessage(
          error,
          'Could not load Cloud Projects.',
        ),
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
      if (
        authRestoring
      ) {
        return
      }

      if (
        !authSession
      ) {
        setCloudProjects(
          [],
        )

        return
      }

      if (
        !authSession.user.emailVerified
      ) {
        setCloudProjects(
          [],
        )

        return
      }

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
    [
      authRestoring,
      authSession,
    ],
  )

  async function handleOpenCloudProject() {
    if (
      !authSession
    ) {
      showToast(
        'error',
        'Sign in to open Cloud Projects.',
      )

      return
    }

    if (
      !authSession.user.emailVerified
    ) {
      showToast(
        'error',
        'Verify your email before opening Cloud Projects.',
      )

      return
    }

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

      setWorkspaceCloudRole(
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
        await showConfirmation({
          title:
            'Token Warnings',
          message:
            `${exportValidation.warningCount.toLocaleString()} translated entries contain token warnings. You can continue exporting, but reviewing them first is recommended.`,
          confirmLabel:
            'Continue Export',
          cancelLabel:
            'Review First',
          destructive: false,
        })

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
    if (
      workspaceReadOnly
    ) {
      return
    }

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

            if (
              workspaceReadOnlyRef
                .current
            ) {
              return
            }

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

            <AuthPanel
              session={
                authSession
              }

              restoring={
                authRestoring
              }

              actionLoading={
                authActionLoading
              }

              onLogin={
                handleLoginAccount
              }

              onRegister={
                handleRegisterAccount
              }

              onSendVerification={
                handleSendEmailVerification
              }

              onLogout={
                handleLogoutAccount
              }
            />

            <details
              className={`cloud-project-advanced ${
                cloudProjectsLocked
                  ? 'is-locked'
                  : ''
              }`}
            >
              <summary>
                Advanced {'\u00B7'} Open by Project ID
                {
                  cloudProjectsLocked && (
                    <span className="cloud-lock-badge">
                      Locked
                    </span>
                  )
                }
              </summary>

              <div className="cloud-project-open">
                <input
                  className={`cloud-project-input ${
                    cloudProjectsLocked
                      ? 'is-locked'
                      : ''
                  }`}
                  type="text"
                  disabled={
                    !authSession ||
                    !authSession.user.emailVerified ||
                    authRestoring
                  }
                  value={
                    cloudProjectId
                  }
                  placeholder={
                    cloudProjectsLocked
                      ? 'Verify your email to unlock this'
                      : 'Cloud Project ID'
                  }
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
                  className={`secondary-button ${
                    cloudProjectsLocked
                      ? 'is-locked'
                      : ''
                  }`}
                  type="button"
                  disabled={
                    !authSession ||
                    !authSession.user.emailVerified ||
                    authRestoring ||
                    cloudProjectId
                      .trim()
                      .length === 0
                  }
                  onClick={() => {
                    void handleOpenCloudProject()
                  }}
                  title={
                    cloudProjectsLocked
                      ? 'Verify your email first'
                      : 'Open Cloud Project'
                  }
                >
                  {
                    cloudProjectsLocked
                      ? 'Open Cloud · Locked'
                      : 'Open Cloud'
                  }
                </button>
              </div>

              {
                cloudProjectsLocked && (
                  <p className="cloud-locked-note">
                    Email verification is required before opening Cloud Projects by ID.
                  </p>
                )
              }
            </details>

            <section
              className={`cloud-projects-panel ${
                cloudProjectsLocked
                  ? 'is-locked'
                  : ''
              }`}
            >
              <div className="cloud-projects-header">
                <div>
                  <strong>
                    My Cloud Projects
                  </strong>

                  <span>
                    {
                      cloudProjectsLocked
                        ? 'Locked'
                        : 'Experimental'
                    }
                  </span>
                </div>

                <button
                  className={`secondary-button ${
                    cloudProjectsLocked
                      ? 'is-locked'
                      : ''
                  }`}
                  type="button"
                  disabled={
                    !authSession ||
                    !authSession.user.emailVerified ||
                    authRestoring ||
                    cloudProjectsLoading
                  }
                  onClick={() => {
                    void handleRefreshCloudProjects()
                  }}
                  title={
                    cloudProjectsLocked
                      ? 'Verify your email first'
                      : 'Refresh Cloud Projects'
                  }
                >
                  {
                    cloudProjectsLocked
                      ? 'Refresh · Locked'
                      : cloudProjectsLoading
                        ? 'Loading...'
                        : 'Refresh'
                  }
                </button>
              </div>

              {
                cloudProjectsLocked && (
                  <div className="cloud-locked-banner">
                    <strong>
                      Cloud Projects are locked
                    </strong>

                    <span>
                      Verify your email to unlock refresh, open by ID, and cloud saving.
                    </span>
                  </div>
                )
              }

              {
                authSession &&
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
                                {' \u00B7 '}
                                {
                                  project.role
                                    .charAt(
                                      0,
                                    )
                                    .toUpperCase()
                                }
                                {
                                  project.role
                                    .slice(
                                      1,
                                    )
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

                            <CloudProjectMembersPanel
                              projectId={
                                project.id
                              }

                              projectRole={
                                project.role
                              }
                            />
                          </div>
                        ),
                      )
                    }
                  </div>
                ) : (
                  <p className="cloud-projects-empty">
                    {
                      !authSession
                        ? 'Sign in to view your Cloud Projects.'
                        : !authSession.user.emailVerified
                          ? 'Verify your email to unlock Cloud Projects.'
                          : cloudProjectsLoading
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

        <ConfirmationModal />
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
              disabled={
                workspaceReadOnly
              }
              title={
                workspaceReadOnly
                  ? 'Viewer access is read-only.'
                  : undefined
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
                  ? `Cloud Project \u00B7 ${
                      formatCloudProjectRole(
                        workspaceCloudRole,
                      )
                    } \u00B7 Revision ${
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
                  ? `Cloud \u00B7 ${
                      formatCloudProjectRole(
                        workspaceCloudRole,
                      )
                    } \u00B7 r${
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
              disabled={
                workspaceReadOnly
              }
              title="Save Project · Ctrl+S"
            >
              Save Project
            </button>

            {
              projectLocation?.kind !==
                'cloud' && (
                <button
                  className={`secondary-button ${
                    cloudProjectsLocked
                      ? 'is-locked'
                      : ''
                  }`}
                  type="button"
                  disabled={
                    !authSession ||
                    !authSession.user.emailVerified ||
                    authRestoring
                  }
                  onClick={() => {
                    void handleCreateCloudProject()
                  }}
                  title={
                    !authSession
                      ? 'Sign in to use Cloud Projects'
                      : !authSession.user.emailVerified
                        ? 'Verify your email to use Cloud Projects'
                        : 'Create a Cloud copy of this project'
                  }
                >
                  {
                    cloudProjectsLocked
                      ? 'Save to Cloud · Locked'
                      : 'Save to Cloud'
                  }
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
                                    disabled={
                                      workspaceReadOnly
                                    }
                                    title={
                                      workspaceReadOnly
                                        ? 'Viewer access is read-only.'
                                        : undefined
                                    }
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

                            readOnly={
                              workspaceReadOnly
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
                                    disabled={
                                      workspaceReadOnly
                                    }
                                    title={
                                      workspaceReadOnly
                                        ? 'Viewer access is read-only.'
                                        : undefined
                                    }
                                    className="primary-button"
                                    onClick={() => {
                                      if (
                                        workspaceReadOnly
                                      ) {
                                        return
                                      }

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

      <ConfirmationModal />
    </>
  )
}

export default App

