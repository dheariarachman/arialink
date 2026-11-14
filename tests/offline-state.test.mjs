import test from 'node:test';
import assert from 'node:assert/strict';
import {project} from '../lib/offline.mjs';

test('partial cached snapshots render without losing queued changes',()=>{
 const mutation={recordId:'pending-debt',kind:'debt',payload:{type:'Utang',amount:500000},baseVersion:0,createdAt:'2026-11-14T01:00:00Z',userId:'owner'};
 const state={queue:[mutation],pendingGoodsCredit:{id:'pending-credit'}};
 const before=structuredClone(state);
 assert.equal(project(state)[0].id,mutation.recordId);
 assert.equal(project(state)[0].pending,true);
 assert.deepEqual(state,before);
 assert.deepEqual(project({records:[]}),[]);
 assert.deepEqual(project({}),[]);
});

test('loading a partial stored snapshot supplies defaults without writing or dropping pending data',async()=>{
 const {loadLocal}=await import('../lib/offline.mjs');
 const original=globalThis.indexedDB;
 const stored={queue:[{id:'queued-payment'}],pendingGoodsCredit:{id:'pending-credit'},profile:{id:'owner'}};
 let writes=0;
 globalThis.indexedDB={open(){
  const request={};
  queueMicrotask(()=>{
   request.result={close(){},transaction(store,mode){
    assert.equal(mode,'readonly');
    const tx={objectStore(){return {get(key){
     assert.equal(key,'user:owner');
     const read={result:stored};queueMicrotask(()=>{read.onsuccess();tx.oncomplete();});return read;
    },put(){writes++;}};}};
    return tx;
   }};
   request.onsuccess();
  });
  return request;
 }};
 try{
  const result=await loadLocal('owner');
  assert.deepEqual(result.records,[]);
  assert.deepEqual(result.queue,stored.queue);
  assert.deepEqual(result.pendingGoodsCredit,stored.pendingGoodsCredit);
  assert.deepEqual(result.profile,stored.profile);
  assert.equal(writes,0);
  assert.equal('records' in stored,false);
 }finally{if(original===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=original;}
});
