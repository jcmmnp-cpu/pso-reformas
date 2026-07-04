// sw.js - Service Worker para P.S.O REFORMAS
const CACHE_NAME = 'pso-reformas-cache-v13';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './app.js?v=13',
  './db.js?v=13',
  './logo.png',
  './psofd.png',
  './pwa_icon.jpg',
  './manifest.json?v=13'
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

// Helper para limpar respostas redirecionadas (evita erros de segurança do FetchEvent no navegador)
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

// Interceptação de requisições (Cache First com fallback para Network)
self.addEventListener('fetch', (event) => {
  // Ignora chamadas à API do PocketBase para que elas sempre tentem a rede
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Se a resposta do cache for uma resposta redirecionada, limpa ou busca da rede
        return cleanRedirectedResponse(cachedResponse);
      }
      
      // Se não estiver no cache, busca na rede
      return fetch(event.request).then((response) => {
        // Limpa redirecionamento se houver
        const cleanResponse = cleanRedirectedResponse(response);

        // Verifica se a resposta é válida antes de colocar no cache
        if (!cleanResponse || cleanResponse.status !== 200 || cleanResponse.type !== 'basic') {
          return cleanResponse;
        }

        // Duplica a resposta para salvar no cache
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
