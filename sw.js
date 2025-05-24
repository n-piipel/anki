/**
 * Service Worker для офлайн работы Anki Flashcards
 * Кэширует статические ресурсы и CSV файлы
 */

const CACHE_NAME = 'anki-flashcards-v1.3';
const STATIC_CACHE = 'static-v1.3';
const DATA_CACHE = 'data-v1.3';

// Статические файлы для кэширования
const STATIC_FILES = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/storage.js',
    '/js/spaced-repetition.js',
    '/js/flashcard.js'
];

// Файлы данных для кэширования
const DATA_FILES = [
    '/data/index.json',
    '/data/general-knowledge.csv',
    '/data/programming-terms.csv',
    '/data/languages.csv',
    '/data/math.csv',
    '/data/general.csv',
    '/data/gr-ru-verbs.csv'
];

/**
 * Install event - кэшируем статические файлы
 */
self.addEventListener('install', event => {
    console.log('🔧 Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            // Кэш статических файлов
            caches.open(STATIC_CACHE).then(cache => {
                console.log('📦 Caching static files...');
                return cache.addAll(STATIC_FILES.map(url => new Request(url, {
                    cache: 'reload' // Принудительно загружаем свежие версии
                })));
            }),
            
            // Кэш файлов данных
            caches.open(DATA_CACHE).then(cache => {
                console.log('📚 Caching data files...');
                return Promise.allSettled(
                    DATA_FILES.map(url => 
                        cache.add(new Request(url, {
                            cache: 'reload'
                        })).catch(error => {
                            console.warn(`⚠️ Failed to cache ${url}:`, error);
                        })
                    )
                );
            })
        ]).then(() => {
            console.log('✅ Service Worker installation complete');
            // Активируем новый SW немедленно
            return self.skipWaiting();
        })
    );
});

/**
 * Activate event - очищаем старые кэши
 */
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Удаляем старые версии кэша
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DATA_CACHE &&
                        cacheName !== CACHE_NAME) {
                        console.log(`🗑️ Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated');
            // Начинаем контролировать все вкладки немедленно
            return self.clients.claim();
        })
    );
});

/**
 * Fetch event - стратегия кэширования
 */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Игнорируем не-GET запросы и внешние домены
    if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
        return;
    }
    
    // Стратегия для файлов данных (CSV, JSON)
    if (url.pathname.startsWith('/data/')) {
        event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
        return;
    }
    
    // Стратегия для статических файлов
    if (STATIC_FILES.some(file => url.pathname === file || url.pathname.endsWith(file))) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }
    
    // Для остальных запросов - стандартная сетевая загрузка
    event.respondWith(networkFirst(request));
});

/**
 * Стратегия Cache First - сначала кэш, потом сеть
 * Подходит для статических файлов
 */
async function cacheFirst(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log(`📦 Cache hit: ${request.url}`);
            return cachedResponse;
        }
        
        console.log(`🌐 Cache miss, fetching: ${request.url}`);
        const networkResponse = await fetch(request);
        
        // Кэшируем успешные ответы
        if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            cache.put(request, responseClone);
        }
        
        return networkResponse;
    } catch (error) {
        console.error(`❌ Cache first failed for ${request.url}:`, error);
        // Возвращаем офлайн страницу или базовый ответ
        return createOfflineResponse(request);
    }
}

/**
 * Стратегия Network First - сначала сеть, потом кэш
 * Подходит для важных данных
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        console.log(`🔄 Network failed, trying cache: ${request.url}`);
        
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return createOfflineResponse(request);
    }
}

/**
 * Стратегия Stale While Revalidate - быстро из кэша + обновление в фоне
 * Подходит для данных, которые могут устареть
 */
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Запускаем обновление в фоне
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        console.warn(`Background fetch failed for ${request.url}:`, error);
    });
    
    // Возвращаем кэшированную версию немедленно
    if (cachedResponse) {
        console.log(`⚡ Stale cache hit: ${request.url}`);
        return cachedResponse;
    }
    
    // Если нет кэша, ждём сетевой ответ
    console.log(`🌐 No cache, waiting for network: ${request.url}`);
    return fetchPromise;
}

/**
 * Создать офлайн ответ для недоступных ресурсов
 */
function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // Для HTML страниц возвращаем базовую офлайн страницу
    if (request.headers.get('Accept').includes('text/html')) {
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Офлайн - Anki Flashcards</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 50px; }
                    .offline { color: #666; }
                </style>
            </head>
            <body>
                <div class="offline">
                    <h1>📵 Офлайн режим</h1>
                    <p>Нет соединения с интернетом</p>
                    <p>Некоторые функции могут быть недоступны</p>
                    <button onclick="location.reload()">🔄 Попробовать снова</button>
                </div>
            </body>
            </html>
        `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    // Для API/данных возвращаем JSON ошибку
    if (url.pathname.includes('/data/')) {
        return new Response(JSON.stringify({
            error: 'Офлайн режим',
            message: 'Данные недоступны без подключения к интернету'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Общий офлайн ответ
    return new Response('Офлайн режим - ресурс недоступен', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

/**
 * Background sync для отложенных операций
 */
self.addEventListener('sync', event => {
    console.log('🔄 Background sync:', event.tag);
    
    if (event.tag === 'sync-study-data') {
        event.waitUntil(syncStudyData());
    }
});

/**
 * Синхронизация данных изучения
 */
async function syncStudyData() {
    try {
        // Здесь можно реализовать синхронизацию с сервером
        // Пока что просто логируем
        console.log('📊 Syncing study data...');
        
        // В будущем здесь может быть отправка статистики на сервер
        return Promise.resolve();
    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    }
}

/**
 * Push notifications (для будущего использования)
 */
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Время для повторения карточек!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        data: data,
        actions: [
            {
                action: 'study',
                title: '📚 Изучать',
                icon: '/study-icon.png'
            },
            {
                action: 'later',
                title: '⏰ Позже',
                icon: '/later-icon.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Anki Flashcards', options)
    );
});

/**
 * Обработка кликов по уведомлениям
 */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'study') {
        // Открыть приложение на странице изучения
        event.waitUntil(
            clients.openWindow('/#study')
        );
    } else if (event.action === 'later') {
        // Просто закрыть уведомление
        return;
    } else {
        // Клик по самому уведомлению - открыть приложение
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

console.log('📋 Service Worker script loaded'); 