export const LicenseManager = {
    getLicenseStatus: async () => {
        if (typeof window !== 'undefined' && window.zionNative?.getLicense) {
            return await window.zionNative.getLicense();
        }
        return null;
    },
    activateSerial: async (serial) => {
        // Validación local de serial (placeholder para lógica real)
        const isValid = serial && serial.length >= 8;
        if (isValid && typeof window !== 'undefined' && window.zionNative?.saveLicense) {
            await window.zionNative.saveLicense(serial, 'pro');
            return true;
        }
        return false;
    },
    isDemo: async () => {
        const lic = await LicenseManager.getLicenseStatus();
        return !lic || lic.mode === 'demo';
    },
    getLimits: async () => {
        const demo = await LicenseManager.isDemo();
        if (demo) {
            return { maxSongs: 3, maxSetlists: 1 };
        }
        return { maxSongs: Infinity, maxSetlists: Infinity };
    }
};
