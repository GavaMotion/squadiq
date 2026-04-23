import { loadStripe } from '@stripe/stripe-js';

let stripePromise = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

export const PRICE_IDS = {
  solo: {
    monthly: import.meta.env.VITE_STRIPE_SOLO_MONTHLY,
    yearly:  import.meta.env.VITE_STRIPE_SOLO_YEARLY,
  },
  premium: {
    monthly: import.meta.env.VITE_STRIPE_PREMIUM_MONTHLY,
    yearly:  import.meta.env.VITE_STRIPE_PREMIUM_YEARLY,
  },
};
