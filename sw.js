const CACHE_NAME='tabi-mate-v68';
const APP_ASSETS=['./','./index.html','./styles.css?v=18','./config.js','./data.js','./places.final.js','./transport-data.js','./goshuin-guide.js?v=7','./collection-registry.v3.js','./travel-quality.js?v=7','./planning-policy.js?v=3','./input-routing.js?v=4','./requirement-pipeline.js?v=2','./planner-engine.js?v=5','./itinerary-core.js?v=4','./trip-requirements-state.js?v=3','./travel-graph.js?v=1','./entity-resolver.js?v=1','./asakusa-p0.js?v=4','./popular-entity-registry.js?v=2','./app.v50.js?v=53','./companion.v30.js?v=34','./manifest.webmanifest','./vendor/leaflet/leaflet.css','./vendor/leaflet/leaflet.js','./vendor/leaflet/marker-icon.png','./vendor/leaflet/marker-icon-2x.png','./vendor/leaflet/marker-shadow.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy))}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok&&new URL(event.request.url).origin===location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy))}
    return response;
  })));
});
