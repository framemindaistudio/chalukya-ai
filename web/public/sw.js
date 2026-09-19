// Offline-first service worker: the sculpture model, ONNX runtime, data and app shell are cached
// after the first visit, so scanning and the guide keep working inside the caves with no signal.
const CACHE = 'chalukya-v3'
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/models/sculpture.onnx', '/models/sculpture_labels.json',
  '/models/sculpture_calibration.json', '/models/intent_model.json', '/ort/ort-wasm-simd-threaded.wasm', '/ort/ort-wasm-simd-threaded.mjs']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return
  const isTile = /basemaps\.cartocdn\.com|tile\.openstreetmap/.test(url.host)
  if (url.origin !== location.origin && !isTile && !/fonts\.(googleapis|gstatic)\.com/.test(url.host)) return
  // cache-first for static assets and map tiles; network-first for navigations
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put('/', r.clone())); return r }).catch(() => caches.match('/')))
    return
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok || r.type === 'opaque') caches.open(CACHE).then((c) => c.put(e.request, r.clone()))
    return r
  })))
})
