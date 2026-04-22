import { useState, useEffect, createContext, useContext, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type, duration }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 99998,
        width: '90%',
        maxWidth: 360,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            style={{
              background: toast.type === 'success'
                ? 'rgba(0,200,83,0.95)'
                : toast.type === 'error'
                  ? 'rgba(163,45,45,0.95)'
                  : toast.type === 'warning'
                    ? 'rgba(133,79,11,0.95)'
                    : 'rgba(26,26,46,0.95)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              pointerEvents: 'all',
              cursor: 'pointer',
              animation: 'toastIn 0.3s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>
              {toast.type === 'success' ? '✓'
                : toast.type === 'error' ? '✕'
                : toast.type === 'warning' ? '⚠'
                : 'ℹ'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
