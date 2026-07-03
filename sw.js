// sw.js - Service Worker para P.S.O REFORMAS
const CACHE_NAME = 'pso-reformas-cache-v8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './app.js?v=8',
  './db.js?v=8',
  './logo.png',
  './psofd.png',
  './pwa_icon.jpg',
  './manifest.json'
];

// Instalação do Service Worker e Cache dos arquivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Cacheando recursos estáticos...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Ativação e Limpeza de caches antigos
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

// Interceptação de requisições (Cache First com fallback para Network)
self.addEventListener('fetch', (event) => {
  // Ignora chamadas à API do PocketBase para que elas sempre tentem a rede
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Se não estiver no cache, busca na rede
      return fetch(event.request).then((response) => {
        // Verifica se a resposta é válida antes de colocar no cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Duplica a resposta para salvar no cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch((err) => {
        console.log('SW: Erro ao buscar rede (provavelmente offline):', err);
        // Opcional: retornar uma página offline padrão se quiser, mas como o index.html é cacheado, ele já abre.
      });
    })
  );
});
