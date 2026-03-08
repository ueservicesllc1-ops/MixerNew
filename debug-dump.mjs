import fetch from 'node-fetch';
import fs from 'fs';

async function dumpHtml(url) {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await resp.text();
    fs.writeFileSync('dump.html', html);
    console.log("Dumped to dump.html, length:", html.length);
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    console.log("Pre match found:", !!preMatch);
    if (preMatch) {
        console.log("Pre content length:", preMatch[1].length);
        console.log("Pre snippet (trimmed):", preMatch[1].trim().substring(0, 200));
    }
}

dumpHtml('https://acordes.lacuerda.net/marco_barrientos/exaltad_al_rey.shtml');
