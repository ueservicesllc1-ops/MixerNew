import { loadStripe } from '@stripe/stripe-js';

/**
 * Una sola clave publicable para web y escritorio.
 * Debe ser del mismo modo (test vs live) que `STRIPE_SECRET_KEY` en Railway — no mezclar pk_test con sk_live ni al revés.
 * No se define otra clave secreta en el front; el servidor solo usa `STRIPE_SECRET_KEY`.
 */
export const STRIPE_PUBLISHABLE_KEY =
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    'pk_live_51S37NBId1DsVBhR7DBfuwJHCjLo2KzUWPxEKew3JdyI5ypBwgt420B9pXM6qQuHRscOLyNeLjxumZHwVfWdZsMQp003Gc0ne2Y';

export const stripeJsPromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;
