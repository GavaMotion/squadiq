import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single()
    if (!sub?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No billing account found' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const { returnUrl } = await req.json().catch(() => ({}))

    // Back to our own app only — any other address would turn a real Stripe
    // page into a phishing redirect. Every platform loads the same web origin.
    const appUrl = Deno.env.get('APP_URL') ?? 'https://squadiq-coach.vercel.app'
    let returnTo = appUrl
    try { if (new URL(returnUrl).origin === new URL(appUrl).origin) returnTo = new URL(returnUrl).href } catch { /* keep appUrl */ }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnTo,
    })

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err: unknown) {
    console.error('customer-portal error:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'Could not open billing portal' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
