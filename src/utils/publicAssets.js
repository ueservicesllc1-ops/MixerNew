/**
 * URLs de archivos en `public/` compatibles con Electron (`file://`) y Vite `base: './'`.
 * Evita `/logo.png` (absoluto al disco) → ERR_FILE_NOT_FOUND en escritorio.
 */
export function publicAssetUrl(filename) {
    const name = String(filename).replace(/^\//, '');
    return `${import.meta.env.BASE_URL}${name}`;
}

/** Logo blanco oficial: coloca `public/logo2blanco.png` (misma pieza que siempre usó la app). */
export const LOGO_BLANCO_PNG = publicAssetUrl('logo2blanco.png');
/** Logo oscuro para fondos claros (`public/logo2.png`). */
export const LOGO_NEGRO_PNG = publicAssetUrl('logo2.png');
