// Platform detection for purchase-policy compliance.
//
// The app ships three ways: a normal web browser, an iOS wrapper (native
// StoreKit), and an Android Trusted Web Activity distributed on Google Play.
// Google Play policy forbids selling digital subscriptions through anything but
// Google Play Billing, so on the Android TWA we must NOT steer users to Stripe
// checkout. This helper identifies that one context.

const TWA_PACKAGE = 'com.gavamotion.squadiq'
const TWA_FLAG = 'sq_is_twa'

// True iff we're running inside the Google-Play-distributed Android TWA.
//
// A verified TWA sets document.referrer to `android-app://<package>` on the
// initial launch navigation. That referrer is only present on the first load,
// so once seen we persist it for the life of the session (the TWA is a single
// long-lived tab; sessionStorage survives in-app reloads but is scoped to the
// tab, so a later plain-browser visit to the same origin won't inherit it).
export function isAndroidTWA() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(TWA_FLAG) === '1') return true
    const ref = document.referrer || ''
    if (ref.startsWith(`android-app://${TWA_PACKAGE}`)) {
      try { sessionStorage.setItem(TWA_FLAG, '1') } catch { /* ignore */ }
      return true
    }
  } catch { /* sessionStorage/referrer unavailable — treat as not-TWA */ }
  return false
}
