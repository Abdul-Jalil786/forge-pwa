const CACHE='forge-v85';
const ASSETS=['/','/index.html','/manifest.json','/targets.js','/programme-shared.js','/proactive-core.js','/data.js','/workout.js','/pages.js','/app.js','/login.html','/login.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});

self.addEventListener('fetch',e=>{
  const url=e.request.url;
  // API calls: passthrough, no cache
  if(url.includes('/api/'))return;
  // HTML and JS: network-first, fall back to cache offline
  if(url.endsWith('.html')||url.endsWith('.js')||url.endsWith('/')){
    e.respondWith(
      fetch(e.request).then(r=>{
        const clone=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return r;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }
  // Everything else (images, fonts, manifest): cache-first
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
    const clone=r.clone();
    caches.open(CACHE).then(ca=>ca.put(e.request,clone));
    return r;
  }).catch(()=>c)));
});

self.addEventListener("push", (e) => {
  let data = { title: "Forge", body: "Reminder" };
  try { data = e.data ? e.data.json() : data; } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body || "",
    tag: data.tag || data.mealId || "forge-reminder",
    renotify: true,
    // Phase 41g: cron payloads can override vibration + persistence per notification type
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: !!data.requireInteraction,
    icon: "/icon-192.png",
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow("/"));
});
