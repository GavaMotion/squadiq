import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../UI/Toast'
import { supabase } from '../../lib/supabase'
import { PRICE_IDS } from '../../lib/stripe'
import { useApplePay } from '../../hooks/useApplePay'

const PLAN_LABELS = {
  solo:    { title: 'Solo Coach',    subtitle: '1 team · All features' },
  premium: { title: 'Premium Coach', subtitle: 'Up to 4 teams · All features' },
}

// Apple IAP product IDs — must exactly match App Store Connect.
const APPLE_PRODUCT = {
  solo:    { monthly: 'solo_monthly',    yearly: 'solo_yearly'    },
  premium: { monthly: 'premium_monthly', yearly: 'premium_yearly' },
}

// Display fallback when StoreKit hasn't returned products yet.
const APPLE_FALLBACK_PRICE = {
  solo_monthly:    { display: '$5.99',  period: '/month' },
  solo_yearly:     { display: '$59.99', period: '/year'  },
  premium_monthly: { display: '$8.99',  period: '/month' },
  premium_yearly:  { display: '$89.99', period: '/year'  },
}

// Stripe pricing for web / Android — matches the Stripe products configured today.
const STRIPE_DISPLAY_PRICE = {
  solo:    { monthly: { display: '$4.99', period: '/month' }, yearly: { display: '$39.99', period: '/year' } },
  premium: { monthly: { display: '$7.99', period: '/month' }, yearly: { display: '$63.99', period: '/year' } },
}

export default function SubscriptionPage({ isOpen, onClose, isTrialExpired = false }) {
  const { session } = useAuth()
  const { setSubscription } = useApp()
  const { addToast } = useToast()
  const apple = useApplePay()
  const useApple = apple.isAvailable

  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [purchasing,    setPurchasing]    = useState(null)

  if (!isOpen) return null

  const user = session?.user

  function priceFor(planKey) {
    if (useApple) {
      const productId = APPLE_PRODUCT[planKey][billingPeriod]
      const live = apple.products.find(p => p.id === productId)
      if (live?.price) return { display: live.price, period: billingPeriod === 'monthly' ? '/month' : '/year' }
      return APPLE_FALLBACK_PRICE[productId]
    }
    return STRIPE_DISPLAY_PRICE[planKey][billingPeriod]
  }

  async function handleAppleBuy(planKey) {
    if (!user?.id) { addToast('Not logged in', 'error'); return }
    const productId = APPLE_PRODUCT[planKey][billingPeriod]
    setPurchasing(planKey)
    try {
      const result = await apple.purchase(productId)

      if (result.status === 'cancelled') return
      if (result.status === 'pending') {
        addToast('Purchase pending — we’ll activate your plan once approved.', 'info', 4500)
        return
      }

      addToast('Verifying purchase…', 'info', 2500)
      const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { jws: result.jws, productId: result.productId, userId: user.id },
      })
      if (error) throw error
      if (data?.subscription) setSubscription(data.subscription)

      addToast(
        `Welcome to SquadIQ ${planKey === 'premium' ? 'Premium' : 'Solo'} Coach! 🎉`,
        'success', 5000,
      )
      onClose?.()
    } catch (err) {
      console.error('Apple purchase error:', err)
      addToast(err.message || 'Purchase failed — please try again', 'error', 5000)
    } finally {
      setPurchasing(null)
    }
  }

  async function handleStripeBuy(planKey) {
    const priceId = PRICE_IDS[planKey]?.[billingPeriod]
    if (!priceId) { addToast(`No price ID found for ${planKey} ${billingPeriod}`, 'error'); return }
    if (!user?.id) { addToast('Not logged in', 'error'); return }

    setPurchasing(planKey)
    try {
      addToast('Redirecting to checkout…', 'info', 3000)
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId,
          userId:     user.id,
          userEmail:  user.email,
          successUrl: 'https://squadiq-coach.vercel.app',
          cancelUrl:  'https://squadiq-coach.vercel.app',
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('No checkout URL returned')
      window.location.href = data.url
    } catch (err) {
      console.error('Stripe checkout error:', err)
      addToast('Could not start checkout — please try again', 'error')
      setPurchasing(null)
    }
  }

  const buy = useApple ? handleAppleBuy : handleStripeBuy

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99990, padding: 24,
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.2)',
        borderRadius: 20, padding: 32, width: '100%', maxWidth: 380,
        display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36 }}>🏆</div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
          {isTrialExpired ? 'Your trial has ended' : 'Upgrade SquadIQ'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>
          {isTrialExpired
            ? 'Subscribe to continue coaching with SquadIQ'
            : 'Choose a plan to unlock more teams'}
        </div>

        {/* Billing period toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, gap: 2 }}>
          {['monthly', 'yearly'].map(period => (
            <button
              key={period}
              onClick={() => setBillingPeriod(period)}
              disabled={!!purchasing}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                cursor: purchasing ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: billingPeriod === period ? '#00c853' : 'none',
                color:      billingPeriod === period ? '#fff'    : 'rgba(255,255,255,0.45)',
              }}
            >
              {period === 'monthly' ? 'Monthly' : 'Yearly · save 17%'}
            </button>
          ))}
        </div>

        {['solo', 'premium'].map(planKey => {
          const price  = priceFor(planKey)
          const labels = PLAN_LABELS[planKey]
          const featured = planKey === 'premium'
          const busy = purchasing === planKey
          return (
            <div key={planKey} style={{
              background: featured ? 'rgba(0,200,83,0.05)' : 'rgba(255,255,255,0.05)',
              border: featured ? '1px solid rgba(0,200,83,0.3)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 16, textAlign: 'left', position: 'relative',
            }}>
              {featured && (
                <div style={{
                  position: 'absolute', top: -10, right: 16,
                  background: '#00c853', color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                }}>
                  BEST VALUE
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{labels.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{labels.subtitle}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#00c853', fontSize: 18, fontWeight: 700 }}>{price.display}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{price.period}</div>
                </div>
              </div>
              <button
                onClick={() => buy(planKey)}
                disabled={!!purchasing}
                style={{
                  marginTop: 12, width: '100%',
                  background: '#00c853', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '10px',
                  fontSize: 14, fontWeight: 600,
                  cursor: purchasing ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy
                  ? (useApple ? 'Processing…' : 'Opening checkout…')
                  : `Choose ${labels.title} — ${price.display}${price.period}`}
              </button>
            </div>
          )
        })}

        {useApple ? (
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.6, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              Subscription terms
            </div>
            Payment will be charged to your Apple ID at confirmation of purchase.
            Subscriptions automatically renew unless auto-renew is turned off at
            least 24 hours before the end of the current period. Your account
            will be charged for renewal within 24 hours prior to the end of the
            current period. You can manage and cancel subscriptions in your
            Account Settings on the App Store after purchase.
            <div style={{ marginTop: 8 }}>
              <a
                href="https://squadiq-coach.vercel.app/terms.html"
                target="_blank"
                rel="noopener"
                style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'underline', marginRight: 12 }}
              >
                Terms of Use (EULA)
              </a>
              <a
                href="https://squadiq-coach.vercel.app/privacy.html"
                target="_blank"
                rel="noopener"
                style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'underline' }}
              >
                Privacy Policy
              </a>
            </div>
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
            Secure payment via Stripe · Cancel anytime
          </div>
        )}

        {useApple && (
          <button
            onClick={async () => {
              try {
                await apple.restore()
                addToast('Purchases restored', 'success', 3000)
              } catch (err) {
                addToast(err.message || 'Could not restore purchases', 'error', 4000)
              }
            }}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.55)', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Restore purchases
          </button>
        )}

        {!isTrialExpired && (
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer',
            }}
          >
            Not now
          </button>
        )}
      </div>
    </div>
  )
}
