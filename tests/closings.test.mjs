import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../lib/api.mjs';
import {mutate} from '../lib/data.mjs';
import {closingReview,closeDay,closingReport} from '../lib/closings.mjs';
import {balanceSnapshot,closingComparison,closingDays,normalize,validateChange,todayWib} from '../lib/domain.mjs';
import {testDatabase} from './db.mjs';

async function fixture(){
 const db=testDatabase(),user={id:'closing-user',name:'Owner'};
 await db.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,'closing@test','hash','admin','2026-10-01')").bind(user.id,user.name).run();
 const write=(payload,previous=null,deleted=false)=>mutate(db,user,{id:crypto.randomUUID(),recordId:previous?.id||crypto.randomUUID(),kind:previous?.kind||'balance',baseVersion:previous?.version||0,deleted,payload});
 const bank=await write({name:'BCA',category:'Rekening',amount:12000});
 const input=async()=>{const r=await closingReview(db);return {id:crypto.randomUUID(),userId:user.id,businessDate:r.businessDate,revision:r.revision,snapshotVersion:r.snapshotVersion,financialRevision:r.financialRevision,previousId:r.previous?.id??null,explanation:'Operasional'};};
 return {db,user,write,bank,input};
}
async function seedPrevious(db,user,{date,total=15000,revision=0}={}){
 const day=new Date();day.setUTCDate(day.getUTCDate()-2);
 const businessDate=date||todayWib(day),id=crypto.randomUUID();
 await db.prepare('INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total) VALUES (?,?,?,?,?,?,?,?)').bind(id,businessDate,day.toISOString(),user.id,user.name,revision,JSON.stringify([{id:'prior-bank',kind:'balance',name:'BCA',category:'Rekening',amount:total,version:1}]),total).run();
 return id;
}
test('closing uses server totals, retries once, is permanent and ignores transaction/debt totals',async()=>{
 const {db,user,write,bank,input}=await fixture();
 for(const [kind,payload] of [['transaction',{received:999999,cost:100}],['debt',{type:'Utang',name:'Supplier',amount:999999}]])await mutate(db,user,{id:crypto.randomUUID(),recordId:crypto.randomUUID(),kind,payload,baseVersion:0,deleted:false});
 const request=await input();
 const closing=await closeDay(db,user,{...request,total:999999,snapshot:[],authorName:'Spoofed'});
 assert.equal(closing.total,12000);assert.equal(closing.authorName,'Owner');assert.equal(closing.previousTotal,null);
 assert.equal(closing.snapshot.find(r=>r.kind==='cash').amount,0);
 assert.deepEqual(await closeDay(db,user,request),closing);
 await assert.rejects(closeDay(db,user,{...request,id:crypto.randomUUID()}),e=>e.status===409);
 await write({...bank.payload,amount:11000,adjustmentReason:'Operasional'},bank);
 const saved=(await closingReport(db)).closings[0];assert.equal(saved.total,12000);assert.equal(saved.snapshot.find(r=>r.id===bank.id).amount,12000);
 await assert.rejects(db.prepare('UPDATE daily_closings SET total=1 WHERE id=?').bind(closing.id).run(),/immutable/);
 await assert.rejects(db.prepare('DELETE FROM daily_closings WHERE id=?').bind(closing.id).run(),/immutable/);
 db.close();
});
test('stale values, new/deleted accounts and previous closing changes require refreshed review',async()=>{
 const {db,user,write,bank,input}=await fixture();
 let request=await input();
 let changed=await write({...bank.payload,amount:14000},bank);
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);
 request=await input();const extra=await write({name:'DANA',category:'E-wallet',amount:0});
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);
 request=await input();await write(extra.payload,extra,true);
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);
 request=await input();await seedPrevious(db,user);
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);
 request=await input();
 await assert.rejects(closeDay(db,user,{...request,explanation:'  '}),e=>e.status===400);
 const saved=await closeDay(db,user,request);assert.equal(saved.total,14000);assert.equal(saved.previousTotal,15000);assert.ok(saved.previousDate<saved.businessDate);
 assert.equal((await closingReview(db)).total,changed.payload.amount);db.close();
});
test('compare-and-insert catches a write after the server review, and racing closers save only once',async()=>{
 const {db,user,write,bank,input}=await fixture();const request=await input();let injected=false;
 const racing={prepare(sql){const statement=db.prepare(sql);return sql.startsWith('INSERT INTO daily_closings')?{bind(...args){return {async run(){if(!injected){injected=true;await write({...bank.payload,amount:13000},bank);}return statement.bind(...args).run();}};}}:statement;}};
 await assert.rejects(closeDay(racing,user,request),e=>e.status===409);
 assert.equal((await closingReport(db)).closings.length,0);
 const fresh=await input();const outcomes=await Promise.allSettled([closeDay(db,user,fresh),closeDay(db,user,{...fresh,id:crypto.randomUUID()})]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await closingReport(db)).closings.length,1);db.close();
});
test('WIB date is server controlled, including the final SQL midnight guard',async()=>{
 const {db,user,input}=await fixture();const request=await input();
 assert.equal(todayWib(new Date('2026-10-31T16:59:59Z')),'2026-10-31');
 assert.equal(todayWib(new Date('2026-10-31T17:00:00Z')),'2026-11-01');
 await assert.rejects(closeDay(db,user,{...request,businessDate:'2020-01-01'}),e=>e.status===409);
 // Simulate the date changing after review but before the INSERT executes.
 const midnight={prepare(sql){return db.prepare(sql.startsWith('INSERT INTO daily_closings')?sql.replace("date('now','+7 hours')=?","date('now','+7 hours','+1 day')=?"):sql);}};
 await assert.rejects(closeDay(midnight,user,request),e=>e.status===409);
 assert.equal((await closingReport(db)).closings.length,0);db.close();
});
test('balance/cash decreases and removals need reasons; audit is atomic, retry safe and captures names',async()=>{
 const {db,user,write,bank}=await fixture();
 await assert.rejects(write({...bank.payload,amount:11000},bank),e=>e.status===400);
 await assert.rejects(write(bank.payload,bank,true),e=>e.status===400);
 const changed=await write({...bank.payload,name:'BCA baru',amount:11000,adjustmentReason:'  Biaya operasional  '},bank);
 const mutation={id:crypto.randomUUID(),recordId:changed.id,kind:'balance',baseVersion:changed.version,deleted:true,payload:{...changed.payload,adjustmentReason:'Rekening ditutup'}};
 await mutate(db,user,mutation);await mutate(db,user,mutation);
 await db.prepare("UPDATE users SET name='Renamed owner' WHERE id=?").bind(user.id).run();
 const report=await closingReport(db);assert.equal(report.history.length,3);assert.equal(report.revision,3);
 assert.equal(report.history[0].after,0);assert.equal(report.history[0].before,11000);assert.equal(report.history[0].deleted,true);assert.equal(report.history[0].authorName,'Owner');
 assert.equal(report.history[1].reason,'Biaya operasional');assert.equal(report.history[1].previousName,'BCA');
 const cash=normalize('cash',{counts:{1000:5}}),less=normalize('cash',{counts:{1000:4}});
 assert.throws(()=>validateChange('cash',cash,less),/alasan/);
 validateChange('cash',cash,normalize('cash',{...less,adjustmentReason:'Belanja'}));
 assert.throws(()=>normalize('balance',{...bank.payload,adjustmentReason:'x'.repeat(1001)}));db.close();
});
test('closing comparisons reconcile by identity, preserve zero, and leave skipped days unclosed',()=>{
 const before=[{id:'bank',name:'BCA',category:'Rekening',amount:10000},{id:'cash-global',name:'Kas',category:'Kas',amount:5000}],after=[{id:'bank',name:'BCA baru',category:'Rekening',amount:10000},{id:'cash-global',name:'Kas',category:'Kas',amount:4000},{id:'wallet',name:'DANA',category:'E-wallet',amount:0}];
 const rows=closingComparison(after,before);assert.equal(rows.reduce((s,r)=>s+r.delta,0),-1000);assert.equal(rows[0].status,'renamed');assert.equal(rows.at(-1).status,'added');
 assert.equal(closingComparison([],before).reduce((s,r)=>s+r.delta,0),-15000);
 assert.equal(closingComparison(after,null)[0].before,null);
 const closings=[{businessDate:'2026-10-01',total:12000,previousTotal:null},{businessDate:'2026-10-02',total:15000,previousTotal:12000},{businessDate:'2026-10-03',total:14000,previousTotal:15000}];
 assert.deepEqual(closings.map(c=>c.previousTotal==null?null:c.total-c.previousTotal),[null,3000,-1000]);
 const days=closingDays(closings,'2026-10','2026-10-06');assert.equal(days.length,31);assert.equal(days[3].status,'missing');assert.equal(days[3].closing,null);assert.equal(days[5].status,'provisional');assert.equal(days[6].status,'future');
 assert.equal(closingDays([],'2028-02','2028-02-29').length,29);
 assert.equal(balanceSnapshot([{id:'deleted',kind:'balance',deleted:true,payload:{amount:999}},{id:'tx',kind:'transaction',payload:{received:999}}]).reduce((s,r)=>s+r.amount,0),0);
});
test('closing endpoints require active authentication and same-origin writes; members share reports',async()=>{
 const {db,user,input}=await fixture();const env={DB:db};
 await db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)").bind(await (await import('../lib/auth.mjs')).digest('test-token'),user.id,Date.now()+60000).run();
 const call=(path,method='GET',data,cookie='arialink_session=test-token',origin='https://test.local')=>handle(new Request('https://test.local/api/'+path,{method,headers:{cookie,origin,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
 assert.equal((await call('closings/review','GET',null,'')).status,401);
 let request=await input();assert.equal((await call('closings','POST',request,'')).status,401);
 assert.equal((await call('closings','POST',request,undefined,'https://evil.local')).status,403);
 assert.equal((await call('closings','POST',{...request,userId:'other-user'})).status,403);
 await db.prepare("UPDATE users SET role='member' WHERE id=?").bind(user.id).run();
 assert.equal((await call('closings/review')).status,200);
 assert.equal((await call('closings','POST',request)).status,200);
 const state=await (await call('state')).json();assert.equal(state.closingReport.closings.length,1);
 assert.equal((await call('closings','PATCH',request)).status,404);
 await db.prepare('UPDATE users SET active=0 WHERE id=?').bind(user.id).run();
 assert.equal((await call('closings/review')).status,401);
 assert.equal((await call('closings','POST',request)).status,401);db.close();
});

test('empty balances close at zero and invalid explanation/IDs are rejected',async()=>{
 const {db,user,write,bank,input}=await fixture();await write({...bank.payload,adjustmentReason:'Rekening ditutup'},bank,true);
 const request=await input();
 await assert.rejects(closeDay(db,user,{...request,id:12345678}),e=>e.status===400);
 await assert.rejects(closeDay(db,user,{...request,explanation:'x'.repeat(1001)}),e=>e.status===400);
 const closing=await closeDay(db,user,{...request,explanation:null});assert.equal(closing.total,0);assert.equal(closing.explanation,null);db.close();
});
