// Zion Stage Service Worker — caches app shell for offline use
const CACHE = 'zion-stage-v1';
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
    // Only cache GET requests for same-origin navigation (app shell)
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    // Pass through API and B2 requests — never cache audio blobs here
    if (url.pathname.startsWith('/api/') || url.hostname.includes('backblaze') || url.hostname.includes('railway')) return;

    e.respondWith(
        fetch(e.request)
            .then(res => {
                // Cache fresh HTML/JS/CSS responses
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
            .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
    );
});
