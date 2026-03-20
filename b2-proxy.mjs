import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import os from 'os';
import Stripe from 'stripe';

ffmpeg.setFfmpegPath(ffmpegStatic);

// Usando la clave secreta LIVE de Stripe (se debe configurar en variables de entorno):
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
    });
} else {
    console.warn("⚠️ STRIPE_SECRET_KEY no configurada. Las funciones de pago no estarán disponibles.");
}

// Configuración de productos/precios para sincronizar con Stripe
const STRIPE_PLANS_CONFIG = {
    'seller': { name: 'Suscripción Vendedor MixCommunity', monthly: 199, annual: 1990 }, // Vendedor anual opcional
    'std1': { name: 'Plan Básico MixCommunity', monthly: 499, annual: 4192 },
    'std2': { name: 'Plan Estándar MixCommunity', monthly: 699, annual: 5872 },
    'std3': { name: 'Plan Plus MixCommunity', monthly: 999, annual: 8392 },
    'vip1': { name: 'Plan Básico VIP MixCommunity', monthly: 799, annual: 6712 },
    'vip2': { name: 'Plan Estándar VIP MixCommunity', monthly: 999, annual: 8392 },
    'vip3': { name: 'Plan Plus VIP MixCommunity', monthly: 1299, annual: 10912 },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = path.join(__dirname, 'dist');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: true, // Allow all origins including capacitor://localhost
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
    credentials: true
}));
app.options('*', cors()); // Handle preflight
app.use(express.json({ limit: '5gb' }));
app.use(express.urlencoded({ limit: '5gb', extended: true }));

// La configuración de static y SPA se movió al final del archivo para evitar conflictos con las rutas de API.

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'mixercur';

console.log("🔧 B2 Config:", { 
    hasKeyId: !!B2_KEY_ID, 
    hasAppKey: !!B2_APPLICATION_KEY, 
    bucketId: B2_BUCKET_ID,
    bucketName: B2_BUCKET_NAME 
});

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

app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    service: 'B2 Proxy + Frontend',
    distExists: fs.existsSync(distPath),
    port: PORT
}));

const handleDownload = async (req, res) => {
    try {
        let { url } = req.query;
        if (!url || url === 'undefined' || url === 'null') {
            return res.status(400).json({ error: 'URL inválida' });
        }
        url = url.trim();
        console.log(`[PROXY] Descargando audio desde: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[PROXY] B2 devolvió error ${response.status} para: ${url}`);
            throw new Error(`B2 Error ${response.status}`);
        }

        res.set({
            'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
            'Access-Control-Allow-Origin': '*'
        });

        // node-fetch v3 usa web streams, necesitamos transformarlos para Express (Node streams)
        if (response.body && response.body.pipe) {
            // Si por alguna razón es un stream de Node (v2 behavior)
            response.body.pipe(res);
        } else if (response.body) {
            // Comportamiento estándar de node-fetch v3 (web streams)
            Readable.fromWeb(response.body).pipe(res);
        } else {
            throw new Error("Cuerpo de respuesta vacío");
        }
    } catch (error) {
        console.error("🚨 Error en download:", error.message);
        // Si el error es por pipe, puede que ya se hayan enviado encabezados
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};

app.get('/api/download', handleDownload);
app.get('/download', handleDownload);

app.post('/api/stripe/create-single-payment', async (req, res) => {
    console.log("💳 Recibida solicitud de pago único:", req.body);
    try {
        const { songId, songName, price, email, userId } = req.body;

        if (!songId || !price || !email) {
            console.warn("⚠️ Datos de compra incompletos:", req.body);
            return res.status(400).json({ error: 'Faltan datos de la compra (ID, precio o email)' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const amount = Math.round(parseFloat(price) * 100);

        if (isNaN(amount) || amount < 50) {
            console.warn("⚠️ Monto de pago inválido o muy bajo:", price);
            return res.status(400).json({ error: 'El monto de pago no es válido (mínimo $0.50 USD)' });
        }

        console.log(`💰 Procesando pago de $${price} (${amount} cents) para: ${songName} - User: ${userId}`);

        // 1. Obtener o crear Customer
        let customer;
        try {
            const customers = await stripe.customers.list({ email: cleanEmail, limit: 1 });
            customer = customers.data[0];
            if (!customer) {
                console.log("👤 Creando nuevo cliente Stripe para:", cleanEmail);
                customer = await stripe.customers.create({
                    email: cleanEmail,
                    metadata: { userId: userId || 'anonymous' }
                });
            }
        } catch (custErr) {
            console.error("🚨 Error con el cliente de Stripe:", custErr.message);
            throw new Error(`Error de cliente Stripe: ${custErr.message}`);
        }

        // 2. Crear Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            customer: customer.id,
            description: `Zion Stage - Pistas: ${songName}`,
            metadata: {
                songId,
                userId: userId || 'anonymous',
                type: 'song_purchase',
                cartItems: songName
            },
            payment_method_types: ['card'],
        });

        console.log("✅ PaymentIntent creado con éxito:", paymentIntent.id);
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (error) {
        console.error("🚨 Stripe Single Payment Error DETALLADO:", error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.post('/api/upload', upload.single('audioFile'), async (req, res) => {
    let tempInputPath = '';
    let tempOutputPath = '';
    let tempPreviewPath = '';
    try {
        const file = req.file;
        const b2Filename = req.body.fileName;
        const generatePreview = req.body.generatePreview === 'true'; // Bandera para generar preview

        if (!file || !b2Filename) return res.status(400).json({ error: 'Falta archivo' });

        const uploadNode = await getUploadNode();
        const tempId = crypto.randomBytes(8).toString('hex');
        const tmpDir = os.tmpdir();
        tempInputPath = path.join(tmpDir, `in_${tempId}`);
        tempOutputPath = path.join(tmpDir, `out_${tempId}.mp3`);
        tempPreviewPath = path.join(tmpDir, `prev_${tempId}.mp3`);

        const isMp3 = file.mimetype === 'audio/mpeg' ||
            file.mimetype === 'audio/mp3' ||
            file.originalname.toLowerCase().endsWith('.mp3');

        const isImage = file.mimetype?.startsWith('image/') ||
            /\.(png|jpe?g|gif|webp)$/i.test(file.originalname);

        const isApk = file.mimetype === 'application/vnd.android.package-archive' ||
            file.originalname.toLowerCase().endsWith('.apk');

        let mp3Buffer;

        if (isMp3 || isImage || isApk) {
            mp3Buffer = file.buffer;
        } else {
            console.log("🔄 Transcodificando a MP3...");
            fs.writeFileSync(tempInputPath, file.buffer);
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
            mp3Buffer = fs.readFileSync(tempOutputPath);
        }

        // --- SUBIDA DEL ARCHIVO ORIGINAL ---
        const sha1 = crypto.createHash('sha1').update(mp3Buffer).digest('hex');
        let contentType = isImage ? (file.mimetype || 'image/jpeg') : (isApk ? 'application/vnd.android.package-archive' : 'audio/mpeg');

        const b2Response = await fetch(uploadNode.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadNode.authorizationToken,
                'X-Bz-File-Name': encodeURIComponent(b2Filename),
                'Content-Type': contentType,
                'X-Bz-Content-Sha1': sha1,
                'Content-Length': mp3Buffer.length
            },
            body: mp3Buffer
        });
        const b2Data = await b2Response.json();
        if (!b2Response.ok) {
            throw new Error(`B2 Upload Error: ${b2Data.message || b2Data.code || 'Unknown error'}`);
        }
        const finalUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${encodeURI(b2Filename)}`;

        // --- GENERACIÓN Y SUBIDA DE PREVIEW (OPCIONAL) ---
        let previewUrl = null;
        if (generatePreview && !isImage) {
            console.log(`🎬 Generando clip de prueba (20s-40s) para ${b2Filename}...`);
            try {
                // Si no escribimos a disco arriba, lo hacemos ahora para el clip
                if (!fs.existsSync(tempInputPath)) fs.writeFileSync(tempInputPath, file.buffer);

                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(tempInputPath)
                        .setStartTime(20)
                        .setDuration(20)
                        .audioCodec('libmp3lame')
                        .audioBitrate('64k') // Calidad menor para preview = más rápido
                        .output(tempPreviewPath)
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err))
                        .run();
                });

                const previewBuffer = fs.readFileSync(tempPreviewPath);
                const previewSha1 = crypto.createHash('sha1').update(previewBuffer).digest('hex');
                const previewFilename = b2Filename.replace('.mp3', '_preview.mp3');

                const pB2Resp = await fetch(uploadNode.uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': uploadNode.authorizationToken,
                        'X-Bz-File-Name': encodeURIComponent(previewFilename),
                        'Content-Type': 'audio/mpeg',
                        'X-Bz-Content-Sha1': previewSha1,
                        'Content-Length': previewBuffer.length
                    },
                    body: previewBuffer
                });
                const pData = await pB2Resp.json();
                if (!pB2Resp.ok) {
                    console.warn("⚠️ B2 Preview Upload Error:", pData.message);
                } else {
                    previewUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${encodeURI(previewFilename)}`;
                    console.log(`✅ Clip generado: ${previewUrl}`);
                }
            } catch (prevErr) {
                console.warn("⚠️ Falló creación de preview, se usará el original:", prevErr.message);
            }
        }

        res.json({ success: true, url: finalUrl, previewUrl: previewUrl, fileId: b2Data.fileId });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        if (tempPreviewPath && fs.existsSync(tempPreviewPath)) fs.unlinkSync(tempPreviewPath);
    }
});

app.post('/api/delete-file', async (req, res) => {
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

app.get('/api/list-files', async (req, res) => {
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

app.post('/api/stripe/create-subscription', async (req, res) => {
    try {
        const { email, name, userId, planId = 'seller', isAnnual = false } = req.body;
        if (!email || !userId) return res.status(400).json({ error: 'Faltan datos de usuario' });

        const planConfig = STRIPE_PLANS_CONFIG[planId];
        if (!planConfig) return res.status(400).json({ error: 'Plan no válido' });

        const amount = isAnnual ? planConfig.annual : planConfig.monthly;
        const interval = isAnnual ? 'year' : 'month';
        const productName = isAnnual ? `${planConfig.name} (Anual)` : planConfig.name;

        // 1. Obtener o crear Customer en Stripe
        const customers = await stripe.customers.list({ email: email, limit: 1 });
        let customer = customers.data[0];
        if (!customer) {
            customer = await stripe.customers.create({ email, name, metadata: { userId } });
        }

        // 2. Obtener o crear el Producto y Precio de Suscripción
        const products = await stripe.products.search({ query: `name:"${productName}"` });
        let product = products.data[0];
        let priceId;

        if (!product) {
            product = await stripe.products.create({ name: productName, description: `Acceso al plan ${planId} (${interval})` });
            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: amount,
                currency: 'usd',
                recurring: { interval: interval }
            });
            priceId = price.id;
        } else {
            const prices = await stripe.prices.list({ product: product.id, active: true });
            const targetPrice = prices.data.find(p => p.unit_amount === amount && p.recurring.interval === interval);
            if (targetPrice) {
                priceId = targetPrice.id;
            } else {
                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: amount,
                    currency: 'usd',
                    recurring: { interval: interval }
                });
                priceId = price.id;
            }
        }

        // 3. Crear Suscripción
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        });

        res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({ error: error.message });
    }
});



app.get('/api/import-artists', async (req, res) => {
    try {
        console.log("🌎 Iniciando importación masiva de artistas (Religioso)...");
        const allArtists = [];
        const seenSlugs = new Set();
        let ini = 0;
        let emptyPages = 0;

        while (ini < 1500) { // El usuario dijo ~1,300 artistas
            const url = `https://acordes.lacuerda.net/ARCH/indices.php?ini=${ini}&req_pais=&req_estilo=rel`;
            console.log(`🔍 Cargando página (ini=${ini})...`);
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            if (!response.ok) break;
            const html = await response.text();

            // Regex robusta: captura slug e ignora tags extras como <em>Acordes de</em> o <img>
            // Captura case-insensitive del cierre de etiqueta </A>
            const regex = /<a\s+href=['"]\/([^/]+)\/['"][^>]*>(?:<em[^>]*>.*?<\/em>)?\s*([^<]+)<\/a>/gi;
            let match;
            let pageCount = 0;

            while ((match = regex.exec(html)) !== null) {
                const slug = match[1];
                const name = match[2].trim();

                if (name && name !== 'Indice' && !seenSlugs.has(slug)) {
                    seenSlugs.add(slug);
                    allArtists.push({ name, slug });
                    pageCount++;
                }
            }

            console.log(`✅ Página ini=${ini}: ${pageCount} artistas nuevos.`);
            if (pageCount === 0) {
                emptyPages++;
                if (emptyPages > 1) break; // Si dos páginas están vacías, terminamos
            } else {
                emptyPages = 0;
            }

            ini += 50;
            // Pequeña pausa para no ser bloqueados
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`🎉 Importación finalizada: ${allArtists.length} artistas en total.`);
        res.json({ artists: allArtists });
    } catch (error) {
        console.error("🚨 Error Import Artists:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/scrape-chords', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Falta URL' });

        console.log(`🔍 Scraping avanzado para: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html'
            },
            timeout: 10000
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        console.log(`✅ HTML recibido: ${html.length} bytes`);

        // Buscar el "corazón" del contenido
        let rawContent = '';
        const containers = [
            /<div id="t_body"[^>]*>([\s\S]*?)<\/div>/i,
            /<pre[^>]*>([\s\S]*?)<\/pre>/i,
            /<div id="tablatura"[^>]*>([\s\S]*?)<\/div>/i,
            /<div class="tablatura"[^>]*>([\s\S]*?)<\/div>/i,
            /<div id="cuerpo_cancion"[^>]*>([\s\S]*?)<\/div>/i
        ];

        for (const regex of containers) {
            const match = html.match(regex);
            if (match && match[1].trim().length > 50) {
                rawContent = match[1];
                console.log(`🎯 Contenedor detectado con regex: ${regex}`);
                break;
            }
        }

        if (!rawContent) {
            console.warn("⚠️ No se detectó un contenedor con mucho texto, intentando captura general...");
            const fallbackPre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
            if (fallbackPre) rawContent = fallbackPre.join('\n\n');
        }

        if (!rawContent || rawContent.length < 10) {
            return res.json({ content: "No pudimos extraer el cifrado automáticamente. Prueba copiar y pegar directamente de la web." });
        }

        // PROCESAMIENTO ESPECIAL:
        let cleaned = rawContent
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
            .replace(/<a [^>]*>([\s\S]*?)<\/a>/gi, '$1')
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\r/g, '')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();

        console.log(`✨ Cifrado procesado: ${cleaned.length} caracteres.`);
        res.json({ content: cleaned });
    } catch (error) {
        console.error("🚨 Error Scraping:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/list-artist-songs', async (req, res) => {
    try {
        const { slug } = req.query;
        if (!slug) return res.status(400).json({ error: 'Falta slug de artista' });

        console.log(`🔍 Listando canciones para artista: ${slug}...`);
        const url = `https://acordes.lacuerda.net/${slug}/`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        const songs = [];
        const seenSongSlugs = new Set();
        const regex = /<a\s+href=['"]([^./'"]+)['"][^>]*>(.*?)<\/a>/gi;
        let match;

        while ((match = regex.exec(html)) !== null) {
            const songSlug = match[1];
            let name = match[2];

            // Limpiar el nombre: quitar tags <em> o <img> e iconos
            name = name.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
            // Quitar la palabra "acordes" o "tabs" si está al final del nombre
            name = name.replace(/\s+(acordes|tabs|tablatura)$/i, '');

            if (songSlug && name && songSlug !== '..' && songSlug !== 'indices.php' && !seenSongSlugs.has(songSlug)) {
                seenSongSlugs.add(songSlug);
                songs.push({ name, slug: songSlug });
            }
        }

        res.json({ songs });
    } catch (error) {
        console.error("🚨 Error List Artist Songs:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/scrape-full-song', async (req, res) => {
    try {
        const { artistSlug, songSlug } = req.query;
        if (!artistSlug || !songSlug) return res.status(400).json({ error: 'Faltan parámetros' });

        // 1. Ir a la página de versiones
        const versionsUrl = `https://acordes.lacuerda.net/${artistSlug}/${songSlug}`;
        console.log(`🔍 Buscando versiones para: ${versionsUrl}...`);
        const vResp = await fetch(versionsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            follow: 5 // Asegurar que seguimos las redirecciones
        });
        let vHtml = await vResp.text();
        let currentArtistSlug = artistSlug;
        let currentSongSlug = songSlug;

        // 1.1 Si nos mandó a una búsqueda (busca.php), intentar sacar el primer resultado
        if (vResp.url.includes('busca.php') || vHtml.includes('var fns=[')) {
            console.log("⚠️ Redirigido a búsqueda. Intentando extraer slug del primer resultado...");
            const fnsMatch = vHtml.match(/var fns=\[([^\]]+)\]/);
            if (fnsMatch) {
                const slugs = fnsMatch[1].replace(/['"]/g, '').split(',');
                if (slugs.length > 0) {
                    currentSongSlug = slugs[0].trim();
                    console.log(`✅ Nuevo slug encontrado: ${currentSongSlug}`);
                    // Re-fetch a la página de la canción real
                    const newUrl = `https://acordes.lacuerda.net/${currentArtistSlug}/${currentSongSlug}`;
                    const nResp = await fetch(newUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    vHtml = await nResp.text();
                }
            }
        }

        // 2. Buscar la mejor versión .shtml (Letra y Acordes)
        const shtmlLinks = [];
        const shtmlRegex = /href=['"]([^'"]+\.shtml)['"]/gi;
        let sMatch;
        while ((sMatch = shtmlRegex.exec(vHtml)) !== null) {
            shtmlLinks.push(sMatch[1]);
        }

        // Si no hay links .shtml pero estamos en una página que parece ser ya el cifrado
        // probremos si la URL misma termina en .shtml o si podemos intuirla
        if (shtmlLinks.length === 0) {
            console.log("❓ No se encontraron links .shtml, intentando carga directa...");
            shtmlLinks.push(`${currentSongSlug}.shtml`);
        }

        // Ordenar: versiones limpias (sin guion) primero
        shtmlLinks.sort((a, b) => {
            const aHasDash = a.includes('-');
            const bHasDash = b.includes('-');
            if (aHasDash && !bHasDash) return 1;
            if (!aHasDash && bHasDash) return -1;
            return a.localeCompare(b);
        });

        // Intentar las versiones una por una hasta que una funcione (tenga <pre>)
        let finalContent = null;
        for (const link of shtmlLinks.slice(0, 3)) { // Probar las 3 primeras versiones
            let finalUrl = link;
            if (!finalUrl.startsWith('http')) {
                const cleanFileName = finalUrl.split('/').pop();
                finalUrl = `https://acordes.lacuerda.net/${currentArtistSlug}/${cleanFileName}`;
            }

            console.log(`🎯 Probando cifrado: ${finalUrl}...`);
            try {
                const fResp = await fetch(finalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const fHtml = await fResp.text();

                // LaCuerda a veces tiene un <pre id="tCode"></pre> vacío antes del real
                // Buscamos TODOS los bloques <pre> y nos quedamos con el que tenga contenido
                const allPreRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
                let preMatch;
                while ((preMatch = allPreRegex.exec(fHtml)) !== null) {
                    const candidate = preMatch[1];
                    if (candidate && candidate.length > 200) { // Un cifrado real tiene letras y acordes
                        finalContent = candidate;
                        console.log(`✅ Cifrado extraído con éxito (${candidate.length} chars)`);
                        break;
                    }
                }

                if (finalContent) break;
            } catch (e) {
                console.log(`❌ Falló versión ${link}: ${e.message}`);
            }
        }

        if (!finalContent) throw new Error("No se pudo extraer contenido de ninguna versión.");

        // Limpiar
        const content = finalContent
            .replace(/<a[^>]*>([^<]+)<\/a>/gi, '$1')
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim();

        res.json({ content });
    } catch (error) {
        console.error("🚨 Error Scrape Full Song:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// CONFIGURACIÓN DE FRONTEND Y SPA (DEBE IR AL FINAL)
if (fs.existsSync(distPath)) {
    console.log("📂 Carpeta 'dist' detectada. Sirviendo aplicación...");
    app.use(express.static(distPath));
} else {
    console.warn("⚠️ Carpeta 'dist' NO encontrada.");
}

// Solución definitiva para SPA: Middleware al final de la cadena
app.use((req, res, next) => {
    // Si la ruta empieza con /api/ y llegó hasta aquí, es que no existe. 404.
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `Ruta de API no encontrada: ${req.path}` });
    }

    // Para el resto (rutas de React), servimos index.html
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Error: Frontend no compilado.");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo escuchando en puerto ${PORT}`);
});


