const CACHE_NAME='nexus-shell-v1';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('push',event=>{
  let data={title:'NEXUS',body:'새로운 알림이 있습니다.',url:'./'};
  try{data={...data,...(event.data?event.data.json():{})};}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'./icons/nexus.svg',badge:'./icons/nexus.svg',tag:data.tag||'nexus-notification',data:{url:data.url||'./'},renotify:false,vibrate:data.vibrate||[180]}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client){client.navigate(target);return client.focus();}}
    return self.clients.openWindow(target);
  }));
});