// =====================================================
// Smart Study — Service Worker v5
// CDN assets (Tailwind, Fonts, core-js) — Cache First
// App assets (JS/HTML) — Cache First + background update
// Firebase — Network Only (never cache)
// =====================================================

const CACHE_NAME = 'smart-study-v5';
const CDN_CACHE  = 'smart-study-cdn-v5';

// CDN URLs যেগুলো indefinitely cache করা safe
const CDN_HOSTS = [
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

// এগুলো কখনো cache করবে না
const NEVER_CACHE = [
    'firebaseio.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'script.google.com',
    'postimg.cc',   // dynamic images
];

// ── Install ──
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(['./index.html']).then(function() {
                return cache.add('./js/bundle.obf.js').catch(function() {});
            });
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// ── Activate ──
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME && key !== CDN_CACHE;
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ── Fetch ──
self.addEventListener('fetch', function(event) {
    var url = event.request.url;

    // Firebase / Auth — সরাসরি network, SW bypass
    if (NEVER_CACHE.some(function(h) { return url.includes(h); })) {
        return;
    }

    // CDN assets — Cache First (একবার download হলে সবসময় cache থেকে)
    if (CDN_HOSTS.some(function(h) { return url.includes(h); })) {
        event.respondWith(
            caches.open(CDN_CACHE).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    if (cached) return cached; // ✅ instant from cache
                    // First time — network থেকে নাও ও cache করো
                    return fetch(event.request).then(function(response) {
                        if (response && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }

    // App assets (JS files, index.html) — Cache First + background update
    if (url.includes('/assets/') || url.endsWith('.js') || url.endsWith('.html')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    var fetchPromise = fetch(event.request).then(function(response) {
                        if (response && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(function() { return cached; });
                    // Cached থাকলে তাৎক্ষণিক দাও, background এ update
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }

    // সব অন্য requests — Network first, cache fallback
    event.respondWith(
        fetch(event.request).then(function(response) {
            if (response && response.status === 200 && response.type === 'basic') {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, clone);
                });
            }
            return response;
        }).catch(function() {
            return caches.match(event.request).then(function(c) {
                return c || caches.match('./index.html');
            });
        })
    );
});
