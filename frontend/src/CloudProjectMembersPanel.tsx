import {
  useState,
} from 'react'

import ConfirmDialog from './ConfirmDialog'

import type {
  CloudProjectMember,
  CloudProjectMemberRole,
  CloudProjectRole,
} from '@localizationhub/core'

import {
  addCloudProjectMember,
  getCloudProjectsErrorMessage,
  listCloudProjectMembers,
  removeCloudProjectMember,
  updateCloudProjectMember,
} from './cloudProjectsApi'

import './CloudProjectMembersPanel.css'

type CloudProjectMembersPanelProps = {
  projectId:
    string

  projectRole:
    CloudProjectRole
}

function formatJoinedAt(
  value:
    string,
): string {
  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return date
    .toLocaleDateString()
}

function CloudProjectMembersPanel({
  projectId,
  projectRole,
}: CloudProjectMembersPanelProps) {
  const [
    members,
    setMembers,
  ] =
    useState<CloudProjectMember[]>(
      [],
    )

  const [
    loaded,
    setLoaded,
  ] =
    useState(false)

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    actionUserId,
    setActionUserId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    pendingRemoval,
    setPendingRemoval,
  ] =
    useState<CloudProjectMember | null>(
      null,
    )

  const [
    removeBusy,
    setRemoveBusy,
  ] =
    useState(false)

  const [
    username,
    setUsername,
  ] =
    useState('')

  const [
    newRole,
    setNewRole,
  ] =
    useState<CloudProjectMemberRole>(
      'editor',
    )

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    )

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const canManage =
    projectRole ===
      'owner'

  const normalizedUsername =
    username
      .trim()
      .toLowerCase()

  const usernameIsValid =
    normalizedUsername.length >=
      3 &&
    normalizedUsername.length <=
      32 &&
    /^[a-z0-9._-]+$/.test(
      normalizedUsername,
    )

  async function loadMembers() {
    if (loading) {
      return
    }

    setLoading(
      true,
    )

    setError(
      null,
    )

    try {
      const nextMembers =
        await listCloudProjectMembers(
          projectId,
        )

      setMembers(
        nextMembers,
      )

      setLoaded(
        true,
      )
    } catch (
      loadError
    ) {
      setError(
        getCloudProjectsErrorMessage(
          loadError,
          'Could not load project members.',
        ),
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  async function handleAddMember() {
    if (
      !usernameIsValid
    ) {
      setError(
        'Username must be 3-32 characters using letters, numbers, ".", "_" or "-".',
      )

      return
    }

    setLoading(
      true,
    )

    setError(
      null,
    )

    setMessage(
      null,
    )

    try {
      const member =
        await addCloudProjectMember(
          projectId,
          {
            username:
              normalizedUsername,

            role:
              newRole,
          },
        )

      setMembers(
        (
          current,
        ) => [
          ...current,

          member,
        ],
      )

      setUsername(
        '',
      )

      setMessage(
        `${member.username} added as ${member.role}.`,
      )
    } catch (
      addError
    ) {
      setError(
        getCloudProjectsErrorMessage(
          addError,
          'Could not add project member.',
        ),
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  async function handleRoleChange(
    member:
      CloudProjectMember,

    role:
      CloudProjectMemberRole,
  ) {
    if (
      member.role ===
        role
    ) {
      return
    }

    setActionUserId(
      member.userId,
    )

    setError(
      null,
    )

    setMessage(
      null,
    )

    try {
      const updated =
        await updateCloudProjectMember(
          projectId,
          member.userId,
          {
            role,
          },
        )

      setMembers(
        (
          current,
        ) =>
          current.map(
            (
              item,
            ) =>
              item.userId ===
                updated.userId
                ? updated
                : item,
          ),
      )

      setMessage(
        `${updated.username} is now ${updated.role}.`,
      )
    } catch (
      updateError
    ) {
      setError(
        getCloudProjectsErrorMessage(
          updateError,
          'Could not update project member.',
        ),
      )
    } finally {
      setActionUserId(
        null,
      )
    }
  }

  async function handleConfirmRemoveMember() {
    if (
      !pendingRemoval
    ) {
      return
    }

    setRemoveBusy(
      true,
    )

    setActionUserId(
      pendingRemoval.userId,
    )

    setError(
      null,
    )

    setMessage(
      null,
    )

    try {
      const removedUserId =
        await removeCloudProjectMember(
          projectId,
          pendingRemoval.userId,
        )

      setMembers(
        (
          current,
        ) =>
          current.filter(
            (
              item,
            ) =>
              item.userId !==
                removedUserId,
          ),
      )

      setMessage(
        `${pendingRemoval.username} removed from the project.`,
      )

      setPendingRemoval(
        null,
      )
    } catch (
      removeError
    ) {
      setError(
        getCloudProjectsErrorMessage(
          removeError,
          'Could not remove project member.',
        ),
      )
    } finally {
      setActionUserId(
        null,
      )

      setRemoveBusy(
        false,
      )
    }
  }

  return (
    <details
      className="cloud-project-members-panel"
      onToggle={(
        event,
      ) => {
        if (
          event.currentTarget.open &&
          !loaded &&
          !loading
        ) {
          void loadMembers()
        }
      }}
    >
      <summary>
        <span>
          Team
        </span>

        <small>
          {
            loaded
              ? `${members.length} member${members.length === 1 ? '' : 's'}`
              : projectRole
        }
        </small>
      </summary>

      <div className="cloud-project-members-content">
        <div className="cloud-project-members-toolbar">
          <div>
            <strong>
              Project Team
            </strong>

            <span>
              {
                canManage
                  ? 'Manage who can edit or view this project.'
                  : 'You can view the project team.'
              }
            </span>
          </div>

          <button
            className="cloud-project-members-refresh"
            type="button"
            disabled={
              loading
            }
            onClick={() => {
              void loadMembers()
            }}
          >
            {
              loading
                ? 'Loading...'
                : 'Refresh'
            }
          </button>
        </div>

        {
          canManage && (
            <div className="cloud-project-member-add">
              <input
                type="text"
                value={
                  username
                }
                disabled={
                  loading
                }
                placeholder="Username"
                aria-label="Member username"
                autoComplete="off"
                onChange={(
                  event,
                ) => {
                  setUsername(
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
                    event.preventDefault()

                    void handleAddMember()
                  }
                }}
              />

              <select
                value={
                  newRole
                }
                disabled={
                  loading
                }
                aria-label="New member role"
                onChange={(
                  event,
                ) => {
                  setNewRole(
                    event.target.value as
                      CloudProjectMemberRole,
                  )
                }}
              >
                <option value="editor">
                  Editor
                </option>

                <option value="viewer">
                  Viewer
                </option>
              </select>

              <button
                type="button"
                disabled={
                  loading ||
                  !usernameIsValid
                }
                onClick={() => {
                  void handleAddMember()
                }}
              >
                Add Member
              </button>
            </div>
          )
        }

        {
          error && (
            <div
              className="cloud-project-members-message is-error"
              role="alert"
            >
              {error}
            </div>
          )
        }

        {
          message && (
            <div
              className="cloud-project-members-message is-success"
              role="status"
            >
              {message}
            </div>
          )
        }

        {
          loading &&
          !loaded &&
          members.length ===
            0 ? (
            <p className="cloud-project-members-empty">
              Loading project team...
            </p>
          ) : members.length ===
              0 ? (
            <p className="cloud-project-members-empty">
              {
                error
                  ? 'Project team could not be loaded.'
                  : 'No project members found.'
              }
            </p>
          ) : (
            <div className="cloud-project-members-list">
              {
                members.map(
                  (
                    member,
                  ) => {
                    const immutable =
                      member.role ===
                        'owner'

                    const busy =
                      actionUserId ===
                        member.userId

                    return (
                      <div
                        className="cloud-project-member-row"
                        key={
                          member.userId
                        }
                      >
                        <div className="cloud-project-member-identity">
                          <strong>
                            {
                              member.username
                            }
                          </strong>

                          <span>
                            Joined {
                              formatJoinedAt(
                                member.joinedAt,
                              )
                            }
                          </span>
                        </div>

                        <div className="cloud-project-member-actions">
                          {
                            canManage &&
                            !immutable ? (
                              <select
                                value={
                                  member.role
                                }
                                disabled={
                                  busy
                                }
                                aria-label={
                                  `Role for ${member.username}`
                                }
                                onChange={(
                                  event,
                                ) => {
                                  void handleRoleChange(
                                    member,
                                    event.target.value as
                                      CloudProjectMemberRole,
                                  )
                                }}
                              >
                                <option value="editor">
                                  Editor
                                </option>

                                <option value="viewer">
                                  Viewer
                                </option>
                              </select>
                            ) : (
                              <span
                                className={
                                  `cloud-project-member-role is-${member.role}`
                                }
                              >
                                {
                                  member.role
                                }
                              </span>
                            )
                          }

                          {
                            canManage &&
                            !immutable && (
                              <button
                                className="cloud-project-member-remove"
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() => {
                                  setPendingRemoval(
                                    member,
                                  )
                                }}
                              >
                                {
                                  busy
                                    ? 'Working...'
                                    : 'Remove'
                                }
                              </button>
                            )
                          }
                        </div>
                      </div>
                    )
                  },
                )
              }
            </div>
          )
        }
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove Project Member"
        message={
          pendingRemoval
            ? `Remove ${pendingRemoval.username} from this Cloud Project?`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        busy={removeBusy}
        onCancel={() => {
          if (
            !removeBusy
          ) {
            setPendingRemoval(
              null,
            )
          }
        }}
        onConfirm={() => {
          void handleConfirmRemoveMember()
        }}
      />
    </details>
  )
}

export default CloudProjectMembersPanel
