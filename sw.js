// sw.js - Service Worker para P.S.O REFORMAS
const CACHE_NAME = 'pso-reformas-cache-v16';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './app.js?v=16',
  './db.js?v=16',
  './logo.png',
  './psofd.png',
  './pwa_icon.jpg',
  './manifest.json?v=16'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Cacheando recursos estáticos...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function cleanRedirectedResponse(response) {
  if (response && response.redirected) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cleanRedirectedResponse(cachedResponse);
      }
      
      return fetch(event.request).then((response) => {
        const cleanResponse = cleanRedirectedResponse(response);

        if (!cleanResponse || cleanResponse.status !== 200 || cleanResponse.type !== 'basic') {
          return cleanResponse;
        }

        const responseToCache = cleanResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return cleanResponse;
      }).catch((err) => {
        console.log('SW: Erro ao buscar rede (provavelmente offline):', err);
      });
    })
  );
});
