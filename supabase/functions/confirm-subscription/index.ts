import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.18.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { planFromPriceId } from '../_shared/stripe-plans.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-08-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Who is asking comes from their login, never from the request body. A
    // body userId let anyone holding one paid session upgrade any account.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return reply({ error: 'Unauthorized' }, 401)

    const { sessionId } = await req.json()
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return reply({ error: 'Bad session' }, 400)
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    // The session must have been opened by this same user (create-checkout
    // stamps it), so a session cannot be replayed onto another account.
    if (session.metadata?.supabase_user_id !== user.id) {
      return reply({ error: 'This checkout belongs to another account' }, 403)
    }
    if (session.status !== 'complete') {
      return reply({ error: 'Payment not complete' }, 400)
    }

    const subscription = session.subscription as Stripe.Subscription
    // A checkout session stays 'complete' forever, so on its own it proves
    // only that a payment once happened. The subscription it created must
    // still be live, or a cancelled subscriber could replay their old session
    // and get the plan back.
    if (subscription?.status !== 'active' && subscription?.status !== 'trialing') {
      return reply({ error: 'This subscription is no longer active' }, 400)
    }
    const priceId = subscription?.items?.data[0]?.price?.id ?? ''
    const plan = planFromPriceId(priceId)
    if (!plan) {
      console.error('confirm-subscription: unrecognised price', priceId)
      return reply({ error: 'Unrecognised plan' }, 400)
    }

    const { error } = await supabase
      .from('subscriptions')
      .update({
        plan,
        status:                 'active',
        stripe_subscription_id: subscription?.id,
        stripe_customer_id:     session.customer as string,
        current_period_end: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('Supabase update error:', error.message)
      return reply({ error: 'Could not save subscription' }, 500)
    }

    return reply({ plan, success: true })

  } catch (error: unknown) {
    console.error('Confirm subscription error:', error instanceof Error ? error.message : String(error))
    return reply({ error: 'Could not confirm subscription' }, 400)
  }
})
