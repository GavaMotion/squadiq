import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.18.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-08-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SOLO_PRICES = [
  Deno.env.get('STRIPE_SOLO_MONTHLY') ?? '',
  Deno.env.get('STRIPE_SOLO_YEARLY')  ?? '',
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { sessionId, userId } = await req.json()

    console.log('Confirming subscription for:', { sessionId, userId })

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    console.log('Session status:', session.status)
    console.log('Payment status:', session.payment_status)

    if (session.status !== 'complete') {
      return new Response(
        JSON.stringify({ error: 'Payment not complete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const subscription = session.subscription as Stripe.Subscription
    const priceId = subscription?.items?.data[0]?.price?.id ?? ''
    const plan = SOLO_PRICES.includes(priceId) ? 'solo' : 'premium'

    console.log('Plan determined:', plan, 'from priceId:', priceId)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabase
      .from('subscriptions')
      .update({
        plan,
        stripe_subscription_id: subscription?.id,
        stripe_customer_id:     session.customer as string,
        current_period_end: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Supabase update error:', error)
      throw error
    }

    console.log('Subscription updated successfully to:', plan)

    return new Response(
      JSON.stringify({ plan, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Confirm subscription error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
