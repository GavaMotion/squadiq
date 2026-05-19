// verify-apple-receipt
//
// Single endpoint that handles both:
//   (A) iOS-app-initiated verification    body: { jws, productId, userId }
//   (B) Apple Server-to-Server (V2) hooks body: { signedPayload }
//
// Both arrive as JWS (JWT-shaped, ES256-signed) with the cert chain in the
// JOSE header's `x5c`. We walk the chain (each cert signed by the next),
// pin the terminal cert against Apple Root CA - G3 by SHA-256, and verify
// the JWS body against the leaf cert's public key.

import { serve }            from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient }     from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtVerify }        from 'https://deno.land/x/jose@v5.9.6/index.ts'
import { X509Certificate }  from 'https://esm.sh/@peculiar/x509@1.12.3'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PRODUCT_TO_PLAN: Record<string, 'solo' | 'premium'> = {
  solo_monthly:    'solo',
  solo_yearly:     'solo',
  premium_monthly: 'premium',
  premium_yearly:  'premium',
}

// SHA-256 fingerprint of Apple Root CA - G3 (DER form).
//
// Verify against Apple's published cert before going to production:
//   curl -O https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
//   openssl x509 -in AppleRootCA-G3.cer -inform DER -fingerprint -sha256 -noout
//
// Override at deploy time by setting APPLE_ROOT_CA_G3_SHA256.
const APPLE_ROOT_CA_G3_SHA256 = (
  Deno.env.get('APPLE_ROOT_CA_G3_SHA256') ??
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179'
).replace(/[:\s]/g, '').toLowerCase()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ─── JWS verification ──────────────────────────────────────────────────────

function b64UrlToString(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
  return atob(padded)
}

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function sha256Hex(data: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data as ArrayBuffer)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Walk the x5c chain, verifying each cert is signed by the next, and pin the
// terminal cert against Apple Root CA - G3. Returns the leaf cert's public
// key so the JWS body can be verified against it.
async function validateAppleChain(x5c: string[]): Promise<CryptoKey> {
  if (!x5c?.length)        throw new Error('Empty x5c chain')
  if (x5c.length < 2)      throw new Error('x5c chain too short — leaf alone is not enough')

  const certs = x5c.map(b64 => new X509Certificate(b64ToUint8(b64)))

  for (let i = 0; i < certs.length - 1; i++) {
    const issuerKey = await certs[i + 1].publicKey.export()
    const ok = await certs[i].verify({ publicKey: issuerKey })
    if (!ok) throw new Error(`x5c chain signature broken at index ${i}`)
  }

  const rootFp = await sha256Hex(certs[certs.length - 1].rawData)
  if (rootFp !== APPLE_ROOT_CA_G3_SHA256) {
    throw new Error(`Untrusted root cert — got SHA-256 ${rootFp}`)
  }

  return await certs[0].publicKey.export()
}

async function verifyAppleJWS<T = Record<string, unknown>>(jws: string): Promise<T> {
  const segments = jws.split('.')
  if (segments.length !== 3) throw new Error('Malformed JWS')

  const headerJson = b64UrlToString(segments[0])
  const header = JSON.parse(headerJson) as { alg?: string; x5c?: string[] }

  if (header.alg !== 'ES256') throw new Error(`Unexpected alg: ${header.alg}`)
  if (!header.x5c?.[0])       throw new Error('JWS header is missing x5c')

  // Pin the chain to Apple Root CA - G3, then use the leaf cert's public key
  // to verify the JWS signature. Apple does not always populate iss/aud
  // claims consistently across notification types, so we skip those checks
  // and re-validate the bundle ID separately in the client-purchase branch.
  const leafKey = await validateAppleChain(header.x5c)
  const { payload } = await jwtVerify(jws, leafKey)
  return payload as T
}

// ─── DB writes ─────────────────────────────────────────────────────────────

interface AppleTransactionInfo {
  productId: string
  originalTransactionId: number | string
  transactionId:         number | string
  bundleId?:             string
  expiresDate?:          number   // ms epoch
  revocationDate?:       number   // ms epoch (when refunded/revoked)
  environment?:          string   // "Sandbox" | "Production"
}

async function applyTransaction(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tx: AppleTransactionInfo,
) {
  const plan = PRODUCT_TO_PLAN[tx.productId] ?? 'solo'
  const expires = tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null
  const status  = tx.revocationDate ? 'canceled' : 'active'
  const planValue = tx.revocationDate ? 'expired' : plan

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      plan:                          planValue,
      status,
      platform:                      'apple',
      apple_original_transaction_id: String(tx.originalTransactionId),
      apple_product_id:              tx.productId,
      apple_environment:             tx.environment ?? null,
      current_period_end:            expires,
      updated_at:                    new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

async function findUserByOriginalTxId(
  supabase: ReturnType<typeof createClient>,
  originalTransactionId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('apple_original_transaction_id', originalTransactionId)
    .maybeSingle()
  return data?.user_id ?? null
}

// ─── HTTP handler ─────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const body = await req.json()

    // ── Branch B: Apple Server-to-Server Notifications V2 ────────────
    if (body?.signedPayload) {
      const note = await verifyAppleJWS<{
        notificationType: string
        subtype?: string
        data?: {
          signedTransactionInfo?: string
          signedRenewalInfo?:     string
          bundleId?:              string
          environment?:           string
        }
      }>(body.signedPayload)

      const signedTx = note.data?.signedTransactionInfo
      if (!signedTx) {
        // Some notification types (e.g. CONSUMPTION_REQUEST) don't include tx info.
        return json({ ok: true, ignored: 'no transactionInfo', type: note.notificationType })
      }

      const tx = await verifyAppleJWS<AppleTransactionInfo>(signedTx)
      const originalTxId = String(tx.originalTransactionId)
      const userId = await findUserByOriginalTxId(supabase, originalTxId)

      if (!userId) {
        // We haven't seen this original_tx_id yet — could be an early notification
        // that arrived before the client verification call landed. Acknowledge so
        // Apple doesn't retry indefinitely; the next client call will reconcile.
        return json({ ok: true, ignored: 'no user mapping', original_tx_id: originalTxId })
      }

      const type = note.notificationType
      const terminal = type === 'EXPIRED' || type === 'REVOKE' || type === 'REFUND'
                    || type === 'GRACE_PERIOD_EXPIRED'

      if (terminal) {
        await supabase.from('subscriptions').update({
          plan:       'expired',
          status:     'canceled',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
      } else {
        // SUBSCRIBED, DID_RENEW, OFFER_REDEEMED, DID_CHANGE_RENEWAL_STATUS, etc.
        await applyTransaction(supabase, userId, tx)
      }

      return json({ ok: true, type })
    }

    // ── Branch A: client purchase verification ───────────────────────
    const { jws, userId } = body ?? {}
    if (!jws || !userId) {
      return json({ error: 'Missing jws or userId' }, 400)
    }

    const tx = await verifyAppleJWS<AppleTransactionInfo>(jws)

    const expectedBundle = Deno.env.get('APPLE_BUNDLE_ID')
    if (expectedBundle && tx.bundleId && tx.bundleId !== expectedBundle) {
      return json({ error: `Bundle ID mismatch: got ${tx.bundleId}` }, 400)
    }

    if (!PRODUCT_TO_PLAN[tx.productId]) {
      return json({ error: `Unknown product: ${tx.productId}` }, 400)
    }

    const subscription = await applyTransaction(supabase, userId, tx)
    return json({ ok: true, subscription })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('verify-apple-receipt error:', message)
    return json({ error: message }, 500)
  }
})

// Future hardening (not blocking):
//   - Drop notifications older than ~5 minutes (replay protection). Apple's
//     `signedDate` claim is on the outer payload of S2S notifications.
//   - Check cert validity windows (notBefore/notAfter) on the chain. Apple
//     rotates intermediates; an expired one would surface as a verify failure.
