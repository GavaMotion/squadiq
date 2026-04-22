import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/UI/Toast'
import App from './App'
import './index.css'

// ── Global error boundary ─────────────────────────────────────────
class GlobalErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('GLOBAL ERROR:', error)
    console.error('ERROR INFO:', errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#0d0d1a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#E24B4A', marginBottom: 8 }}>Something went wrong</h2>
          <pre style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', marginTop: 12, background: '#13131f', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
            {this.state.errorInfo?.componentStack ? '\n\nComponent stack:' + this.state.errorInfo.componentStack : ''}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            style={{ marginTop: 16, background: '#00c853', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <GlobalErrorBoundary>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </GlobalErrorBoundary>
)
