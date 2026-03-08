import fetch from 'node-fetch';

async function testArtistSongs(slug) {
    const url = `https://acordes.lacuerda.net/${slug}/`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
    });

    const html = await response.text();
    console.log(`Artist Page Snippet (${slug}): ${html.substring(10000, 15000)}`);

    const songs = [];
    // Super flexible regex for song extraction
    const regex = /<a\s+href=['"]([^./'"]+)['"][^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const songSlug = match[1];
        let name = match[2];

        // Limpiar el nombre: quitar <em> e iconos
        name = name.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        // Quitar la palabra "acordes" o "tabs" si está al final
        name = name.replace(/\s+(acordes|tabs|tablatura)$/i, '');

        if (songSlug && name && songSlug !== '..' && songSlug !== 'indices.php') {
            songs.push({ name, slug: songSlug });
        }
    }

    console.log(`✅ Total Songs for ${slug}: ${songs.length}`);
    console.log('Primeras 5:', songs.slice(0, 5));
}

// Probar con Abel Zavala
testArtistSongs('abel_zavala');
