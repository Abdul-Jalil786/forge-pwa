const CACHE='forge-v4';
const ASSETS=['/','/index.html','/manifest.json','/data.js','/workout.js','/pages.js','/app.js','/login.html','/login.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/api/'))return;
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>c)));
});
