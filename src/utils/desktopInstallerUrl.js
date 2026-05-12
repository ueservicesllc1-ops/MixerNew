function sanitizeInstallerUrlString(s) {
    return String(s ?? '')
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
}

/**
 * Acepta el enlace que guarda Admin (B2 o `/api/download?url=…`).
 * Solo descarta APK evidente por extensión (evita falsos positivos de `includes('.apk')` / `package` en URLs largas).
 */
function isAcceptableWindowsInstallLink(t) {
    const raw = sanitizeInstallerUrlString(t);
    if (!raw) return false;
    let uo;
    try {
        uo = new URL(raw);
    } catch {
        return false;
    }
    const p = uo.protocol.toLowerCase();
    if (p !== 'https:' && p !== 'http:') return false;
    const full = raw.toLowerCase();
    if (full.endsWith('.apk') || /\.apk(\?|#|&)/i.test(full)) return false;
    const inner = uo.searchParams.get('url');
    if (inner) {
        try {
            const dec = decodeURIComponent(inner).toLowerCase();
            if (dec.endsWith('.apk') || /\.apk(\?|#|&)/i.test(dec)) return false;
        } catch {
            /* query interna mal formada: no lo tratamos como APK */
        }
    }
    return true;
}

/** Listo para mostrar / abrir desde Firestore o manifest. */
export function isPlausibleWindowsInstallerHttpsUrl(u) {
    const t = sanitizeInstallerUrlString(u);
    return isAcceptableWindowsInstallLink(t);
}

/** En Electron escritorio el aviso de actualización debe usar siempre el enlace del servidor, no `VITE_DESKTOP_INSTALLER_URL`. */
function isElectronZionDesktopMixer() {
    return typeof window !== 'undefined'
        && window.zionNative?.isDesktop === true
        && !window.Capacitor?.isNativePlatform?.();
}

/**
 * Solo `desktopDownloadUrl` (nunca `downloadUrl`: ahí va el APK u otros).
 */
export function desktopInstallerUrlFromAppVersionDoc(data) {
    if (!data) return '';
    const d = sanitizeInstallerUrlString(data.desktopDownloadUrl);
    if (d && isAcceptableWindowsInstallLink(d)) return d;
    return '';
}

/**
 * Prioridad: `desktopDownloadUrl` del documento → variable de build (solo web/PWA, no Electron).
 */
export function resolveDesktopInstallerDownloadUrl(appVersionDoc) {
    const fromDoc = appVersionDoc && sanitizeInstallerUrlString(appVersionDoc.desktopDownloadUrl);
    if (fromDoc && isAcceptableWindowsInstallLink(fromDoc)) return fromDoc;

    const fromBuild =
        typeof window !== 'undefined' && window.__ZION_DESKTOP_INSTALLER_URL__ != null
            ? sanitizeInstallerUrlString(window.__ZION_DESKTOP_INSTALLER_URL__)
            : '';
    if (!isElectronZionDesktopMixer() && fromBuild && isAcceptableWindowsInstallLink(fromBuild)) return fromBuild;

    return '';
}
