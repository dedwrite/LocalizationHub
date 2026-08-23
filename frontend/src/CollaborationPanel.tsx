import {
  useState,
} from 'react'

import {
  useCollaborationSession,
} from './useCollaborationSession'

import './CollaborationPanel.css'

type CollaborationMode =
  | 'host'
  | 'join'

function CollaborationPanel() {
  const [
    mode,
    setMode,
  ] =
    useState<CollaborationMode>(
      'join',
    )

  const [
    displayName,
    setDisplayName,
  ] =
    useState('')

  const [
    sessionId,
    setSessionId,
  ] =
    useState('')

  const {
    session,
    hostProject,
    joinProject,
    leaveSession,
  } =
    useCollaborationSession()

  const trimmedName =
    displayName.trim()

  const trimmedSessionId =
    sessionId.trim()

  const canHost =
    trimmedName !== ''

  const canJoin =
    trimmedName !== '' &&
    trimmedSessionId !== ''

  function handleHost() {
    if (!canHost) {
      return
    }

    hostProject({
      displayName:
        trimmedName,
    })
  }

  function handleJoin() {
    if (!canJoin) {
      return
    }

    joinProject({
      sessionId:
        trimmedSessionId,

      displayName:
        trimmedName,
    })
  }

  /*
   * Once a local collaboration session
   * exists, show the session view instead
   * of the Host / Join form.
   *
   * Networking is NOT connected yet.
   */
  if (session) {
    const isHost =
      session.role === 'host'

    return (
      <section className="collaboration-panel">
        <div className="collaboration-panel-header">
          <div>
            <span className="collaboration-panel-eyebrow">
              Collaboration
            </span>

            <h2>
              Session Ready
            </h2>

            <p>
              Local session preview.
              Networking will be connected
              next.
            </p>
          </div>

          <span className="collaboration-panel-badge">
            {isHost
              ? 'HOST'
              : 'GUEST'}
          </span>
        </div>

        <div className="collaboration-session-card">
          <div className="collaboration-session-row">
            <span>
              Session ID
            </span>

            <strong>
              {session.sessionId}
            </strong>
          </div>

          <div className="collaboration-session-row">
            <span>
              Your Name
            </span>

            <strong>
              {session.displayName}
            </strong>
          </div>

          <div className="collaboration-session-row">
            <span>
              Role
            </span>

            <strong>
              {isHost
                ? 'Host'
                : 'Guest'}
            </strong>
          </div>

          <div className="collaboration-session-row">
            <span>
              Participants
            </span>

            <strong>
              {session.participants.length}
            </strong>
          </div>
        </div>

        <div className="collaboration-participants">
          <span className="collaboration-section-label">
            Participants
          </span>

          {
            session.participants.map(
              (participant) => (
                <div
                  className="collaboration-participant"
                  key={
                    participant.id
                  }
                >
                  <span className="collaboration-participant-avatar">
                    {
                      participant.displayName
                        .slice(0, 1)
                        .toUpperCase()
                    }
                  </span>

                  <div>
                    <strong>
                      {participant.displayName}
                    </strong>

                    <span>
                      {
                        participant.role ===
                        'host'
                          ? 'Host'
                          : 'Guest'
                      }
                    </span>
                  </div>
                </div>
              ),
            )
          }
        </div>

        <div className="collaboration-status-preview">
          <span className="collaboration-status-dot local" />

          <div>
            <strong>
              Local Preview
            </strong>

            <span>
              No network connection has
              been created yet.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="collaboration-leave-button"
          onClick={
            leaveSession
          }
        >
          Leave Session
        </button>
      </section>
    )
  }

  return (
    <section className="collaboration-panel">
      <div className="collaboration-panel-header">
        <div>
          <span className="collaboration-panel-eyebrow">
            Collaboration
          </span>

          <h2>
            Work Together
          </h2>

          <p>
            Host a localization session
            or join another translator.
          </p>
        </div>

        <span className="collaboration-panel-badge">
          v0.2
        </span>
      </div>

      <div className="collaboration-mode-switch">
        <button
          type="button"
          className={
            mode === 'join'
              ? 'active'
              : ''
          }
          onClick={() => {
            setMode(
              'join',
            )
          }}
        >
          Join Project
        </button>

        <button
          type="button"
          className={
            mode === 'host'
              ? 'active'
              : ''
          }
          onClick={() => {
            setMode(
              'host',
            )
          }}
        >
          Host Project
        </button>
      </div>

      <div className="collaboration-form">
        <label>
          <span>
            Display Name
          </span>

          <input
            type="text"
            value={
              displayName
            }
            onChange={
              (event) => {
                setDisplayName(
                  event.target.value,
                )
              }
            }
            placeholder="How others will see you"
            maxLength={
              32
            }
            autoComplete="off"
          />
        </label>

        {
          mode === 'join' && (
            <label>
              <span>
                Session ID
              </span>

              <input
                type="text"
                value={
                  sessionId
                }
                onChange={
                  (event) => {
                    setSessionId(
                      event.target.value,
                    )
                  }
                }
                placeholder="Enter session code"
                autoComplete="off"
                spellCheck={
                  false
                }
              />
            </label>
          )
        }

        {
          mode === 'host' && (
            <div className="collaboration-host-note">
              <strong>
                Host Session
              </strong>

              <span>
                A temporary session ID
                will be generated locally
                for the preview.
              </span>
            </div>
          )
        }

        <button
          type="button"
          className="collaboration-primary-action"
          disabled={
            mode === 'host'
              ? !canHost
              : !canJoin
          }
          onClick={
            mode === 'host'
              ? handleHost
              : handleJoin
          }
        >
          {
            mode === 'host'
              ? 'Host Project'
              : 'Join Project'
          }
        </button>
      </div>

      <div className="collaboration-status-preview">
        <span className="collaboration-status-dot" />

        <div>
          <strong>
            Offline
          </strong>

          <span>
            Collaboration networking
            will be connected next.
          </span>
        </div>
      </div>
    </section>
  )
}

export default CollaborationPanel