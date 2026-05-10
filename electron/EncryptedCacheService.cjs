const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Usamos una clave estática o derivada para el modo offline
const ENCRYPTION_KEY = crypto.createHash('sha256').update('ZionOfflineStage2026').digest(); 
const IV_LENGTH = 16;

class EncryptedCacheService {
    constructor() {
        this.cacheDir = path.join(os.homedir(), '.zion_desktop', 'cache');
        this.tempDir = path.join(os.homedir(), '.zion_desktop', 'temp');
        if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Limpia la carpeta temporal al iniciar o cerrar
    cleanTemp() {
        try {
            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
        } catch (e) {
            console.error("Error cleaning temp directory:", e);
        }
    }

    /**
     * Guarda el buffer cifrado en el disco.
     */
    async saveEncryptedFile(filename, buffer) {
        const filePath = path.join(this.cacheDir, filename + '.zionpack');
        
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        
        let encrypted = cipher.update(buffer);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Guardamos el IV al principio del archivo
        const finalBuffer = Buffer.concat([iv, encrypted]);
        fs.writeFileSync(filePath, finalBuffer);
        return filePath;
    }

    /**
     * Verifica si el archivo cifrado existe
     */
    fileExists(filename) {
        return fs.existsSync(path.join(this.cacheDir, filename + '.zionpack'));
    }

    /**
     * Desencripta a un archivo temporal y devuelve la ruta absoluta
     * JUCE leerá este archivo.
     */
    async getDecryptedTempPath(filename) {
        const encryptedPath = path.join(this.cacheDir, filename + '.zionpack');
        if (!fs.existsSync(encryptedPath)) return null;

        const fileBuffer = fs.readFileSync(encryptedPath);
        if (fileBuffer.length <= IV_LENGTH) return null;

        const iv = fileBuffer.subarray(0, IV_LENGTH);
        const encryptedData = fileBuffer.subarray(IV_LENGTH);

        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedData);
        try {
            decrypted = Buffer.concat([decrypted, decipher.final()]);
        } catch (e) {
            console.error("Error desencriptando archivo:", filename);
            return null;
        }

        const tempFilePath = path.join(this.tempDir, filename);
        fs.writeFileSync(tempFilePath, decrypted);
        return tempFilePath;
    }

    /**
     * Desencripta y devuelve el buffer en memoria.
     */
    async readDecryptedBuffer(filename) {
        const encryptedPath = path.join(this.cacheDir, filename + '.zionpack');
        if (!fs.existsSync(encryptedPath)) return null;

        const fileBuffer = fs.readFileSync(encryptedPath);
        if (fileBuffer.length <= IV_LENGTH) return null;

        const iv = fileBuffer.subarray(0, IV_LENGTH);
        const encryptedData = fileBuffer.subarray(IV_LENGTH);

        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedData);
        try {
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted;
        } catch (e) {
            console.error("Error desencriptando buffer:", filename);
            return null;
        }
    }
}

module.exports = new EncryptedCacheService();
