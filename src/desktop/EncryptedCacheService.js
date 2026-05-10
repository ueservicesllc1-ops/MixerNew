export const EncryptedCacheService = {
    saveStem: async (songId, stemName, buffer) => {
        // Implementación local en Desktop
        // Normalmente esto enviaría los datos a un endpoint de main.cjs que guarde en disco cifrado
        if (typeof window !== 'undefined' && window.zionNative?.saveStem) {
            return await window.zionNative.saveStem(songId, stemName, buffer);
        }
        return false;
    },
    getStem: async (songId, stemName) => {
        if (typeof window !== 'undefined' && window.zionNative?.getStem) {
            return await window.zionNative.getStem(songId, stemName);
        }
        return null;
    }
};
