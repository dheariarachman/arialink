import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './db.mjs';
import {mutate} from '../lib/data.mjs';
import {closeDay,closingReview,closingReport} from '../lib/closings.mjs';
import {financialSnapshot,closingExplanationRequired,normalize,settleTransaction,addDebtPayment,todayWib} from '../lib/domain.mjs';

async function fixture(options){
 const db=testDatabase(options),user={id:'snapshot-user',name:'Owner'};
 await db.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,'snapshot@test','hash','admin','2026-10-01')").bind(user.id,user.name).run();
 const write=(kind,payload,record=null,deleted=false)=>mutate(db,user,{id:crypto.randomUUID(),recordId:record?.id||(kind==='cash'?'cash-global':crypto.randomUUID()),kind,payload,baseVersion:record?.version||0,deleted});
 const input=async()=>{const r=await closingReview(db);return {id:crypto.randomUUID(),userId:user.id,businessDate:r.businessDate,revision:r.revision,snapshotVersion:r.snapshotVersion,financialRevision:r.financialRevision,previousId:r.previous?.id??null,explanation:'Saldo akhir'};};
 return {db,user,write,input};
}
test('closing saves one final DANA value and final debt positions, not edits or payment timelines',async()=>{
 const {db,user,write,input}=await fixture();
 let dana=await write('balance',{name:'DANA',category:'E-wallet',amount:800000});
 dana=await write('balance',{...dana.payload,amount:1200000},dana);
 dana=await write('balance',{...dana.payload,amount:1000000,adjustmentReason:'Koreksi akhir'},dana);
 const debt=await write('debt',{type:'Utang',name:'Supplier',amount:300000,notes:'Utang awal'});
 const receivable=await write('debt',{type:'Piutang',name:'Sari',amount:200000});
 const credit=await write('transaction',{type:'Tarik Tunai',received:150000,cost:140000,adminIncluded:false,separateAdmin:5000,credit:{name:'Pelanggan transfer'}});
 let settled=await write('debt',{type:'Piutang',name:'Sudah lunas',amount:50000});
 settled=await write('debt',addDebtPayment(settled.payload,{id:crypto.randomUUID(),amount:50000,date:settled.payload.date}),settled);
 const deleted=await write('debt',{type:'Utang',name:'Dihapus',amount:900000});await write('debt',deleted.payload,deleted,true);
 const request=await input(),closing=await closeDay(db,user,{...request,financial:{totals:{adjusted:999}}});
 assert.equal(closing.snapshotVersion,4);assert.equal(closing.snapshot.filter(r=>r.id===dana.id).length,1);assert.equal(closing.snapshot.find(r=>r.id===dana.id).amount,1000000);
 assert.deepEqual(closing.financial.totals,{available:1000000,utang:300000,piutang:355000,adjusted:1055000});
 assert.equal(closing.financial.piutang.length,3);assert.equal(closing.financial.utang.length,1);
 const saved=closing.financial.piutang.find(r=>r.id===credit.id);assert.equal(saved.sourceKind,'transaction');assert.equal(saved.amount,155000);assert.equal(saved.remaining,155000);assert.equal(saved.transaction.separateAdmin,5000);
 assert.ok(closing.financial.piutang.find(r=>r.id===settled.id).settled);
 assert.ok([...closing.financial.utang,...closing.financial.piutang].every(r=>!('payments' in r)));
 await write('balance',{...dana.payload,name:'DANA baru',amount:900000,adjustmentReason:'Belanja'},dana);
 await write('debt',debt.payload,debt,true);
 await write('debt',addDebtPayment(receivable.payload,{id:crypto.randomUUID(),amount:200000,date:receivable.payload.date}),receivable);
 await write('transaction',settleTransaction(credit.payload,{id:crypto.randomUUID(),date:credit.payload.date}),credit);
 const historical=(await closingReport(db)).closings[0];assert.deepEqual(historical,closing);
 assert.equal(historical.financial.piutang.find(r=>r.id===receivable.id).remaining,200000);
 assert.deepEqual(await closeDay(db,user,request),closing);db.close();
});
test('financial freshness detects debt edits and credit settlements while ignoring ordinary transactions',async()=>{
 const {db,user,write,input}=await fixture();
 const debt=await write('debt',{type:'Utang',name:'Supplier',amount:3000});
 const tx=await write('transaction',{received:5000,credit:{name:'Sari'}});
 let request=await input();
 await write('debt',addDebtPayment(debt.payload,{id:crypto.randomUUID(),amount:3000,date:debt.payload.date}),debt);
 const review=await closingReview(db);assert.equal(review.revision,request.revision);assert.ok(review.financialRevision>request.financialRevision);
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);
 request=await input();await write('transaction',settleTransaction(tx.payload,{id:crypto.randomUUID(),date:tx.payload.date}),tx);
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);
 const plain=await write('transaction',{received:2000,cost:1000});request=await input();
 await write('transaction',{...plain.payload,received:3000},plain);
 assert.equal((await closingReview(db)).financialRevision,request.financialRevision);
 await write('transaction',{...plain.payload,credit:{name:'Pelanggan baru'}},{...plain,version:2});
 await assert.rejects(closeDay(db,user,request),e=>e.status===409);db.close();
});
test('final SQL guard catches a debt write after review, with no partial closing',async()=>{
 const {db,user,write,input}=await fixture();const debt=await write('debt',{type:'Utang',name:'Supplier',amount:3000}),request=await input();let injected=false;
 const racing={prepare(sql){const statement=db.prepare(sql);return sql.startsWith('INSERT INTO daily_closings')?{bind(...args){return {async run(){if(!injected){injected=true;await write('debt',{...debt.payload,name:'Supplier baru'},debt);}return statement.bind(...args).run();}};}}:statement;}};
 await assert.rejects(closeDay(racing,user,request),e=>e.status===409);
 assert.equal((await closingReport(db)).closings.length,0);db.close();
});
test('opposing Saldo and Utang changes require explanation even when grand total is unchanged',async()=>{
 const {db,user,write,input}=await fixture();
 const day=new Date(Date.now()-86400000),financial={utang:[],piutang:[],totals:{available:15000,utang:3000,piutang:2000,adjusted:14000}};
 await db.prepare('INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total,snapshot_version,financial_revision,financial_json) VALUES (?,?,?,?,?,0,?,15000,2,0,?)').bind('previous-complete',todayWib(day),day.toISOString(),user.id,user.name,'[]',JSON.stringify(financial)).run();
 await write('balance',{name:'DANA',category:'E-wallet',amount:14000});
 await write('debt',{type:'Utang',name:'Supplier',amount:2000});await write('debt',{type:'Piutang',name:'Sari',amount:2000});
 const request=await input(),review=await closingReview(db);assert.equal(review.financial.totals.adjusted,14000);assert.ok(closingExplanationRequired(review));
 await assert.rejects(closeDay(db,user,{...request,explanation:' '}),e=>e.status===400);
 const saved=await closeDay(db,user,request);assert.equal(saved.previousFinancialTotals.adjusted,14000);assert.equal(saved.financial.totals.utang,2000);db.close();
});
test('debt-only changes require explanation; legacy snapshots remain unavailable and old requests must refresh',async()=>{
 const {db,user,write,input}=await fixture();
 const day=new Date(Date.now()-86400000);
 await db.prepare('INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total) VALUES (?,?,?,?,?,0,?,0)').bind('legacy-closing',todayWib(day),day.toISOString(),user.id,user.name,'[]').run();
 await write('debt',{type:'Utang',name:'Supplier',amount:2000});
 let request=await input(),review=await closingReview(db);
 assert.equal(review.previous.financial,null);assert.equal(review.previous.snapshotVersion,1);assert.equal(closingExplanationRequired(review),false);
 await assert.rejects(closeDay(db,user,{...request,snapshotVersion:undefined,financialRevision:undefined}),e=>e.status===409&&e.message.includes('Perbarui aplikasi'));
 const saved=await closeDay(db,user,{...request,explanation:null});assert.equal(saved.previousFinancialTotals,null);assert.equal(saved.financial.totals.adjusted,-2000);
 const replay={id:'legacy-closing',userId:user.id,revision:0};assert.equal((await closeDay(db,user,replay)).snapshotVersion,1);
 const before={total:0,financial:{totals:{available:0,utang:3000,piutang:0,adjusted:-3000}}};
 assert.ok(closingExplanationRequired({total:0,financial:{totals:{available:0,utang:2000,piutang:0,adjusted:-2000}},previous:before}));db.close();
});
test('migration preserves confirmed rows, receipts and audit data; new fields are immutable',async()=>{
 const {db,user,write}=await fixture({through:'0003_daily_closings.sql'});
 await write('balance',{name:'DANA',category:'E-wallet',amount:1000000});
 await db.prepare('INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total) VALUES (?,?,?,?,?,1,?,1000000)').bind('old-snapshot','2026-10-30','2026-10-30T10:00:00Z',user.id,user.name,'[]').run();
 const tables=['daily_closings','records','mutation_receipts','balance_history'],before={};for(const table of tables)before[table]=(await db.prepare('SELECT * FROM '+table).all()).results.map(r=>({...r}));
 db.execMigration(readFileSync(new URL('../migrations/0004_financial_snapshots.sql',import.meta.url),'utf8'));
 for(const table of tables){const after=(await db.prepare('SELECT * FROM '+table).all()).results.map(r=>{const row={...r};if(table==='daily_closings'){assert.equal(row.snapshot_version,1);assert.equal(row.financial_json,null);delete row.snapshot_version;delete row.financial_revision;delete row.financial_json;}return row;});assert.deepEqual(after,before[table]);}
 await assert.rejects(db.prepare("UPDATE daily_closings SET financial_json='{}' WHERE id='old-snapshot'").run(),/immutable/);
 assert.equal((await db.prepare('SELECT revision FROM financial_state').first()).revision,0);
 assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);db.close();
});
test('financial snapshots preserve zero and reject unsafe combined totals',()=>{
 const rows=[{id:'cash-global',kind:'cash',version:1,payload:normalize('cash',{counts:{}})}];
 assert.deepEqual(financialSnapshot(rows),{utang:[],piutang:[],totals:{available:0,utang:0,piutang:0,adjusted:0},creditBasis:'capital-first'});
 assert.throws(()=>financialSnapshot([{id:'huge',kind:'balance',payload:{amount:Number.MAX_SAFE_INTEGER}},{id:'extra',kind:'balance',payload:{amount:1}}]),/aman/);
});
