const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'zion_stage.db');
const db = new Database(dbPath);

// Inicializar Tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        name TEXT,
        artist TEXT,
        tempo INTEGER,
        key TEXT,
        tracks_json TEXT,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY,
        name TEXT,
        songs_json TEXT,
        synced INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS license (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        serial TEXT,
        mode TEXT DEFAULT 'demo'
    );

    CREATE TABLE IF NOT EXISTS audio_routing_prefs (
        user_uid TEXT PRIMARY KEY,
        prefs_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS song_maps (
        song_id TEXT PRIMARY KEY,
        map_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// MIGRACIONES DE ESQUEMA AUTOMÁTICAS
try {
    db.exec(`ALTER TABLE setlists ADD COLUMN synced INTEGER DEFAULT 1;`);
} catch (e) {
    // Si la columna ya existe, SQLite lanzará un error que ignoramos.
}
try {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
} catch (e) {}

module.exports = {
    // Canciones
    saveSong: (song) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO songs (id, name, artist, tempo, key, tracks_json) VALUES (?, ?, ?, ?, ?, ?)');
        let payload = song.tracks;
        if (Array.isArray(payload)) {
            payload = {
                version: 1,
                downloaded: song.downloaded !== false,
                previewMixLocalPath: song.previewMixLocalPath ?? null,
                tracks: payload,
            };
        }
        return stmt.run(song.id, song.name, song.artist, song.tempo, song.key, JSON.stringify(payload));
    },
    getSongs: () => db.prepare('SELECT * FROM songs').all(),
    getSong: (id) => db.prepare('SELECT * FROM songs WHERE id = ?').get(id),
    deleteSong: (id) => db.prepare('DELETE FROM songs WHERE id = ?').run(id),

    // Setlists
    saveSetlist: (sl) => {
        if (sl._delete) {
            return db.prepare('DELETE FROM setlists WHERE id = ?').run(sl.id);
        }
        const synced = sl.synced !== undefined ? (sl.synced ? 1 : 0) : 1;
        const stmt = db.prepare('INSERT OR REPLACE INTO setlists (id, name, songs_json, synced) VALUES (?, ?, ?, ?)');
        return stmt.run(sl.id, sl.name, JSON.stringify(sl.songs), synced);
    },
    getSetlists: () => db.prepare('SELECT * FROM setlists').all(),

    // Usuarios (Híbrido)
    saveUser: (user) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO users (uid, email, display_name) VALUES (?, ?, ?)');
        return stmt.run(user.uid, user.email, user.displayName);
    },
    getUser: () => db.prepare('SELECT * FROM users ORDER BY last_login DESC LIMIT 1').get(),
    deleteUser: () => db.prepare('DELETE FROM users').run(),

    // Licencia
    getLicense: () => db.prepare('SELECT * FROM license WHERE id = 1').get(),
    saveLicense: (serial, mode) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO license (id, serial, mode) VALUES (1, ?, ?)');
        return stmt.run(serial, mode);
    },

    getAudioRoutingPrefs: (userUid) => {
        const uid = userUid || '__guest__';
        const row = db.prepare('SELECT prefs_json FROM audio_routing_prefs WHERE user_uid = ?').get(uid);
        return row?.prefs_json ?? null;
    },
    saveAudioRoutingPrefs: (userUid, prefsJson) => {
        const uid = userUid || '__guest__';
        const stmt = db.prepare('INSERT OR REPLACE INTO audio_routing_prefs (user_uid, prefs_json) VALUES (?, ?)');
        return stmt.run(uid, typeof prefsJson === 'string' ? prefsJson : JSON.stringify(prefsJson));
    },

    getSongMap: (songId) => {
        if (!songId) return null;
        const row = db.prepare('SELECT map_json FROM song_maps WHERE song_id = ?').get(songId);
        return row?.map_json ?? null;
    },
    saveSongMap: (songId, mapJson) => {
        if (!songId || !mapJson) return null;
        const stmt = db.prepare('INSERT OR REPLACE INTO song_maps (song_id, map_json) VALUES (?, ?)');
        return stmt.run(songId, typeof mapJson === 'string' ? mapJson : JSON.stringify(mapJson));
    },
};
