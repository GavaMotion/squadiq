import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Map Stripe price IDs → plan names
function planFromPriceId(priceId: string): string {
  const soloMonthly   = Deno.env.get('STRIPE_SOLO_MONTHLY_PRICE_ID')   ?? ''
  const soloYearly    = Deno.env.get('STRIPE_SOLO_YEARLY_PRICE_ID')    ?? ''
  const premiumMonthly = Deno.env.get('STRIPE_PREMIUM_MONTHLY_PRICE_ID') ?? ''
  const premiumYearly  = Deno.env.get('STRIPE_PREMIUM_YEARLY_PRICE_ID')  ?? ''
  if (priceId === soloMonthly || priceId === soloYearly) return 'solo'
  if (priceId === premiumMonthly || priceId === premiumYearly) return 'multi'
  return 'solo'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2023-10-16' })
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.user_id
        if (!userId || !session.subscription) break

        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = stripeSubscription.items.data[0]?.price.id ?? ''
        const plan    = planFromPriceId(priceId)
        const periodEnd = new Date((stripeSubscription as any).current_period_end * 1000).toISOString()

        await supabase.from('subscriptions').update({
          plan,
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id:     session.customer as string,
          current_period_end:     periodEnd,
          status:                 'active',
          updated_at:             new Date().toISOString(),
        }).eq('user_id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const sub     = event.data.object as Stripe.Subscription
        const userId  = sub.metadata?.user_id
        if (!userId) break

        const priceId   = sub.items.data[0]?.price.id ?? ''
        const plan      = planFromPriceId(priceId)
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()
        const status    = sub.status === 'active' ? 'active' : sub.status

        await supabase.from('subscriptions').update({
          plan,
          current_period_end: periodEnd,
          status,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id
        if (!userId) break

        await supabase.from('subscriptions').update({
          plan:       'expired',
          status:     'canceled',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice  = event.data.object as Stripe.Invoice
        const customer = invoice.customer as string
        if (!customer) break

        const { data: sub } = await supabase.from('subscriptions').select('user_id').eq('stripe_customer_id', customer).single()
        if (sub?.user_id) {
          await supabase.from('subscriptions').update({
            status:     'past_due',
            updated_at: new Date().toISOString(),
          }).eq('user_id', sub.user_id)
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
