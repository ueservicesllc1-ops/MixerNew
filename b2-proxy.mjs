import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import crypto from 'crypto';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5gb' }));
app.use(express.urlencoded({ limit: '5gb', extended: true }));

const B2_KEY_ID = process.env.B2_KEY_ID || '005c2b526be0baa000000000f';
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || 'K0051CrlFQOcyjlNZyFVI3spGLFhxk4';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || 'cc12bbd592366bde909b0a1a';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'mixercur';

// Vars en caché
let b2AuthToken = null;
let b2ApiUrl = null;

// Func. Auxiliar de B2
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
        b2AuthToken = null; // force renewal next time
        throw new Error('Upload URL fail');
    }
    return res.json();
}

app.get('/download', async (req, res) => {
    try {
        let { url } = req.query;
        if (!url || url === 'undefined' || url === 'null') {
            console.error('❌ Intento de descarga con URL inválida:', url);
            return res.status(400).json({ error: 'URL de descarga faltante o inválida' });
        }
        url = url.trim();

        // Basic URL validation
        try {
            new URL(url);
        } catch (e) {
            console.error('❌ URL malformada:', url);
            return res.status(400).json({ error: 'URL malformada' });
        }

        console.log('📥 Proxying B2 Download:', url);

        // Intentar la descarga
        let response;
        try {
            response = await fetch(url);
        } catch (fetchError) {
            console.error(`❌ Error de red al intentar fetch(${url}):`, fetchError.message);
            return res.status(500).json({ error: `Error de red: ${fetchError.message}`, url });
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ B2 Error ${response.status} en URL: ${url}`);
            console.error(`Detalle: ${errText.substring(0, 200)}`);

            // Si es un error 401/403, es probable que el bucket sea privado
            if (response.status === 401 || response.status === 403) {
                return res.status(response.status).json({
                    error: 'Acceso denegado a B2. ¿Es el bucket privado?',
                    status: response.status,
                    url
                });
            }

            return res.status(response.status).json({
                error: `B2 respondió con estado ${response.status}`,
                detail: errText.substring(0, 100),
                url
            });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Pass through headers and stream
        res.set({
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        // We pipe the stream directly for better performance
        response.body.pipe(res);

    } catch (error) {
        console.error('Download unexpected error:', error);
        res.status(500).json({ error: error.message });
    }
});

// NUEVO: Endpoint POST para subir audios
app.post('/upload', upload.single('audioFile'), async (req, res) => {
    try {
        const file = req.file;
        const b2Filename = req.body.fileName; // The generated cloud name

        if (!file || !b2Filename) {
            return res.status(400).json({ error: 'Falta archivo o fileName.' });
        }

        console.log(`⬆️ Proxying Upload to B2: ${b2Filename}`);
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

        if (!b2Response.ok) {
            const errBody = await b2Response.text();
            throw new Error(`B2 Upload rejected: ${b2Response.status} - ${errBody}`);
        }

        const b2Data = await b2Response.json();
        // Construimos la URL pública final
        // B2 urls typically format as: https://fXXX.backblazeb2.com/file/[bucketName]/[fileName]
        // or through the download endpoint we made
        const finalUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${encodeURI(b2Filename)}`;

        console.log(`✅ Upload Success: ${finalUrl}`);
        res.json({ success: true, fileId: b2Data.fileId, url: finalUrl });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 B2 Proxy running on http://localhost:${PORT}`);
});
