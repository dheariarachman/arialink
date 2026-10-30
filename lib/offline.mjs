import {normalize,validateChange} from './domain.mjs';
// IndexedDB stores one isolated snapshot/outbox per signed-in account.
const DB_NAME='arialink-offline-v1';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function read(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readonly'),r=tx.objectStore('kv').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}
async function change(key,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite'),s=tx.objectStore('kv'),r=s.get(key);let result;r.onsuccess=()=>{try{result=fn(r.result);s.put(result,key);}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>db.close();});}
export async function lastUser(){return read('last-user');}
export async function rememberUser(user){await change('last-user',()=>user);await change('user:'+user.id,s=>({...s,profile:user,records:s?.records||[],queue:s?.queue||[]}));}
export async function forgetUser(){await change('last-user',()=>null);}
export async function loadLocal(userId){return await read('user:'+userId)||{records:[],queue:[]};}
export function project(state){const map=new Map(state.records.map(r=>[r.id,r]));for(const m of state.queue){map.set(m.recordId,{id:m.recordId,kind:m.kind,payload:m.payload,version:m.baseVersion+1,deleted:m.deleted,pending:true,updatedAt:m.createdAt,authorId:m.userId});}return [...map.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function enqueue(userId,kind,recordId,payload,deleted=false,expectedVersion){
 return change('user:'+userId,s=>{if(!s)throw new Error('Penyimpanan akun belum tersedia.');const existing=project(s).find(r=>r.id===recordId);if(expectedVersion!==undefined&&(existing?.version||0)!==expectedVersion)throw new Error('Catatan berubah saat form terbuka. Tutup lalu buka kembali untuk meninjau data terbaru.');
 payload=normalize(kind,payload);validateChange(kind,existing?normalize(kind,existing.payload):null,payload,deleted);
 const mutation={id:crypto.randomUUID(),userId,recordId,kind,payload,deleted,baseVersion:existing?.version||0,createdAt:new Date().toISOString()};
 // A create deleted before its first sync can disappear from the queue entirely.
 const initial=s.queue.find(m=>m.recordId===recordId&&m.baseVersion===0);
 if(deleted&&initial&&!s.records.some(r=>r.id===recordId))return {...s,queue:s.queue.filter(m=>m.recordId!==recordId)};
 return {...s,queue:[...s.queue,mutation]};});
}
export async function api(path,options={}){
 const response=await fetch('/api/'+path,{...options,headers:{'Content-Type':'application/json',...options.headers},cache:'no-store'});
 const data=await response.json().catch(()=>({error:'Respons server tidak dapat dibaca.'}));
 if(!response.ok){const e=new Error(data.error||'Permintaan gagal.');e.status=response.status;e.data=data;throw e;}return data;
}
export async function synchronize(userId){
 const run=async()=>{
  const {user}=await api('me');if(user.id!==userId){const e=new Error('Akun server berubah. Masuk kembali dengan akun yang memiliki antrean ini.');e.status=401;throw e;}
  while(true){const state=await loadLocal(userId),m=state.queue[0];if(!m)break;
   try{const {record}=await api('mutations',{method:'POST',body:JSON.stringify(m)});await change('user:'+userId,s=>({...s,records:[...s.records.filter(r=>r.id!==record.id),record],queue:s.queue.filter(q=>q.id!==m.id)}));}
   catch(e){if(e.status===409)e.conflict={mutation:m,current:e.data.current};throw e;}
  }
  const {records}=await api('state');
  return change('user:'+userId,s=>({...s,records,lastSync:new Date().toISOString()}));
 };
 // Tabs sharing the same browser must not send the same queue concurrently.
 return navigator.locks?navigator.locks.request('arialink-sync:'+userId,run):run();
}
export async function resolveConflict(userId,conflict,useLocal){return change('user:'+userId,s=>{
 const id=conflict.mutation.recordId,local=project(s).find(r=>r.id===id),current=conflict.current;
 const records=s.records.filter(r=>r.id!==id);if(current)records.push(current);
 const queue=s.queue.filter(m=>m.recordId!==id);
 if(useLocal&&local&&!(local.deleted&&current?.deleted)){validateChange(local.kind,current&&!current.deleted?normalize(local.kind,current.payload):null,normalize(local.kind,local.payload),local.deleted);const newId=current?.deleted?crypto.randomUUID():id;queue.push({id:crypto.randomUUID(),userId,recordId:newId,kind:local.kind,payload:local.payload,deleted:local.deleted,baseVersion:current&&!current.deleted?current.version:0,createdAt:new Date().toISOString()});}
 return {...s,records,queue};});}


