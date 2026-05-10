/**
 * Planes de suscripción escritorio. Los `id` se envían a `/api/stripe/create-subscription`
 * (Railway). Hay que mapear cada id a un Price ID de Stripe en el backend.
 */
export const DESKTOP_PRO_PLANS = [
    {
        id: 'zion_desktop_pro_local',
        tier: 'pro_local',
        priceLabel: 'US$1.99',
        period: '/mes',
        title: 'PRO — desde tu PC',
        blurb: 'Usa tus propios multitracks desde tu computador, sin límite en local.',
    },
    {
        id: 'zion_desktop_pro_online',
        tier: 'pro_online',
        priceLabel: 'US$5.99',
        period: '/mes',
        title: 'PRO Online',
        blurb: 'Incluye acceso al catálogo multitrack en línea de nuestra base de datos.',
    },
];

export function getStripeApiBase() {
    if (typeof window === 'undefined') return 'https://mixernew-production.up.railway.app';
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : 'https://mixernew-production.up.railway.app';
}
