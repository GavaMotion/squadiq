import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isKnownPrice } from '../_shared/stripe-plans.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://squadiq-coach.vercel.app'

// Stripe sends the buyer back to whatever URL we hand it, so only our own app
// is allowed — anything else would make a real Stripe page a phishing redirect.
function safeReturnUrl(url: unknown): string {
  try {
    const u = new URL(String(url))
    if (u.origin === new URL(APP_URL).origin) return u.origin + u.pathname
  } catch { /* fall through */ }
  return APP_URL
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2023-10-16' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })

    const { priceId, successUrl, cancelUrl } = await req.json()
    // Only our own prices: otherwise any recurring price in the Stripe account
    // (a cheap or retired one) could be checked out.
    if (!isKnownPrice(String(priceId ?? ''))) {
      return new Response(JSON.stringify({ error: 'Unknown plan' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Look up or create Stripe customer
    const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single()
    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } })
      customerId = customer.id
      await supabase.from('subscriptions').update({ stripe_customer_id: customerId }).eq('user_id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${safeReturnUrl(successUrl)}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  safeReturnUrl(cancelUrl),
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    })

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err: unknown) {
    console.error('create-checkout error:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'Could not start checkout' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
