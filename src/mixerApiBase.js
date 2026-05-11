/**
 * Base URL del proxy/API (mismo criterio que `Dashboard.jsx` y el resto de la web).
 * - localhost / 127.0.0.1 → `b2-proxy` local (p. ej. puerto 3001)
 * - cualquier otro host (producción, Electron file:// con hostname vacío, dominio) → Railway
 */
export function getMixerApiBase() {
    if (typeof window === 'undefined') {
        return 'https://mixernew-production.up.railway.app';
    }
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
        return 'http://localhost:3001';
    }
    return 'https://mixernew-production.up.railway.app';
}
