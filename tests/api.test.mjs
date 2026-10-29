import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../lib/api.mjs';
import {testDatabase} from './db.mjs';
const ORIGIN='https://arialink.test';
function request(path,method='GET',data,cookie='',origin=ORIGIN){return new Request(ORIGIN+'/api/'+path,{method,headers:{origin,'content-type':'application/json',cookie},...(data?{body:JSON.stringify(data)}:{})});}
async function setup(){const DB=testDatabase(),env={DB,SETUP_TOKEN:'unit-test-secret-at-least-24-characters'};let res=await handle(request('setup','POST',{name:'Owner',email:'owner@example.test',password:'secure-password-123',setupToken:env.SETUP_TOKEN}),env);assert.equal(res.status,201);res=await handle(request('login','POST',{email:'owner@example.test',password:'secure-password-123'}),env);assert.equal(res.status,200);const cookie=res.headers.get('set-cookie').split(';')[0],user=(await res.json()).user;return {DB,env,cookie,user};}
test('authentication, setup lock, admin-only accounts and deactivation',async()=>{
 const {DB,env,cookie,user}=await setup();
 assert.equal((await handle(request('state'),env)).status,401);
 assert.equal((await handle(request('setup','POST',{setupToken:env.SETUP_TOKEN}),env)).status,409);
 assert.equal((await handle(request('users','POST',{name:'Cashier',email:'cashier@example.test',password:'cashier-password-123'},cookie),env)).status,201);
 let res=await handle(request('login','POST',{email:'cashier@example.test',password:'cashier-password-123'}),env);const memberCookie=res.headers.get('set-cookie').split(';')[0],member=(await res.json()).user;
 assert.equal((await handle(request('users','GET',null,memberCookie),env)).status,403);
 assert.equal((await handle(request('state','GET',null,memberCookie),env)).status,200);
 assert.equal((await handle(request('users','PATCH',{id:user.id,active:false},cookie),env)).status,400);
 assert.equal((await handle(request('users','PATCH',{id:member.id,active:false},cookie),env)).status,200);
 assert.equal((await handle(request('state','GET',null,memberCookie),env)).status,401);
 assert.equal((await handle(request('logout','POST',{},cookie,'https://evil.test'),env)).status,403);
 await handle(request('logout','POST',{},cookie),env);assert.equal((await handle(request('me','GET',null,cookie),env)).status,401);DB.close();
});
test('mutations retry exactly once, conflicts require review, stale deletes cannot erase newer edits',async()=>{
 const {DB,env,cookie,user}=await setup();
 const m={id:crypto.randomUUID(),userId:user.id,recordId:crypto.randomUUID(),kind:'transaction',baseVersion:0,deleted:false,payload:{received:505000,cost:500000,type:'Tarik Tunai'}};
 let res=await handle(request('mutations','POST',m,cookie),env);assert.equal(res.status,200);const first=(await res.json()).record;assert.equal(first.version,1);
 res=await handle(request('mutations','POST',m,cookie),env);assert.equal(res.status,200);assert.equal((await res.json()).record.version,1);
 const edit={...m,id:crypto.randomUUID(),baseVersion:1,payload:{...m.payload,received:510000}};res=await handle(request('mutations','POST',edit,cookie),env);assert.equal((await res.json()).record.version,2);
 res=await handle(request('mutations','POST',{...edit,id:crypto.randomUUID(),deleted:true},cookie),env);assert.equal(res.status,409);assert.equal((await res.json()).current.payload.received,510000);
 res=await handle(request('mutations','POST',{...edit,id:crypto.randomUUID(),baseVersion:2,deleted:true},cookie),env);assert.equal(res.status,200);assert.equal((await res.json()).record.deleted,true);
 const state=await (await handle(request('state','GET',null,cookie),env)).json();assert.equal(state.records.length,1);assert.equal(state.records[0].deleted,true);
 assert.equal((await handle(request('mutations','POST',{...m,id:crypto.randomUUID(),userId:'different-user'},cookie),env)).status,403);DB.close();
});
test('shared data; cash counts independent of transactions; validation enforced on server',async()=>{
 const {DB,env,cookie,user}=await setup();
 const make=(kind,payload,recordId=crypto.randomUUID())=>({id:crypto.randomUUID(),userId:user.id,recordId,kind,payload,baseVersion:0,deleted:false});
 assert.equal((await handle(request('mutations','POST',make('balance',{name:'BCA',category:'Rekening',amount:5000000}),cookie),env)).status,200);
 assert.equal((await handle(request('mutations','POST',make('cash',{counts:{100000:10}},'cash-global'),cookie),env)).status,200);
 assert.equal((await handle(request('mutations','POST',make('transaction',{}),cookie),env)).status,200);
 assert.equal((await handle(request('mutations','POST',make('transaction',{received:-1}),cookie),env)).status,400);
 assert.equal((await handle(request('mutations','POST',make('cash',{counts:{}},'wrong-cash-id'),cookie),env)).status,400);
 const state=(await (await handle(request('state','GET',null,cookie),env)).json()).records;
 assert.equal(state.find(r=>r.kind==='balance').payload.amount,5000000);assert.equal(state.find(r=>r.kind==='cash').payload.counts[100000],10);DB.close();
});
test('login rate limited; wrong setup secret rejected',async()=>{
 const {DB,env}=await setup();
 for(let i=0;i<10;i++)assert.equal((await handle(request('login','POST',{email:'none@example.test',password:'wrong'},''),env)).status,401);
 assert.equal((await handle(request('login','POST',{email:'none@example.test',password:'wrong'}),env)).status,429);DB.close();
 const fresh=testDatabase();assert.equal((await handle(request('setup','POST',{setupToken:'wrong'}),{DB:fresh,SETUP_TOKEN:'correct-secret-more-than-24-characters'})).status,403);fresh.close();
});
