// The game's assets kept in the browser between visits (the scans, the props, the people, the
// textures, the voices, the mocap): served from the cache at once, and fetched again behind it so a
// rebuilt file shows on the next visit (a hard refresh, Cmd+Shift+R, skips this altogether). The code
// itself isn't cached here: the dev server and a deploy's hashed bundles look after that.
const CACHE = 'gl-assets-v1';
const ASSETS = /^\/(models|textures|voices|anims)\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req);
    const fresh = fetch(req).then((res) => {
      if (res.ok && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    if (hit) { e.waitUntil(fresh); return hit; }
    return fresh;
  }));
});
