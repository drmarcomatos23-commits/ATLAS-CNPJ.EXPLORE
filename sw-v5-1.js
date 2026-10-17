const CACHE_NAME='atlas-legalizacao-v5.1-static-2';
const CORE_ASSETS=['/index.html','/manifest.webmanifest','/atlas-pwa-icon.svg','/atlas-dashboard-brand.svg'];
const STATIC_EXT=/\.(?:css|js|svg|png|webp|ico|woff2?)$/i;

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(CORE_ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('atlas-legalizacao-')&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirstNavigation(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response?.ok)await cache.put('/index.html',response.clone());
    return response;
  }catch(error){
    const cached=await cache.match('/index.html');
    if(cached)return cached;
    throw error;
  }
}

async function staticNetworkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response?.ok&&response.type==='basic')await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request);
    if(cached)return cached;
    return Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method !== 'GET')return;

  const url=new URL(request.url);
  if(url.origin !== self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;

  if(request.mode === 'navigate'){
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if(STATIC_EXT.test(url.pathname))event.respondWith(staticNetworkFirst(request));
});
