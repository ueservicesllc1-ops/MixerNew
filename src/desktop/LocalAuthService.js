export const LocalAuthService = {
    // Generate a simple SHA-256 hash for offline verification
    _hashPassword: async (password) => {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    saveLocalUser: async (email, password, userData) => {
        try {
            const hash = await LocalAuthService._hashPassword(password);
            
            // Guardar credenciales para validación offline
            const credentials = {
                email: email.toLowerCase(),
                hash: hash,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('zion_offline_credentials', JSON.stringify(credentials));

            // Guardar perfil de usuario
            if (window.zionNative?.saveUser) {
                await window.zionNative.saveUser(userData);
            }
            localStorage.setItem('zion_offline_user', JSON.stringify(userData));
        } catch (e) {
            console.error("Error saving local user:", e);
        }
    },

    validateOfflineLogin: async (email, password) => {
        try {
            const stored = localStorage.getItem('zion_offline_credentials');
            if (!stored) return false;
            
            const credentials = JSON.parse(stored);
            if (credentials.email !== email.toLowerCase()) return false;

            const inputHash = await LocalAuthService._hashPassword(password);
            return inputHash === credentials.hash;
        } catch (e) {
            console.error("Error validating offline login:", e);
            return false;
        }
    },

    hasLocalUser: () => {
        return !!localStorage.getItem('zion_offline_credentials');
    },

    getLocalUserData: async () => {
        try {
            if (window.zionNative?.getUser) {
                const dbUser = await window.zionNative.getUser();
                if (dbUser) return { ...dbUser, isOffline: true };
            }
            const stored = localStorage.getItem('zion_offline_user');
            return stored ? { ...JSON.parse(stored), isOffline: true } : null;
        } catch (e) {
            return null;
        }
    },

    logout: async () => {
        localStorage.removeItem('zion_offline_credentials');
        localStorage.removeItem('zion_offline_user');
        if (window.zionNative?.deleteUser) {
            await window.zionNative.deleteUser();
        }
    }
};
