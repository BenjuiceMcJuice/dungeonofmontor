var CACHE_NAME = 'dom-v1'
var ASSETS = [
  '/dungeonofmontor/',
  '/dungeonofmontor/index.html',
]

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME })
          .map(function(k) { return caches.delete(k) })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function(e) {
  // Network-first for API calls
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('groq.com')) {
    e.respondWith(fetch(e.request))
    return
  }
  // Cache-first for app assets
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        return caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, response.clone())
          return response
        })
      })
    })
  )
})
