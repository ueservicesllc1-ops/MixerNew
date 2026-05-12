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
        typeof window !== 'undefined' && window.__ZION_DESKTOP_INSTALLER_URL__
            ? String(window.__ZION_DESKTOP_INSTALLER_URL__).trim()
            : '';
    if (fromBuild) return fromBuild;
    return desktopInstallerUrlFromAppVersionDoc(appVersionDoc);
}
