const DEFAULT_PUBLIC_PROXY = 'https://mixernew-production.up.railway.app';

function viteB2ProxyBase() {
    const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_B2_PROXY_URL : '';
    const u = raw && String(raw).trim();
    if (u && /^https?:\/\//i.test(u)) return u.replace(/\/$/, '');
    return '';
}

/**
 * Base URL del proxy/API (mismo criterio que `Dashboard.jsx` y el resto de la web).
 * - localhost / 127.0.0.1 → `b2-proxy` local (puerto 3001; la UI en dev suele ser Vite :3000)
 * - producción: `VITE_B2_PROXY_URL` en el build si existe; si no, dominio Railway por defecto.
 */
export function getMixerApiBase() {
    if (typeof window === 'undefined') {
        return viteB2ProxyBase() || DEFAULT_PUBLIC_PROXY;
    }
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
        return 'http://localhost:3001';
    }
    return viteB2ProxyBase() || DEFAULT_PUBLIC_PROXY;
}

/**
 * Orígenes para pedir `app-latest-desktop` (y similares): proxy configurado, mismo host que la página
 * (un solo servicio en Railway sirve Vite `dist` + b2-proxy), fallback público.
 */
export function getMixerApiBaseCandidates() {
    const out = [];
    const push = (b) => {
        const s = b && String(b).trim().replace(/\/$/, '');
        if (!s || !/^https?:\/\//i.test(s)) return;
        if (!out.includes(s)) out.push(s);
    };
    push(getMixerApiBase());
    if (typeof window !== 'undefined' && window.location?.origin && !/^file:/i.test(window.location.origin)) {
        push(window.location.origin);
    }
    push(DEFAULT_PUBLIC_PROXY);
    return out;
}
