// Apple purchases that our server has not recorded yet.
//
// The iOS bridge tells Apple the purchase is complete as soon as it succeeds,
// so Apple never hands it to the app again. If the call to verify-apple-receipt
// then fails (weak signal on the sideline), the coach has paid and has no plan.
// We keep the signed receipt on the phone until the server confirms it, and
// send it again when the app opens or comes back to the front, when the signal
// returns, every few minutes while waiting, and on "Restore purchases".

const KEY = 'squadiq_apple_pending_receipts'
// Shorter than a monthly period: after ~30 days the receipt has lapsed and the
// server would write the account as expired, which is worse than not sending.
const MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true }
  catch (err) { console.error('Could not save Apple receipt on this phone:', err); return false }
}

export function savePendingReceipt(userId, jws, productId) {
  if (!userId || !jws) return false
  const list = read().filter(r => r.jws !== jws)
  list.push({ userId, jws, productId, savedAt: Date.now() })
  return write(list)
}

export function clearPendingReceipt(jws) {
  write(read().filter(r => r.jws !== jws))
}

// A receipt the server refused is kept (support may need it, and a server fix
// can make it work), but no longer retried automatically.
function markRefused(jws) {
  write(read().map(r => r.jws === jws ? { ...r, refusedAt: Date.now() } : r))
}

export function hasPendingReceipts(userId) {
  return read().some(r => r.userId === userId && !r.refusedAt)
}

export function hasRefusedReceipts(userId) {
  return read().some(r => r.userId === userId && r.refusedAt)
}

// A 400 means the server looked at the receipt and refused it (wrong app,
// unknown product). Anything else — no signal, timeout, 401 from an expired
// login, 5xx — is worth another try.
function isPermanentRefusal(error) {
  return error?.name === 'FunctionsHttpError' && error?.context?.status === 400
}

// Send one receipt. Resolves with the subscription row the server wrote.
export async function sendReceipt(supabase, jws, productId) {
  const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
    body: { jws, productId },
  })
  if (error) { error.permanent = isPermanentRefusal(error); throw error }
  return data?.subscription ?? null
}

export function markReceiptRefused(jws) { markRefused(jws) }

// Retry every saved receipt for this user. Resolves with how many the server
// took. A call made while another is running waits for that one instead of
// reporting 0.
let inFlight = null
export function retryPendingReceipts(supabase, userId) {
  if (!userId) return Promise.resolve(0)
  if (inFlight) return inFlight
  inFlight = (async () => {
    let sent = 0
    const now = Date.now()
    for (const r of read()) {
      if (r.userId !== userId || r.refusedAt) continue
      if (now - (r.savedAt || 0) > MAX_AGE_MS) {
        console.error('Apple receipt never reached the server and is too old to send:', r.productId, new Date(r.savedAt).toISOString())
        markRefused(r.jws)
        continue
      }
      try {
        await sendReceipt(supabase, r.jws, r.productId)
        clearPendingReceipt(r.jws)
        sent++
      } catch (err) {
        console.error('Apple receipt retry failed:', err)
        if (err.permanent) markRefused(r.jws)
      }
    }
    return sent
  })().finally(() => { inFlight = null })
  return inFlight
}
