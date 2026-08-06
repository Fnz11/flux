import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'
import { SweepButton } from './SweepButton'
import { Button } from './button'

interface ErrorBoundaryProps {
  children?: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  title?: string
  description?: string
  onReset?: () => void
  error?: Error | null
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: props.error ?? null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  resetErrorBoundary = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    const error = this.props.error || this.state.error
    const hasError = this.props.error ? true : this.state.hasError

    if (hasError && error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(error, this.resetErrorBoundary)
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <DefaultErrorFallback
          error={error}
          title={this.props.title}
          description={this.props.description}
          onReset={this.resetErrorBoundary}
        />
      )
    }

    return this.props.children ?? null
  }
}

interface DefaultErrorFallbackProps {
  error: Error
  title?: string
  description?: string
  onReset: () => void
}

export function DefaultErrorFallback({
  error,
  title = 'Something went wrong',
  description = 'An unexpected application error occurred. You can retry the action or reload the page.',
  onReset,
}: DefaultErrorFallbackProps) {
  return (
    <div className="mx-auto flex my-12 max-w-lg flex-col items-center justify-center rounded-xl border border-status-error/30 bg-bg-elevated/90 p-8 text-center shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-status-error/10 text-status-error border border-status-error/20">
        <AlertOctagon className="size-7" />
      </div>

      <h2 className="mb-2 font-mono text-xl font-bold tracking-tight text-text-primary">
        {title}
      </h2>

      <p className="mb-4 text-sm text-text-secondary leading-relaxed">
        {description}
      </p>

      <div className="mb-6 w-full rounded-xl border border-border-subtle bg-bg-void/80 p-3.5 text-left font-mono text-xs text-status-error overflow-x-auto max-h-36">
        <span className="font-semibold text-text-muted">Error Details: </span>
        {error.message || String(error)}
      </div>

      <div className="flex gap-3">
        <SweepButton onClick={onReset} className="gap-2">
          <RefreshCw className="size-4" />
          Try Again
        </SweepButton>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="font-mono text-sm text-text-secondary hover:text-text-primary"
        >
          Reload Page
        </Button>
      </div>
    </div>
  )
}
