export const NativeAudioBridge = {
    play: async () => {
        if (typeof window !== 'undefined' && window.zionNative?.play) {
            await window.zionNative.play();
        }
    },
    pause: async () => {
        if (typeof window !== 'undefined' && window.zionNative?.pause) {
            await window.zionNative.pause();
        }
    },
    stop: async () => {
        if (typeof window !== 'undefined' && window.zionNative?.stop) {
            await window.zionNative.stop();
        }
    },
    seek: async (pos) => {
        if (typeof window !== 'undefined' && window.zionNative?.seek) {
            await window.zionNative.seek(pos);
        }
    },
    loadSong: async (tracks) => {
        if (typeof window !== 'undefined' && window.zionNative?.loadSong) {
            await window.zionNative.loadSong(tracks);
        }
    },
    setTrackVolume: async (id, vol) => {
        if (typeof window !== 'undefined' && window.zionNative?.setTrackVolume) {
            await window.zionNative.setTrackVolume(id, vol);
        }
    },
    setTrackMute: async (id, muted) => {
        if (typeof window !== 'undefined' && window.zionNative?.setTrackMute) {
            await window.zionNative.setTrackMute(id, muted);
        }
    },
    setTrackSolo: async (id, solo) => {
        if (typeof window !== 'undefined' && window.zionNative?.setTrackSolo) {
            await window.zionNative.setTrackSolo(id, solo);
        }
    }
};
