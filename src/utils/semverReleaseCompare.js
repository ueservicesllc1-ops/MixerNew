/**
 * Comparación de releases (APK / escritorio): semver por nombre y, si existe,
 * `versionCode` numérico (mayor = más nuevo).
 */

export function parseSemverParts(s) {
    const m = String(s || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return [0, 0, 0];
    return [parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0, parseInt(m[3], 10) || 0];
}

/** Código monotónico para 1.8.58 → 10858 (major*10000 + minor*100 + patch; patch ≤ 99). */
export function semverToVersionCode(versionName) {
    const [maj, min, pat] = parseSemverParts(versionName);
    return maj * 10000 + min * 100 + Math.min(pat, 99);
}

export function isRemoteVersionNewerByName(remoteName, installedName) {
    const a = parseSemverParts(remoteName);
    const b = parseSemverParts(installedName);
    for (let i = 0; i < 3; i++) {
        if (a[i] > b[i]) return true;
        if (a[i] < b[i]) return false;
    }
    return false;
}

/**
 * @param {{ versionName?: string, versionCode?: number|null }} remote
 * @param {{ versionName?: string, versionCode?: number|null }} installed
 */
export function isRemoteReleaseNewer(remote, installed) {
    const rName = String(remote?.versionName || '').trim();
    const iName = String(installed?.versionName || '').trim();
    const rCode = remote?.versionCode != null ? Number(remote.versionCode) : NaN;
    const iCode = installed?.versionCode != null ? Number(installed.versionCode) : NaN;

    if (Number.isFinite(rCode) && rCode > 0 && Number.isFinite(iCode) && iCode > 0) {
        return rCode > iCode;
    }
    if (rName && iName) {
        return isRemoteVersionNewerByName(rName, iName);
    }
    return false;
}
