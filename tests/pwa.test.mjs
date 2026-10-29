import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture(){
 const entries=new Map(),handlers={};let network=true;
 const cache={async put(k,v){entries.set(typeof k==='string'?k:k.url,v.clone());},async addAll(urls){for(const u of urls)entries.set(u,new Response('asset'));},async add(u){entries.set(u,new Response('asset'));},async match(req){return entries.get(typeof req==='string'?req:req.url)?.clone();}};
 const caches={async open(){return cache;},async keys(){return ['arialink-shell-old','other-app'];},async delete(k){entries.set('deleted:'+k,true);return true;},match:r=>cache.match(r)};
 const self={location:{origin:'https://app.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting(){}};
 const context={self,caches,URL,fetch:async()=>{if(!network)throw new Error('Offline');return new Response('<html><script src="/_next/static/chunk.js"></script><link href="/_next/static/style.css" rel="stylesheet"></html>',{headers:{'content-type':'text/html'}});}};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 return {handlers,entries,offline(){network=false;}};
}
test('PWA installation precaches the HTML shell, scripts, styles and icons',async()=>{
 const f=fixture();let install;f.handlers.install({waitUntil:p=>install=p});await install;
 for(const path of ['/','/_next/static/chunk.js','/_next/static/style.css','/icon-192.png','/icon-512.png'])assert.ok(f.entries.has(path),path);
});
test('PWA never intercepts API or cross-origin calls, serves cached shell offline',async()=>{
 const f=fixture();let task;f.handlers.install({waitUntil:p=>task=p});await task;f.offline();
 let intercepted=false;f.handlers.fetch({request:{url:'https://app.test/api/state',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 f.handlers.fetch({request:{url:'https://external.test/',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 let response;f.handlers.fetch({request:{url:'https://app.test/',method:'GET',mode:'navigate'},respondWith:p=>response=p,waitUntil:()=>{}});assert.ok((await (await response).text()).includes('/_next/static/chunk.js'));
});
test('PWA activation only removes older ARIALink caches',async()=>{
 const f=fixture();let task;f.handlers.activate({waitUntil:p=>task=p});await task;assert.ok(f.entries.has('deleted:arialink-shell-old'));assert.equal(f.entries.has('deleted:other-app'),false);
});
