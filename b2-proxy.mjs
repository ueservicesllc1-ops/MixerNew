import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegStatic);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5gb' }));
app.use(express.urlencoded({ limit: '5gb', extended: true }));

// Diagnóstico de Frontend
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    console.log("📂 Carpeta 'dist' detectada. Sirviendo aplicación...");
    app.use(express.static(distPath));
} else {
    console.warn("⚠️ Carpeta 'dist' NO encontrada. El frontend no se cargará correctamente.");
}

const B2_KEY_ID = process.env.B2_KEY_ID || '005c2b526be0baa000000000f';
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || 'K0051CrlFQOcyjlNZyFVI3spGLFhxk4';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || 'cc12bbd592366bde909b0a1a';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'mixercur';

// Vars en caché
let b2AuthToken = null;
let b2ApiUrl = null;

async function getB2Auth() {
    if (b2AuthToken && b2ApiUrl) return { apiUrl: b2ApiUrl, token: b2AuthToken };
    console.log("Renovando B2 Auth Token...");
    const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');
    const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: { 'Authorization': `Basic ${credentials}` }
    });
    const data = await res.json();
    b2AuthToken = data.authorizationToken;
    b2ApiUrl = data.apiUrl;
    return { apiUrl: b2ApiUrl, token: b2AuthToken };
}

async function getUploadNode() {
    const { apiUrl, token } = await getB2Auth();
    const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: { 'Authorization': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: B2_BUCKET_ID })
    });
    if (!res.ok) {
        b2AuthToken = null;
        throw new Error('Upload URL fail');
    }
    return res.json();
}

app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'B2 Proxy + Frontend',
    distExists: fs.existsSync(distPath),
    port: PORT
}));

app.get('/download', async (req, res) => {
    try {
        let { url } = req.query;
        if (!url || url === 'undefined' || url === 'null') {
            return res.status(400).json({ error: 'URL inválida' });
        }
        url = url.trim();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`B2 Error ${response.status}`);

        res.set({
            'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        response.body.pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/upload', upload.single('audioFile'), async (req, res) => {
    let tempInputPath = '';
    let tempOutputPath = '';
    try {
        const file = req.file;
        const b2Filename = req.body.fileName;
        if (!file || !b2Filename) return res.status(400).json({ error: 'Falta archivo' });

        const uploadNode = await getUploadNode();

        // Temp paths for ffmpeg conversion
        const tempId = crypto.randomBytes(8).toString('hex');
        const tmpDir = os.tmpdir();
        tempInputPath = path.join(tmpDir, `in_${tempId}`);
        tempOutputPath = path.join(tmpDir, `out_${tempId}.mp3`); // Use .mp3 to match the codec

        // 1. Write original buffer to disk
        fs.writeFileSync(tempInputPath, file.buffer);

        // 2. Transcode to MP3 (Safe Choice)
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(tempInputPath)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .output(tempOutputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });

        // 3. Read MP3 file into buffer
        const mp3Buffer = fs.readFileSync(tempOutputPath);

        // 4. Calculate required B2 metadata (SHA1 and Length)
        const sha1 = crypto.createHash('sha1').update(mp3Buffer).digest('hex');
        const b2Response = await fetch(uploadNode.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadNode.authorizationToken,
                'X-Bz-File-Name': encodeURI(b2Filename),
                'Content-Type': 'audio/mpeg',
                'X-Bz-Content-Sha1': sha1,
                'Content-Length': mp3Buffer.length
            },
            body: mp3Buffer
        });
        const b2Data = await b2Response.json();
        const finalUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${encodeURI(b2Filename)}`;
        res.json({ success: true, url: finalUrl, fileId: b2Data.fileId });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        // 5. Clean up temp files
        if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    }
});

app.post('/delete-file', async (req, res) => {
    try {
        const { fileId, fileName } = req.body;
        if (!fileId || !fileName) return res.status(400).json({ error: 'Falta fileId o fileName' });

        const { apiUrl, token } = await getB2Auth();
        const b2Response = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
            method: 'POST',
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, fileName })
        });

        if (!b2Response.ok) {
            const err = await b2Response.json();
            throw new Error(err.message || 'Error deleting from B2');
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/list-files', async (req, res) => {
    try {
        const { apiUrl, token } = await getB2Auth();
        const b2Response = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
            method: 'POST',
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucketId: B2_BUCKET_ID, maxFileCount: 1000 })
        });

        if (!b2Response.ok) {
            const err = await b2Response.json();
            throw new Error(err.message || 'Error listing files from B2');
        }

        const data = await b2Response.json();
        res.json(data.files);
    } catch (error) {
        console.error("List error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Solución definitiva para SPA en Express 5: Middleware al final de la cadena
app.use((req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Error: La aplicación no ha sido compilada o el archivo dist/index.html no existe.");
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo escuchando en puerto ${PORT}`);
});


