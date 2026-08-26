import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { }
  render() { return this.state.failed ? <main className="app-error"><h1>Workspace unavailable.</h1><p>Something went wrong while opening this view.</p><button onClick={() => window.location.reload()}>Reload workspace</button></main> : this.props.children }
}
