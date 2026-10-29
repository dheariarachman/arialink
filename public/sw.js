const CACHE='arialink-shell-v3';
const SHELL=['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),response=await fetch('/',{cache:'reload'});
  if(!response.ok)throw new Error('App shell unavailable');
  const html=await response.clone().text();await cache.put('/',response);
  const assets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')).filter(x=>x.startsWith('/_next/static/'));
  await cache.addAll([...new Set([...SHELL,...assets])]);
 })());
});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('arialink-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{
 if(event.data==='SKIP_WAITING')self.skipWaiting();
 if(event.data?.type==='PRECACHE_ASSETS'){
  const urls=(event.data.urls||[]).filter(x=>{try{const u=new URL(x,self.location.origin);return u.origin===self.location.origin&&u.pathname.startsWith('/_next/static/');}catch{return false;}});
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(urls.map(u=>cache.add(u).catch(()=>{})))));
 }
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 // Never cache a React flight response or authenticated API response as the HTML shell.
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{if(res.ok&&res.headers.get('content-type')?.includes('text/html')){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('/',copy)));}return res;}).catch(()=>caches.match('/')));return;
 }
 if(url.pathname.startsWith('/_next/static/')||SHELL.includes(url.pathname))event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}return res;})));
});
