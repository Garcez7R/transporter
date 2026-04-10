import { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary glass-card">
          <div className="error-icon">⚠️</div>
          <h3>Ops! Algo deu errado</h3>
          <p>Ocorreu um erro inesperado. Tente recarregar a página.</p>
          <button
            className="cta"
            onClick={() => window.location.reload()}
          >
            Recarregar Página
          </button>
          {import.meta.env.DEV && this.state.error && (
            <details className="error-details">
              <summary>Detalhes do erro (desenvolvimento)</summary>
              <pre>{this.state.error.message}</pre>
              <pre>{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export function LoadingSpinner({ size = 'medium', message = 'Carregando...' }: LoadingSpinnerProps) {
  return (
    <div className={`loading-spinner loading-${size}`}>
      <div className="spinner"></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children: ReactNode;
}

export function LoadingOverlay({ isVisible, message, children }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay-container">
      {children}
      {isVisible && (
        <div className="loading-overlay">
          <div className="loading-content">
            <LoadingSpinner message={message} />
          </div>
        </div>
      )}
    </div>
  );
}

interface SuspenseFallbackProps {
  message?: string;
}

export function SuspenseFallback({ message = 'Carregando...' }: SuspenseFallbackProps) {
  return (
    <div className="suspense-fallback">
      <LoadingSpinner size="large" message={message} />
    </div>
  );
}