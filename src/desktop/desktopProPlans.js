/**
 * Planes escritorio: los `id` deben existir tal cual en `STRIPE_PLANS_CONFIG` de `b2-proxy.mjs`
 * (mismo endpoint `/api/stripe/create-subscription` que la web).
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
