const CACHE_NAME='nexus-shell-v2';
const APP_SHELL=['./','./manifest.webmanifest','./icons/nexus.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL).catch(()=>{})));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('nexus-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='NEXUS_SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put('./',response.clone());}
        return response;
      }catch{
        const cached=await caches.match('./');
        return cached||new Response('NEXUS 연결을 기다리는 중입니다. 인터넷에 다시 연결한 뒤 새로고침해 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }
  if(request.destination==='script'||request.destination==='style'||request.destination==='image'||request.destination==='font'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const cached=await cache.match(request);
      if(cached)return cached;
      try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}
      catch{return cached||Response.error();}
    })());
  }
});
self.addEventListener('push',event=>{
  let data={title:'NEXUS',body:'새로운 알림이 있습니다.',url:'./'};
  try{data={...data,...(event.data?event.data.json():{})};}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'./icons/nexus.svg',badge:'./icons/nexus.svg',tag:data.tag||'nexus-notification',data:{url:data.url||'./'},renotify:true,vibrate:data.vibrate||[180]}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client){client.navigate(target);return client.focus();}}
    return self.clients.openWindow(target);
  }));
});
