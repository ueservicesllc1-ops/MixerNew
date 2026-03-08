import fetch from 'node-fetch';

async function testSingleSong(artistSlug, songSlug) {
    try {
        const versionsUrl = `https://acordes.lacuerda.net/${artistSlug}/${songSlug}`;
        console.log(`🔍 Buscando versiones para: ${versionsUrl}...`);
        const vResp = await fetch(versionsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const vHtml = await vResp.text();

        // Dump a bit of vHtml to see the links
        console.log(`VHtml Snippet: ${vHtml.substring(10000, 15000)}`);

        const shtmlMatch = vHtml.match(/href=['"]([^'"]+\.shtml)['"]/i);
        if (!shtmlMatch) {
            console.log("❌ No se encontró versión web (.shtml) con el regex original.");
            // Try a broader regex
            const anyShtml = vHtml.match(/href=['"][^'"]*?\/([^\/'"]+\.shtml)['"]/i);
            console.log("Broad search result:", anyShtml);
            return;
        }

        const finalUrl = `https://acordes.lacuerda.net/${artistSlug}/${shtmlMatch[1]}`;
        console.log(`🎯 Cargando cifrado final: ${finalUrl}...`);

        const fResp = await fetch(finalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const fHtml = await fResp.text();

        const preMatch = fHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        if (!preMatch) {
            console.log("❌ No se encontró el bloque <pre>");
            console.log(`FHtml Snippet: ${fHtml.substring(5000, 10000)}`);
            return;
        }

        console.log("✅ Bloque <pre> encontrado!");
        console.log("Contenido (letras):", preMatch[1].substring(0, 100));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

// Probar con "Al Rey" de Marco Barrientos o similar
testSingleSong('marco_barrientos', 'al_rey');
