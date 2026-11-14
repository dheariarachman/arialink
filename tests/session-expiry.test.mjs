import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../lib/offline.mjs';

test('protected API 401 requests login while other failures do not',async()=>{
 const originalFetch=globalThis.fetch,originalWindow=globalThis.window,originalEvent=globalThis.CustomEvent;
 const events=[];
 globalThis.window={dispatchEvent:event=>events.push(event)};
 globalThis.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Silakan masuk kembali.'}),{status:401});
  await assert.rejects(api('state'),e=>e.status===401&&e.message==='Silakan masuk kembali.');
  assert.equal(events.length,1);
  assert.equal(events[0].type,'arialink:session-expired');
  assert.equal(events[0].detail,'Silakan masuk kembali.');
  await assert.rejects(api('login'),e=>e.status===401);
  assert.equal(events.length,1);
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Dilarang.'}),{status:403});
  await assert.rejects(api('users'),e=>e.status===403);
  assert.equal(events.length,1);
  globalThis.fetch=async()=>{throw new TypeError('Offline');};
  await assert.rejects(api('me'),/Offline/);
  assert.equal(events.length,1);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
  if(originalEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=originalEvent;
 }
});
