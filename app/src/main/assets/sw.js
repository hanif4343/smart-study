// =====================================================
// Smart Study — Service Worker
// Network First: online হলে Firebase থেকে fresh data
// Offline: cache থেকে দেখাবে
// =====================================================

const CACHE_NAME = 'smart-study-v4';
const CACHE_URLS = [
    './index.html',
    './js/bundle.obf.js',   // obfuscated JS bundle
];

// ── Install ──
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            // bundle.obf.js CI তে generate হয় — not found হলে skip
            return cache.addAll(['./index.html']).then(function() {
                return cache.add('./js/bundle.obf.js').catch(function() {
                    // bundle এখনো নেই (dev mode) — skip silently
                });
            });
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// ── Activate: পুরনো cache মুছে দাও ──
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME;
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ── Fetch: Network first, cache fallback ──
self.addEventListener('fetch', function(event) {
    // Firebase / GAS requests — always network, never cache
    if (event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('script.google.com') ||
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('identitytoolkit')) {
        return; // browser এর default behavior
    }

    event.respondWith(
        fetch(event.request).then(function(response) {
            // Successful network response — cache আপডেট করো
            if (response && response.status === 200 && response.type === 'basic') {
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(function() {
            // Offline — cache থেকে দাও
            return caches.match(event.request).then(function(cached) {
                return cached || caches.match('./index.html');
            });
        })
    );
});
