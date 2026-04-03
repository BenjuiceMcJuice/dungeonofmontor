import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      var errorMsg = this.state.error ? this.state.error.toString() : 'Unknown error'
      var stack = this.state.errorInfo ? this.state.errorInfo.componentStack : ''
      // Trim stack to first 5 lines for readability
      var shortStack = stack ? stack.split('\n').slice(0, 5).join('\n') : ''

      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
          <p className="text-red-400 font-display text-xl">Something Crashed</p>
          <div className="bg-surface border border-red-400/30 rounded-lg p-4 w-full max-w-sm text-left">
            <p className="text-red-300 text-xs font-mono break-all">{errorMsg}</p>
            {shortStack && (
              <pre className="text-ink-faint text-[9px] font-mono mt-2 whitespace-pre-wrap break-all">{shortStack}</pre>
            )}
          </div>
          <p className="text-ink-dim text-xs">Screenshot this and send it to the dev.</p>
          <button onClick={function() { window.location.reload() }}
            className="py-2 px-6 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm">
            Reload Game
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
