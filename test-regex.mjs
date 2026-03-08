import fetch from 'node-fetch';

async function testRegex() {
    const url = 'https://acordes.lacuerda.net/ARCH/indices.php?ini=50&req_pais=&req_estilo=rel';
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        follow: 20, // node-fetch behavior
        timeout: 15000
    });

    console.log(`Final URL: ${response.url}`);
    const html = await response.text();
    const idx = html.indexOf('abel_zavala');
    console.log(`Abel Zavala snippet: ${html.substring(idx - 100, idx + 200)}`);
    const artists = [];
    // Super flexible regex:
    // 1. href with single or double quotes
    // 2. ignore any HTML tags inside <a> except for the name part
    const regex = /<a\s+href=['"]\/([^/]+)\/['"][^>]*>(?:<em[^>]*>.*?<\/em>)?\s*([^<]+)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const name = match[2].trim();
        if (name && name !== 'Indice') {
            artists.push({
                name: name,
                slug: match[1]
            });
        }
    }

    console.log(`✅ Total: ${artists.length}`);
    console.log('Primeros 5:', artists.slice(0, 5));
}

testRegex();
