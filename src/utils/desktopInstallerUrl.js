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

/** En Electron escritorio el aviso de actualización debe usar siempre el enlace del servidor, no `VITE_DESKTOP_INSTALLER_URL` (suele ser otra URL o vacío). */
function isElectronZionDesktopMixer() {
    return typeof window !== 'undefined'
        && window.zionNative?.isDesktop === true
        && !window.Capacitor?.isNativePlatform?.();
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
    // Web / PWA: URL fija de marketing. Electron escritorio: solo Firestore/proxy (evita "URL no válida" al actualizar).
    if (!isElectronZionDesktopMixer() && fromBuild && isUsableHttpsUrl(fromBuild)) return fromBuild;
    const remote = desktopInstallerUrlFromAppVersionDoc(appVersionDoc);
    if (isUsableHttpsUrl(remote)) return remote;
    return '';
}
