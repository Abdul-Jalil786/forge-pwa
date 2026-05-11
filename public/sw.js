const CACHE='forge-v31';
const ASSETS=['/','/index.html','/manifest.json','/data.js','/workout.js','/pages.js','/app.js','/login.html','/login.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/api/'))return;
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>c)));
});

self.addEventListener("push", (e) => {
  let data = { title: "Forge", body: "Reminder" };
  try { data = e.data ? e.data.json() : data; } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body || "",
    tag: data.mealId || "forge-reminder",
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow("/"));
});
