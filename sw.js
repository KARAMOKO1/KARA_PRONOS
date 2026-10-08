/* ═══════════════════════════════════════════════════
   KARA PRONOS — Service Worker v33
   - HTML : network-first (toujours la dernière version)
   - Assets statiques : cache-first (rapide)
   - Supabase : jamais mis en cache
   - Support notifications push
═══════════════════════════════════════════════════ */

const CACHE_NAME = 'kara-pronos-v34';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

/* ─── INSTALL ─── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ─── ACTIVATE ─── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((n) => n !== CACHE_NAME ? caches.delete(n) : null)
      ))
      .then(() => self.clients.claim())
  );
});

/* ─── FETCH ─── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // 1) Ne jamais intercepter Supabase, ni les méthodes non-GET
  if (url.includes('supabase.co')) return;
  if (request.method !== 'GET') return;

  // 2) HTML / navigation → NETWORK-FIRST (toujours la dernière version)
  const isHTML = request.mode === 'navigate'
              || request.destination === 'document'
              || url.endsWith('/')
              || url.endsWith('/index.html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // 3) Le reste (icônes, CDN JS, etc.) → CACHE-FIRST avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS PUSH (prêt pour le futur)
═══════════════════════════════════════════════════ */
self.addEventListener('push', (event) => {
  let data = { title: 'KARA PRONOS', body: 'Nouveau coupon disponible 🎯' };
  try { if (event.data) data = event.data.json(); } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://karapronos.website/icon-512.png',
      badge: 'https://karapronos.website/icon-512.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

/* Clic sur la notification → ouvre l'app */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
