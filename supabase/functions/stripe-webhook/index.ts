import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { planFromPriceId } from '../_shared/stripe-plans.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Supa = ReturnType<typeof createClient>

// Which SquadIQ user an event is about. create-checkout stamps
// metadata.supabase_user_id; this used to read metadata.user_id, which is never
// set, so every checkout/update/cancel event was silently ignored and a
// cancelled subscriber kept their plan. The customer id is the fallback for
// subscriptions made before the stamp existed.
async function userIdFor(supabase: Supa, metadata: Stripe.Metadata | null | undefined, customer: unknown): Promise<string | null> {
  const fromMeta = metadata?.supabase_user_id || metadata?.user_id
  if (fromMeta) return fromMeta
  if (typeof customer !== 'string' || !customer) return null
  const { data } = await supabase.from('subscriptions').select('user_id').eq('stripe_customer_id', customer).maybeSingle()
  return (data as { user_id?: string } | null)?.user_id ?? null
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
    console.error('stripe-webhook: signature verification failed', err instanceof Error ? err.message : err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = await userIdFor(supabase, session.metadata, session.customer)
        if (!userId || !session.subscription) break

        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = stripeSubscription.items.data[0]?.price.id ?? ''
        const plan    = planFromPriceId(priceId)
        if (!plan) { console.error('stripe-webhook: unrecognised price', priceId); break }
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
        // Stripe doesn't guarantee event order, so a late 'updated' could land
        // after 'deleted' and reactivate a cancelled plan. Act on Stripe's
        // current state, not the snapshot inside the event.
        const sub     = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id)
        const userId  = await userIdFor(supabase, sub.metadata, sub.customer)
        if (!userId) break

        const priceId   = sub.items.data[0]?.price.id ?? ''
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()
        const patch: Record<string, unknown> = {
          current_period_end: periodEnd,
          status:             sub.status,
          updated_at:         new Date().toISOString(),
        }
        // A subscription Stripe has given up on loses its access; one that is
        // live follows its price. past_due keeps the plan while Stripe retries.
        if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
          patch.plan = 'expired'
        } else if (sub.status === 'active' || sub.status === 'trialing') {
          const plan = planFromPriceId(priceId)
          if (plan) patch.plan = plan
          else console.error('stripe-webhook: unrecognised price', priceId)
        }

        await supabase.from('subscriptions').update(patch).eq('user_id', userId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = await userIdFor(supabase, sub.metadata, sub.customer)
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
    console.error('stripe-webhook error:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'webhook handler failed' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
