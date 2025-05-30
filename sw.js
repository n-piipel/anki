/**
 * Service Worker for pAnki Flashcards
 * Caches static resources and CSV files
 */

const CACHE_NAME = 'panki-flashcards-v2.4';
const STATIC_CACHE = 'panki-static-v2.4';
const DATA_CACHE = 'panki-data-v2.4';

// Static files for caching - use relative paths for GitHub Pages
const STATIC_FILES = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/storage.js',
    './js/spaced-repetition.js',
    './js/flashcard.js'
];

// Data files for caching - use relative paths for GitHub Pages
const DATA_FILES = [
    './data/index.json',
    './data/greek-verbs-basic.csv',
    './data/greek-transport-navigation.csv',
    './data/greek-verbs-everyday.csv',
    './data/greek-connecting-words.csv',
    './data/greek-everyday-life.csv'
];

/**
 * Install event - cache static files
 */
self.addEventListener('install', event => {
    console.log('🛡️ Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE).then(cache => {
                console.log('📦 Caching static files');
                return Promise.allSettled(
                    STATIC_FILES.map(url => 
                        cache.add(url).catch(error => {
                            console.warn(`Failed to cache static file: ${url}`, error);
                            return null; // Continue with other files
                        })
                    )
                );
            }),
            
            // Cache data files with better error handling
            caches.open(DATA_CACHE).then(cache => {
                console.log('📊 Caching data files');
                return Promise.allSettled(
                    DATA_FILES.map(url => 
                        fetch(url).then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            } else {
                                console.warn(`Failed to fetch for cache: ${url} (${response.status})`);
                                return null;
                            }
                        }).catch(error => {
                            console.warn(`Failed to fetch for cache: ${url}`, error);
                            return null;
                        })
                    )
                );
            })
        ]).then(() => {
            console.log('✅ Service Worker installed (some files may have failed)');
            self.skipWaiting();
        }).catch(error => {
            console.error('❌ Service Worker installation failed:', error);
            // Still try to activate even if caching fails
            self.skipWaiting();
        })
    );
});

/**
 * Activate event - clean old caches
 */
self.addEventListener('activate', event => {
    console.log('🔄 Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Remove old cache versions
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DATA_CACHE && 
                        cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated');
            return self.clients.claim();
        })
    );
});

/**
 * Fetch event - caching strategy
 */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Only handle same-origin requests
    if (url.origin !== location.origin) {
        return;
    }
    
    // Different strategies for different types of files
    if (url.pathname.startsWith('/data/')) {
        // Data files: Network First strategy
        event.respondWith(networkFirst(request, DATA_CACHE));
    } else if (STATIC_FILES.some(file => url.pathname === file || url.pathname.endsWith(file))) {
        // Static files: Cache First strategy
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else {
        // Other files: Stale While Revalidate strategy
        event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    }
});

/**
 * Cache First strategy - cache first, then network
 */
async function cacheFirst(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Cache First strategy failed:', error);
        throw error;
    }
}

/**
 * Network First strategy - network first, then cache
 */
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Network failed, trying cache:', error);
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

/**
 * Stale While Revalidate strategy - fast from cache + background update
 */
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    // Don't cache HEAD requests
    if (request.method === 'HEAD') {
        return fetch(request);
    }
    
    // Start background update
    const networkResponsePromise = fetch(request).then(response => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    });
    
    // Return cached version immediately
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // If no cache, wait for network response
    return networkResponsePromise;
}

/**
 * Background sync for delayed operations
 */
self.addEventListener('sync', event => {
    console.log('🔄 Background sync:', event.tag);
    
    if (event.tag === 'sync-study-data') {
        event.waitUntil(syncStudyData());
    }
});

/**
 * Study data synchronization
 */
async function syncStudyData() {
    try {
        // Here you can implement synchronization with the server
        // For now, just log it
        console.log('Syncing study data...');
        
        // In the future, this could be sending statistics to the server
        return Promise.resolve();
    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
}

/**
 * Push notifications (for future use)
 */
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Time to review cards!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        data: data,
        actions: [
            {
                action: 'study',
                title: '📚 Study',
                icon: '/study-icon.png'
            },
            {
                action: 'later',
                title: '⏰ Later',
                icon: '/later-icon.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('pAnki Flashcards', options)
    );
});

/**
 * Handling push notifications
 */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'study') {
        // Open the app on the study page
        event.waitUntil(
            clients.openWindow('/#study')
        );
    } else if (event.action === 'later') {
        // Simply close the notification
        return;
    } else {
        // Click on the notification - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

console.log('📋 Service Worker script loaded'); 