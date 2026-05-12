function isUsableHttpsUrl(s) {
    const t = String(s || '').trim();
    if (!t) return false;
    try {
        const u = new URL(t);
        return u.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * URL del instalador Windows (.exe) desde documento `app_versions` (Firestore).
 */
export function desktopInstallerUrlFromAppVersionDoc(data) {
    if (!data) return '';
    const d = String(data.desktopDownloadUrl ?? '').trim();
    if (d) return d;
    const u = String(data.downloadUrl ?? '').trim();
    if (/\.exe(\?|$)/i.test(u)) return u;
    return '';
}

/**
 * Prioridad: URL inyectada en el build (index / Vite) → metadato remoto `app_versions`.
 */
export function resolveDesktopInstallerDownloadUrl(appVersionDoc) {
    const fromBuild =
        typeof window !== 'undefined' && window.__ZION_DESKTOP_INSTALLER_URL__ != null
            ? String(window.__ZION_DESKTOP_INSTALLER_URL__).trim()
            : '';
    // Si Vite inyectó una URL rota o vacía, no bloquear el enlace remoto (proxy / Firestore).
    if (fromBuild && isUsableHttpsUrl(fromBuild)) return fromBuild;
    const remote = desktopInstallerUrlFromAppVersionDoc(appVersionDoc);
    if (isUsableHttpsUrl(remote)) return remote;
    return '';
}
