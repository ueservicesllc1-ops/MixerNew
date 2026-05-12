function sanitizeInstallerUrlString(s) {
    return String(s ?? '')
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
}

function isUsableHttpsUrl(s) {
    const t = sanitizeInstallerUrlString(s);
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
    const d = sanitizeInstallerUrlString(data.desktopDownloadUrl);
    if (d && isUsableHttpsUrl(d)) return d;
    const u = sanitizeInstallerUrlString(data.downloadUrl);
    if (!u) return '';
    /** Instalador vía proxy B2 (el .exe va en el query `url=`). */
    if (/^https:\/\//i.test(u) && /\/api\/download\?/i.test(u) && /url=/i.test(u)) return u;
    if (/\.exe(\?|$)/i.test(u)) return u;
    return '';
}

/**
 * Prioridad: `desktopDownloadUrl` del documento (Firestore) → global Vite (solo web/PWA) → `downloadUrl` (.exe / proxy).
 */
export function resolveDesktopInstallerDownloadUrl(appVersionDoc) {
    // Siempre preferir `desktopDownloadUrl` del documento (Firestore / Landing) sobre Vite: el global suele ser otra página, no el .exe.
    const fromDoc = appVersionDoc && sanitizeInstallerUrlString(appVersionDoc.desktopDownloadUrl);
    if (fromDoc && isUsableHttpsUrl(fromDoc)) return fromDoc;

    const fromBuild =
        typeof window !== 'undefined' && window.__ZION_DESKTOP_INSTALLER_URL__ != null
            ? sanitizeInstallerUrlString(window.__ZION_DESKTOP_INSTALLER_URL__)
            : '';
    if (!isElectronZionDesktopMixer() && fromBuild && isUsableHttpsUrl(fromBuild)) return fromBuild;

    const remote = desktopInstallerUrlFromAppVersionDoc(appVersionDoc);
    if (isUsableHttpsUrl(remote)) return remote;
    return '';
}
