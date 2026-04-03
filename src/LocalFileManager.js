import localforage from 'localforage';

// Configuramos una base de datos local en el navegador/app con alta capacidad (IndexDB)
const localAudioStore = localforage.createInstance({
    name: 'MultitrackOmniPlay',
    storeName: 'audio_blobs',
    description: 'ALmacenamiento pesado para archivos WAV y MP3 descargados'
});

export const LocalFileManager = {
    /**
     * Guarda un buffer de audio localmente
     * @param {string} songId El ID de la canción
     * @param {string} trackName El nombre del track (Ej. "Drums")
     * @param {ArrayBuffer} audioData Los datos RAW del audio
     */
    saveTrackLocal: async (songId, trackId, arrayBuffer) => {
        try {
            const key = `${songId}_${trackId}`;
            await localAudioStore.setItem(key, arrayBuffer);
            console.log(`[STORAGE] Pista local guardada exitosamente: ${key}`);
            return true;
        } catch (error) {
            console.error('[STORAGE] Error guardando archivo pesado local:', error);
            throw error;
        }
    },

    /**
     * Recupera un track desde el disco duro/memoria local
     */
    getTrackLocal: async (songId, trackId) => {
        try {
            const key = `${songId}_${trackId}`;
            const buffer = await localAudioStore.getItem(key);
            if (buffer) {
                console.log(`[STORAGE] Pista LEIDA desde caché local: ${key}`);
                return buffer; // Devuelve el ArrayBuffer pesadísimo sin usar internet
            }
            return null; // Return null if not downloaded yet
        } catch (error) {
            console.error('[STORAGE] Error leyendo caché local:', error);
            return null;
        }
    },

    /**
     * Revisa si una canción entera ya está descargada
     * Esto será útil para colorear el botón "Descartar" o "Descargar"
     */
    isSongDownloaded: async (songId, expectedTracksCount) => {
        try {
            const keys = await localAudioStore.keys();
            const songKeys = keys.filter(k => k.startsWith(`${songId}_`));

            // Si tiene igual o mayor cantidad de llaves, asumimos que está lista
            return songKeys.length >= expectedTracksCount && expectedTracksCount > 0;
        } catch (err) {
            console.error('Error in isSongDownloaded:', err);
            return false;
        }
    },

    /**
     * Borra una canción del disco del dispositivo para ahorrar memoria
     */
    deleteSongLocal: async (songId) => {
        try {
            const keys = await localAudioStore.keys();
            const songKeys = keys.filter(k => k.startsWith(`${songId}_`));

            for (const key of songKeys) {
                await localAudioStore.removeItem(key);
            }
            console.log(`[STORAGE] Se eliminó la canción ${songId} enteramente del dispositivo.`);
            return true;
        } catch (error) {
            console.error('Error eliminando:', error);
            return false;
        }
    },

    removeTrackLocal: async (songId, trackId) => {
        try {
            const key = `${songId}_${trackId}`;
            await localAudioStore.removeItem(key);
            console.log(`[STORAGE] Pista local eliminada: ${key}`);
            return true;
        } catch (error) {
            console.error('[STORAGE] Error eliminando pista local:', error);
            return false;
        }
    },

    /**
     * Guarda datos de texto como Letras o Acordes offline
     * @param {string} songId El ID de la canción
     * @param {string} type 'lyrics' o 'chords'
     * @param {string} text El texto a guardar
     */
    saveTextLocal: async (songId, type, text) => {
        try {
            const key = `text_${type}_${songId}`;
            await localAudioStore.setItem(key, text);
            console.log(`[STORAGE] Texto offline guardado: ${key}`);
            return true;
        } catch (error) {
            console.error('[STORAGE] Error guardando texto offline:', error);
            return false;
        }
    },

    /**
     * Recupera texto de Letras o Acordes estando offline
     */
    getTextLocal: async (songId, type) => {
        try {
            const key = `text_${type}_${songId}`;
            return await localAudioStore.getItem(key);
        } catch (error) {
            console.error('[STORAGE] Error recuperando texto offline:', error);
            return null;
        }
    }
};
