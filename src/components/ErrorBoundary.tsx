import { Component, type ReactNode } from 'react'
import MonadMark from './MonadMark'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// This app previously had no error boundary anywhere — a render-time
// crash (a missing env var, an unexpected null, etc.) simply unmounted
// everything with nothing rendered and no visible message: a blank
// screen, indistinguishable from "the app is loading" or "the network
// failed to load anything." Error boundaries must be class components
// (React has no hook equivalent for componentDidCatch). This one is
// deliberately minimal — it doesn't attempt to recover the crashed
// subtree, it just replaces a blank page with a legible message.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ink px-6">
          <div className="max-w-md text-center">
            <MonadMark size={44} className="mx-auto mb-6 opacity-60" />
            <h1 className="font-display font-semibold text-xl text-white mb-3">Something went wrong loading this page</h1>
            <p className="text-white/50 text-sm leading-relaxed mb-6">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
