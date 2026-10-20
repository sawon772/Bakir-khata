// ============================================
// 🔧 বাকির খাতা - Service Worker
// Version: 4.9.0
// Last Updated: 2026-09-26
// ============================================

const CACHE_NAME = 'bakir-khata-v4.9.0';
const RUNTIME_CACHE = 'bakir-khata-runtime-v4.9.0';

// যেসব ফাইল pre-cache হবে (প্রথমবার লোডে)
const PRECACHE_URLS = [
  './',
  './index.html',
  './products.html',
  './privacy.html'
];

// ============================================
// Install Event - প্রাথমিক cache
// ============================================
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Installing...');
  
  // 🔥 নতুন version হলে সাথে সাথে activate করো
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch((err) => console.warn('⚠️ Precache failed:', err))
  );
});

// ============================================
// Activate Event - পুরনো cache cleanup
// ============================================
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // পুরনো cache ডিলিট
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================
// Fetch Event - Smart caching
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🔥 ১. Firebase, Cloudinary, EmailJS skip করুন
  // (এগুলো cache করলে data stale হয়ে যাবে)
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('cloudinary') ||
    url.hostname.includes('emailjs') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('google') ||
    url.hostname.includes('accounts.google') ||
    url.pathname.includes('/api/') ||
    request.method !== 'GET'
  ) {
    return; // নেটওয়ার্ক থেকে সরাসরি
  }

  // 🔥 ২. HTML ফাইল - Network First with no-cache
if (request.headers.get('accept')?.includes('text/html') || 
    url.pathname.endsWith('.html') || 
    url.pathname === '/' ||
    url.pathname.endsWith('/Bakir-khata/')) {
  event.respondWith(
    // 🔥 no-store মানে cache ব্যবহার করবে না
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        // নতুন response cache এ save
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // অফলাইনে থাকলে cache থেকে দেখাও
        return caches.match(request)
          .then((cached) => cached || caches.match('./index.html'));
      })
  );
  return;
}

  // 🔥 ৩. CSS, JS, Font, Image - Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            // Background এ আপডেট check
            fetch(request).then((response) => {
              if (response && response.status === 200) {
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {});
            return cached;
          }
          
          return fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          });
        })
    );
    return;
  }

  // 🔥 ৪. অন্য সব - Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ============================================
// Message Event - Update handle
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
    console.log('🗑️ সব cache পরিষ্কার করা হয়েছে');
  }
});
// ============================================
// 🔔 Push Notification Handler
// ============================================
self.addEventListener('push', (event) => {
  console.log('🔔 Push received');
  
  // 📒 App icon (inline SVG - Unicode safe)
  const appIcon = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect fill="#059669" width="100" height="100" rx="20"/>
      <text x="50" y="70" text-anchor="middle" font-size="60" fill="white">📒</text>
    </svg>
  `);
  
  let data = {
    title: 'বাকির খাতা',
    body: 'নতুন আপডেট আছে!',
    icon: appIcon,
    badge: appIcon
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: [200, 100, 200],
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      actions: data.actions || []
    })
  );
});

// ============================================
// 👆 Notification Click Handler
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.action);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/Bakir-khata/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // যদি অ্যাপ ইতিমধ্যে খোলা থাকে
        for (let client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // না থাকলে নতুন window খুলুন
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// ❌ Notification Close Handler
// ============================================
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification closed');
});

console.log('🔔 Notification handlers ready');

console.log('🚀 বাকির খাতা Service Worker loaded');