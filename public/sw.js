// Zion Stage Service Worker — caches app shell for offline use
const CACHE = 'zion-stage-v5';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/') || url.hostname.includes('backblaze') || url.hostname.includes('railway')) return;

    // Manifest / SW: solo red. Si el catch devolviera index.html, Chrome muestra "Manifest: Syntax error" en línea 1.
    if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200 && (
                    e.request.destination === 'document' ||
                    e.request.destination === 'script' ||
                    e.request.destination === 'style'
                )) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() =>
                caches.match(e.request).then(r => {
                    if (r) return r;
                    // No sustituir JSON/manifest por el shell HTML (rompe el parser del manifest).
                    const p = new URL(e.request.url).pathname;
                    if (p.endsWith('.json') || p === '/manifest.json') {
                        return new Response('{}', {
                            status: 404,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }
                    return caches.match('/index.html');
                })
            )
    );
});
