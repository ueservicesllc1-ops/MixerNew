/**
 * Planes escritorio: los `id` deben existir tal cual en `STRIPE_PLANS_CONFIG` de `b2-proxy.mjs`
 * (mismo endpoint `/api/stripe/create-subscription` que la web).
 * `monthlyUsd` / `annualUsd` deben coincidir con los importes en centavos del proxy (199/1990 y 599/5990).
 */
export const DESKTOP_PRO_PLANS = [
    {
        id: 'zion_desktop_pro_local',
        tier: 'pro_local',
        monthlyUsd: 1.99,
        annualUsd: 19.9,
        priceLabel: 'US$1.99',
        period: '/mes',
        title: 'PRO — desde tu PC',
        blurb: 'Usa tus propios multitracks desde tu computador, sin límite en local.',
    },
    {
        id: 'zion_desktop_pro_online',
        tier: 'pro_online',
        monthlyUsd: 5.99,
        annualUsd: 59.9,
        priceLabel: 'US$5.99',
        period: '/mes',
        title: 'PRO Online',
        blurb: 'Incluye acceso al catálogo multitrack en línea de nuestra base de datos.',
    },
    {
        id: 'universal_pro',
        tier: 'pro_online',
        monthlyUsd: 14.99,
        annualUsd: 134.90,
        priceLabel: 'US$14.99',
        period: '/mes',
        title: 'Universal PRO',
        blurb: 'Acceso total en Web, Android y Desktop + Catálogo en línea + 100 GB Cloud Storage.',
    },
];
