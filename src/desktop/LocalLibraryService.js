export const LocalLibraryService = {
    getSongs: async () => {
        if (typeof window !== 'undefined' && window.zionNative?.getSongs) {
            const raw = await window.zionNative.getSongs();
            return raw.map(r => ({
                ...r,
                tracks: r.tracks_json ? JSON.parse(r.tracks_json) : []
            }));
        }
        return [];
    },
    addSong: async (song) => {
        if (typeof window !== 'undefined' && window.zionNative?.saveSong) {
            await window.zionNative.saveSong(song);
            return true;
        }
        return false;
    },
    deleteSong: async (id) => {
        if (typeof window !== 'undefined' && window.zionNative?.deleteSong) {
            await window.zionNative.deleteSong(id);
            return true;
        }
        return false;
    },
    getSetlists: async () => {
        if (typeof window !== 'undefined' && window.zionNative?.getSetlists) {
            const raw = await window.zionNative.getSetlists();
            return raw.map(r => ({
                ...r,
                songs: r.songs_json ? JSON.parse(r.songs_json) : []
            }));
        }
        return [];
    },
    saveSetlist: async (setlist) => {
        if (typeof window !== 'undefined' && window.zionNative?.saveSetlist) {
            await window.zionNative.saveSetlist(setlist);
            return true;
        }
        return false;
    }
};
