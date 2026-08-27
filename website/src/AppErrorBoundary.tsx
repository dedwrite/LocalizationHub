import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real exception + component stack to the developer console so
    // failures are actionable. This is developer-facing output only — it is
    // never rendered into the page for users.
    console.error('[AppErrorBoundary] Uncaught render error:', error, info?.componentStack ?? '')

    // In development builds, re-throw on a later tick so tooling and Playwright's
    // `pageerror` listener capture the raw exception and stack trace. Production
    // keeps the friendly fallback UI and never re-throws.
    if (import.meta.env.DEV) {
      queueMicrotask(() => { throw error })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-error">
        <h1>Workspace unavailable.</h1>
        <p>Something went wrong while opening this view.</p>
        <button onClick={() => window.location.reload()}>Reload workspace</button>
      </main>
    )
  }
}
