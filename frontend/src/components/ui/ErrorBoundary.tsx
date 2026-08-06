import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertOctagon, RefreshCw, Home } from 'lucide-react'
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
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="mx-auto flex max-w-lg w-full flex-col items-center justify-center rounded-2xl border border-status-error/30 bg-bg-elevated/90 p-8 text-center shadow-2xl backdrop-blur-2xl space-y-5 relative overflow-hidden">
        {/* Subtle Ambient Red Background Radial Accent */}
        <div className="absolute -top-24 -left-24 size-48 rounded-full bg-status-error/10 blur-3xl pointer-events-none" />

        {/* Glowing Error Icon Badge */}
        <div className="flex size-14 items-center justify-center rounded-full bg-status-error/10 text-status-error border border-status-error/25 shadow-lg shadow-status-error/10">
          <AlertOctagon className="size-7 animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          <p className="mt-1 text-xs text-text-tertiary leading-relaxed max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Terminal Log Error Console Box */}
        <div className="w-full rounded-xl border border-status-error/20 bg-bg-inset/90 p-3.5 text-left font-mono text-xs text-status-error overflow-x-auto max-h-36 shadow-inner">
          <span className="font-bold text-text-tertiary block mb-1">Error Details:</span>
          <code className="text-[11px] leading-relaxed break-words">{error.message || String(error)}</code>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
          <SweepButton onClick={onReset} icon={<RefreshCw className="size-4" />} className="h-10 text-xs font-bold">
            Try Again
          </SweepButton>
          <Button
            variant="outline"
            onClick={() => {
              if (window.location.pathname !== '/') {
                window.location.href = '/'
              } else {
                window.location.reload()
              }
            }}
            className="h-10 px-5 text-xs font-semibold text-text-secondary hover:text-text-primary border-border-medium bg-bg-inset gap-2 cursor-pointer"
          >
            <Home className="size-4" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
