const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zionNative', {
    // Audio
    play: () => ipcRenderer.send('audio:play'),
    pause: () => ipcRenderer.send('audio:pause'),
    stop: () => ipcRenderer.send('audio:stop'),
    seek: (pos) => ipcRenderer.send('audio:seek', pos),
    loadSong: (tracks) => ipcRenderer.invoke('audio:load', tracks),
    getSnapshot: () => ipcRenderer.invoke('audio:get-snapshot'),
    setPitchSemitones: (semi) => ipcRenderer.invoke('audio:set-pitch', semi),
    setTempoRatio: (ratio) => ipcRenderer.invoke('audio:set-tempo', ratio),
    setTrackVolume: (id, vol) => ipcRenderer.send('audio:set-volume', id, vol),
    setTrackMute: (id, muted) => ipcRenderer.send('audio:set-mute', id, muted),
    setTrackSolo: (id, solo) => ipcRenderer.send('audio:set-solo', id, solo),
    getHardwareId: () => ipcRenderer.invoke('audio:get-hwid'),
    
    // Base de Datos Local (OFFLINE)
    getSongs: () => ipcRenderer.invoke('db:get-songs'),
    getSong: (id) => ipcRenderer.invoke('db:get-song', id),
    saveSong: (song) => ipcRenderer.invoke('db:save-song', song),
    deleteSong: (id) => ipcRenderer.invoke('db:delete-song', id),
    getSetlists: () => ipcRenderer.invoke('db:get-setlists'),
    saveSetlist: (sl) => ipcRenderer.invoke('db:save-setlist', sl),
    
    // Licencia
    getLicense: () => ipcRenderer.invoke('db:get-license'),
    saveLicense: (serial, mode) => ipcRenderer.invoke('db:save-license', serial, mode),
    
    // Usuario Híbrido (Offline-First)
    getUser: () => ipcRenderer.invoke('db:get-user'),
    saveUser: (user) => ipcRenderer.invoke('db:save-user', user),
    deleteUser: () => ipcRenderer.invoke('db:delete-user'),
    
    // Encrypted Cache
    saveEncryptedTrack: (filename, buffer) => ipcRenderer.invoke('cache:save', filename, buffer),
    readEncryptedTrack: (filename) => ipcRenderer.invoke('cache:read', filename),
    isTrackDownloaded: (filename) => ipcRenderer.invoke('cache:exists', filename),
    
    isDesktop: true
});

contextBridge.exposeInMainWorld('electronAPI', {
    isDesktop: true,
    play: () => ipcRenderer.send('audio:play'),
    pause: () => ipcRenderer.send('audio:pause'),
    stop: () => ipcRenderer.send('audio:stop'),
    seek: (pos) => ipcRenderer.send('audio:seek', pos),
    loadSong: (tracks) => ipcRenderer.invoke('audio:load', tracks),
    getSnapshot: () => ipcRenderer.invoke('audio:get-snapshot'),
    setPitchSemitones: (semi) => ipcRenderer.invoke('audio:set-pitch', semi),
    setTempoRatio: (ratio) => ipcRenderer.invoke('audio:set-tempo', ratio),
    setTrackVolume: (id, vol) => ipcRenderer.send('audio:set-volume', id, vol),
    setTrackMute: (id, muted) => ipcRenderer.send('audio:set-mute', id, muted),
    setTrackSolo: (id, solo) => ipcRenderer.send('audio:set-solo', id, solo),
});
