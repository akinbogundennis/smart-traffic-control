import { Component } from 'react'

// Catches render errors anywhere below it so a single failing component shows a
// readable message instead of blanking the entire page.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface details to the console for debugging.
    console.error('App render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-xl bg-panel border border-danger/50 rounded-xl p-6">
            <h1 className="text-lg font-semibold text-danger mb-2">
              Something went wrong rendering the dashboard
            </h1>
            <p className="text-sm text-muted mb-3">
              The error below was caught so the rest of the app stays usable.
              Check the browser console for the full stack trace.
            </p>
            <pre className="bg-[#0d1218] border border-line rounded-lg p-3 text-xs text-danger overflow-x-auto">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <button
              className="btn mt-4"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
