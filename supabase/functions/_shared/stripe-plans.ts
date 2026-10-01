// Stripe price ID → plan. Shared by confirm-subscription and stripe-webhook,
// which used to read different env var names and fall back to a paid plan for
// any price they didn't recognise.
//
// The app's current price IDs are built in (they already ship in the app
// bundle, so they are not secret). They are Stripe TEST-mode prices: when
// Stripe goes live, set the live IDs as STRIPE_{SOLO,PREMIUM}_{MONTHLY,YEARLY}
// secrets (either naming style below) or every live checkout is refused as
// "Unknown plan".
function env(...names: string[]): string[] {
  return names.map(n => Deno.env.get(n) ?? '').filter(Boolean)
}

const SOLO = () => [
  'price_1TPC0yFZSbQlVIc94yVxEKFu', // monthly
  'price_1TPC28FZSbQlVIc9CUXeAOPc', // yearly
  ...env('STRIPE_SOLO_MONTHLY_PRICE_ID', 'STRIPE_SOLO_MONTHLY'),
  ...env('STRIPE_SOLO_YEARLY_PRICE_ID',  'STRIPE_SOLO_YEARLY'),
]
const PREMIUM = () => [
  'price_1TPC4fFZSbQlVIc9YPUtXrYK', // monthly
  'price_1TPC5UFZSbQlVIc99ZXLo51n', // yearly
  ...env('STRIPE_PREMIUM_MONTHLY_PRICE_ID', 'STRIPE_PREMIUM_MONTHLY'),
  ...env('STRIPE_PREMIUM_YEARLY_PRICE_ID',  'STRIPE_PREMIUM_YEARLY'),
]

// null = not one of ours. Callers must refuse rather than guess.
export function planFromPriceId(priceId: string): 'solo' | 'premium' | null {
  if (!priceId) return null
  if (SOLO().includes(priceId)) return 'solo'
  if (PREMIUM().includes(priceId)) return 'premium'
  return null
}

export function isKnownPrice(priceId: string): boolean {
  return planFromPriceId(priceId) !== null
}
