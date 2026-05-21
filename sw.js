// ─────────────────────────────────────────────────────────────
// YelaPay+ Service Worker — Cache offline completo
// Guarda todos os recursos da app no telemóvel
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = 'yelapay-v5';
const OFFLINE_URL = '/yelapay-platform/';

// Recursos a guardar em cache (app shell)
const CACHE_URLS = [
  '/yelapay-platform/',
  '/yelapay-platform/index.html',
  'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap',
];

// Instalar — guardar recursos em cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_URLS).catch(err => {
        console.warn('YelaPay+ SW: alguns recursos não foram cacheados:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activar — limpar caches antigas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — servir do cache quando offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pedidos à API — tentar rede primeiro, falhar silenciosamente
  if(url.hostname.includes('onrender.com')){
    event.respondWith(
      fetch(event.request).catch(() => {
        // API offline — retornar resposta vazia
        return new Response(JSON.stringify([]), {
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // Fontes Google — cache first
  if(url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')){
    event.respondWith(
      caches.match(event.request).then(cached => {
        if(cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => new Response('', {status: 200}));
      })
    );
    return;
  }

  // App shell — cache first, fallback para rede
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(response => {
        // Guardar em cache se for recurso da app
        if(response.ok && event.request.method === 'GET'){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sem rede e sem cache — mostrar app offline
        return caches.match(OFFLINE_URL);
      });
    })
  );
});

// Sincronização em background quando rede volta
self.addEventListener('sync', event => {
  if(event.tag === 'sync-transactions'){
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions(){
  // Notificar a app para sincronizar
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({type: 'SYNC_NOW'}));
}
Add Service Worker for offline mode
