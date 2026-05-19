import { useCallback, useEffect, useRef, useState } from 'react'

// True iff the page is running inside an iOS WKWebView with the StoreKitBridge attached.
function isIOSStoreKitAvailable() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const looksLikeIOS = /iPad|iPhone|iPod/.test(ua)
  return looksLikeIOS && !!window.webkit?.messageHandlers?.storekit
}

// Module-level plumbing — one set of pending requests / listeners regardless of
// how many times the hook is mounted.
let requestSeq = 0
const pendingRequests = new Map()
const transactionListeners = new Set()
let receiveInstalled = false

function installReceive() {
  if (receiveInstalled || typeof window === 'undefined') return
  receiveInstalled = true
  window.__storekitReceive = (msg) => {
    if (!msg || typeof msg !== 'object') return

    if (msg.event === 'transactionUpdate') {
      transactionListeners.forEach(fn => {
        try { fn(msg.payload) } catch (err) { console.error('storekit listener', err) }
      })
      return
    }

    const { requestId, ok, error, ...rest } = msg
    const handlers = pendingRequests.get(requestId)
    if (!handlers) return
    pendingRequests.delete(requestId)
    if (ok) handlers.resolve(rest)
    else    handlers.reject(new Error(error || 'StoreKit error'))
  }
}

function callBridge(action, body = {}) {
  return new Promise((resolve, reject) => {
    if (!isIOSStoreKitAvailable()) {
      reject(new Error('Apple IAP bridge not available on this device'))
      return
    }
    installReceive()
    const requestId = `${Date.now()}-${++requestSeq}`
    pendingRequests.set(requestId, { resolve, reject })
    try {
      window.webkit.messageHandlers.storekit.postMessage({ ...body, action, requestId })
    } catch (err) {
      pendingRequests.delete(requestId)
      reject(err)
    }
  })
}

export function useApplePay() {
  const isAvailable = isIOSStoreKitAvailable()
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const productsLoadedRef = useRef(false)

  const fetchProducts = useCallback(async () => {
    if (!isAvailable) return []
    setLoading(true); setError(null)
    try {
      const result = await callBridge('fetchProducts')
      const list = result.products || []
      setProducts(list)
      productsLoadedRef.current = true
      return list
    } catch (err) {
      setError(err.message || String(err))
      return []
    } finally {
      setLoading(false)
    }
  }, [isAvailable])

  useEffect(() => {
    if (isAvailable && !productsLoadedRef.current) fetchProducts()
  }, [isAvailable, fetchProducts])

  const purchase = useCallback(async (productId) => {
    if (!isAvailable) throw new Error('Apple IAP not available on this device')
    return callBridge('purchase', { productId })
  }, [isAvailable])

  const restore = useCallback(async () => {
    if (!isAvailable) throw new Error('Apple IAP not available on this device')
    return callBridge('restore')
  }, [isAvailable])

  const onTransactionUpdate = useCallback((fn) => {
    installReceive()
    transactionListeners.add(fn)
    return () => transactionListeners.delete(fn)
  }, [])

  return {
    isAvailable,
    products,
    loading,
    error,
    fetchProducts,
    purchase,
    restore,
    onTransactionUpdate,
  }
}

export const isApplePayAvailable = isIOSStoreKitAvailable
