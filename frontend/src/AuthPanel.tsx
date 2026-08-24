import {
  useState,
  type FormEvent,
} from 'react'

import {
  type AuthSession,
} from './authSession'

import './AuthPanel.css'

type AuthPanelProps = {
  session:
    AuthSession | null

  restoring:
    boolean

  actionLoading:
    boolean

  onLogin:
    (
      username:
        string,

      password:
        string,
    ) => Promise<boolean>

  onRegister:
    (
      username:
        string,

      email:
        string,

      password:
        string,
    ) => Promise<boolean>

  onSendVerification:
    () => Promise<void>

  onLogout:
    () => Promise<void>
}

function AuthPanel({
  session,
  restoring,
  actionLoading,
  onLogin,
  onRegister,
  onSendVerification,
  onLogout,
}: AuthPanelProps) {
  const [
    mode,
    setMode,
  ] =
    useState<
      'login' |
      'register'
    >(
      'login',
    )

  const [
    username,
    setUsername,
  ] =
    useState('')

  const [
    email,
    setEmail,
  ] =
    useState('')

  const [
    password,
    setPassword,
  ] =
    useState('')

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      actionLoading ||
      restoring
    ) {
      return
    }

    const cleanUsername =
      username.trim()

    if (
      cleanUsername.length ===
        0 ||
      password.length ===
        0
    ) {
      return
    }

    const succeeded =
      mode ===
        'login'
        ? await onLogin(
            cleanUsername,
            password,
          )
        : await onRegister(
            cleanUsername,
            email.trim(),
            password,
          )

    if (succeeded) {
      setPassword('')
    }
  }

  if (restoring) {
    return (
      <section
        className="auth-panel auth-panel-status"
        aria-label="Cloud account"
        aria-busy="true"
      >
        <div>
          <strong>
            Cloud Account
          </strong>

          <span>
            Checking saved session...
          </span>
        </div>
      </section>
    )
  }

  if (session) {
    return (
      <section
        className="auth-panel auth-panel-signed-in"
        aria-label="Cloud account"
      >
        <div className="auth-account-top">
          <div className="auth-account-info">
            <div className="auth-account-avatar">
              {
                session.user.username
                  .slice(
                    0,
                    1,
                  )
                  .toUpperCase()
              }
            </div>

            <div className="auth-account-details">
              <span className="auth-account-label">
                Cloud Account
              </span>

              <div className="auth-account-name-row">
                <strong>
                  @{session.user.username}
                </strong>

                <span
                  className={
                    session.user.emailVerified
                      ? 'auth-verification-badge verified'
                      : 'auth-verification-badge unverified'
                  }
                >
                  {
                    session.user.emailVerified
                      ? 'Verified'
                      : 'Not Verified'
                  }
                </span>
              </div>

              <small className="auth-account-email">
                {session.user.email}
              </small>
            </div>
          </div>

          <button
            className="secondary-button auth-sign-out-button"
            type="button"
            disabled={
              actionLoading
            }
            onClick={() => {
              void onLogout()
            }}
          >
            Sign Out
          </button>
        </div>

        {
          !session.user.emailVerified && (
            <div className="auth-verification-notice">
              <div>
                <strong>
                  Verify your email
                </strong>

                <span>
                  Confirm your email address to secure your Cloud account.
                </span>
              </div>

              <button
                className="secondary-button auth-verify-button"
                type="button"
                disabled={
                  actionLoading
                }
                onClick={() => {
                  void onSendVerification()
                }}
              >
                {
                  actionLoading
                    ? 'Sending...'
                    : 'Send Verification Email'
                }
              </button>
            </div>
          )
        }
      </section>
    )
  }

  return (
    <section
      className="auth-panel"
      aria-label="Cloud account"
    >
      <div className="auth-panel-heading">
        <div>
          <strong>
            Cloud Account
          </strong>

          <span>
            Sign in to access your Cloud Projects.
          </span>
        </div>

        <div
          className="auth-mode-switch"
          aria-label="Account action"
        >
          <button
            type="button"
            className={
              mode ===
                'login'
                ? 'auth-mode-button active'
                : 'auth-mode-button'
            }
            disabled={
              actionLoading
            }
            onClick={() => {
              setMode(
                'login',
              )
            }}
          >
            Sign In
          </button>

          <button
            type="button"
            className={
              mode ===
                'register'
                ? 'auth-mode-button active'
                : 'auth-mode-button'
            }
            disabled={
              actionLoading
            }
            onClick={() => {
              setMode(
                'register',
              )
            }}
          >
            Create Account
          </button>
        </div>
      </div>

      <form
        className={
          mode ===
            'register'
            ? 'auth-form auth-form-register'
            : 'auth-form'
        }
        onSubmit={
          handleSubmit
        }
      >
        <input
          className="auth-input"
          type="text"
          value={
            username
          }
          minLength={
            3
          }
          maxLength={
            32
          }
          autoComplete="username"
          placeholder="Username"
          aria-label="Username"
          disabled={
            actionLoading
          }
          onChange={(
            event,
          ) => {
            setUsername(
              event.target.value,
            )
          }}
        />

        {
          mode ===
            'register' && (
            <input
              className="auth-input"
              type="email"
              value={
                email
              }
              maxLength={
                254
              }
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              disabled={
                actionLoading
              }
              onChange={(
                event,
              ) => {
                setEmail(
                  event.target.value,
                )
              }}
            />
          )
        }

        <input
          className="auth-input"
          type="password"
          value={
            password
          }
          minLength={
            8
          }
          maxLength={
            128
          }
          autoComplete={
            mode ===
              'login'
              ? 'current-password'
              : 'new-password'
          }
          placeholder="Password"
          aria-label="Password"
          disabled={
            actionLoading
          }
          onChange={(
            event,
          ) => {
            setPassword(
              event.target.value,
            )
          }}
        />

        <button
          className="primary-button auth-submit-button"
          type="submit"
          disabled={
            actionLoading ||
            username
              .trim()
              .length ===
              0 ||
            (
              mode ===
                'register' &&
              email
                .trim()
                .length ===
                0
            ) ||
            password.length ===
              0
          }
        >
          {
            actionLoading
              ? 'Please Wait...'
              : mode ===
                  'login'
                ? 'Sign In'
                : 'Create Account'
          }
        </button>
      </form>

      {
        mode ===
          'register' && (
          <small className="auth-register-hint">
            Use a valid email. Username: 3-32 characters. Password: at least 8 characters.
          </small>
        )
      }
    </section>
  )
}

export default AuthPanel
