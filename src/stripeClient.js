import { loadStripe } from '@stripe/stripe-js';

/**
 * Una sola clave publicable para web y escritorio.
 * Debe ser del mismo modo (test vs live) que `STRIPE_SECRET_KEY` en Railway — no mezclar pk_test con sk_live ni al revés.
 * No se define otra clave secreta en el front; el servidor solo usa `STRIPE_SECRET_KEY`.
 */
const FALLBACK_STRIPE_PUBLISHABLE_KEY =
    'pk_live_51S37NBId1DsVBhR7DBfuwJHCjLo2KzUWPxEKew3JdyI5ypBwgt420B9pXM6qQuHRscOLyNeLjxumZHwVfWdZsMQp003Gc0ne2Y';

function looksLikeStripePublishableKey(k) {
    const s = String(k ?? '').trim();
    return /^pk_(live|test)_[A-Za-z0-9_]+$/.test(s) && s.length >= 50;
}

/**
 * Si `VITE_STRIPE_PUBLISHABLE_KEY` en el build está vacío, mal formado o es un placeholder,
 * Stripe responde "Invalid API Key"; ignoramos eso y usamos el fallback embebido (misma cuenta que antes).
 */
function resolveStripePublishableKey() {
    const fromEnv = String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim();
    if (looksLikeStripePublishableKey(fromEnv)) return fromEnv;
    if (looksLikeStripePublishableKey(FALLBACK_STRIPE_PUBLISHABLE_KEY)) return FALLBACK_STRIPE_PUBLISHABLE_KEY;
    return fromEnv || null;
}

export const STRIPE_PUBLISHABLE_KEY = resolveStripePublishableKey();

export const stripeJsPromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;
