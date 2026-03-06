import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';

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
    try {
        const file = req.file;
        const b2Filename = req.body.fileName;
        if (!file || !b2Filename) return res.status(400).json({ error: 'Falta archivo' });

        const uploadNode = await getUploadNode();
        const sha1 = crypto.createHash('sha1').update(file.buffer).digest('hex');
        const b2Response = await fetch(uploadNode.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadNode.authorizationToken,
                'X-Bz-File-Name': encodeURI(b2Filename),
                'Content-Type': file.mimetype || 'audio/wav',
                'X-Bz-Content-Sha1': sha1,
                'Content-Length': file.buffer.length
            },
            body: file.buffer
        });
        const b2Data = await b2Response.json();
        const finalUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${encodeURI(b2Filename)}`;
        res.json({ success: true, url: finalUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Error: La aplicación no ha sido compilada (dist/index.html no existe).");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo escuchando en puerto ${PORT}`);
});


