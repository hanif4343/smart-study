// =====================================================
// Smart Study — Service Worker (Network First Strategy)
// Online = সবসময় Firebase থেকে fresh data
// Offline = cache থেকে দেখাবে
// =====================================================

const CACHE_NAME = 'smart-study-v3'; // version বাড়ালে পুরনো cache delete হবে
const CACHE_URLS = [
    './index.html',
];

// ── Install: শুধু index.html cache করো ──
self.addEventListener('install', function(event) {
    console.log('[SW] Installing v3...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(CACHE_URLS);
        }).then(function() {
            // নতুন SW সাথে সাথে activate হোক
            return self.skipWaiting();
        })
    );
});

// ── Activate: পুরনো cache মুছে দাও ──
self.addEventListener('activate', function(event) {
    console.log('[SW] Activating v3, clearing old caches...');
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME; // পুরনো version delete
                }).map(function(key) {
                    console.log('[SW] Deleting old cache:', key);
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim(); // সব tab নতুন SW ব্যবহার করবে
        })
    );
});

// ── Fetch: Network First ──
self.addEventListener('fetch', function(event) {
    var url = event.request.url;

    // Firebase/GAS/API requests — সবসময় Network, কখনো cache না
    if (
        url.includes('firebaseio.com') ||
        url.includes('script.google.com') ||
        url.includes('googleapis.com') ||
        url.includes('firebase') ||
        url.includes('.json?auth=') ||
        url.includes('_t=') // timestamp querystring = fresh request
    ) {
        // Network only — cache করবে না
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }).catch(function() {
                // নেট নেই — কিছু করার নেই, app নিজেই handle করবে
                return new Response(JSON.stringify({ error: 'offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // External fonts/CDN — Network first, cache fallback
    if (
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com') ||
        url.includes('cdnjs.cloudflare.com') ||
        url.includes('tailwindcss')
    ) {
        event.respondWith(
            fetch(event.request).then(function(response) {
                // সফল হলে cache করো
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, clone);
                });
                return response;
            }).catch(function() {
                // offline হলে cache থেকে দাও
                return caches.match(event.request);
            })
        );
        return;
    }

    // index.html — Network First, offline হলে cache
    if (url.includes('index.html') || url.endsWith('/') || !url.includes('.')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' }).then(function(response) {
                if (response && response.status === 200) {
                    // নতুন version cache করো
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function() {
                // Offline — cached version দাও
                return caches.match('./index.html').then(function(cached) {
                    return cached || new Response('Offline — নেট সংযোগ দিন', {
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
        );
        return;
    }

    // অন্য সব — Network first, cache fallback
    event.respondWith(
        fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, clone);
                });
            }
            return response;
        }).catch(function() {
            return caches.match(event.request);
        })
    );
});

// ── Background Sync ──
self.addEventListener('sync', function(event) {
    if (event.tag === 'study-reminder') {
        event.waitUntil(
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({ type: 'SYNC_PENDING' });
                });
            })
        );
    }
});
