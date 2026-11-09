import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db.mjs';
import {changeGoodsCredit,goodsCredits} from '../lib/goods-credit.mjs';
import {mutate,snapshot} from '../lib/data.mjs';
import {normalizeGoodsCredit,goodsCreditSchedule,goodsCreditSummary,goodsCreditReport,summarize,fundsSummary} from '../lib/domain.mjs';
import {handle} from '../lib/api.mjs';
const uid='owner-0001',accountId='account-0001';
const contract={item:'Kulkas',customer:'Sari',cost:2000000,price:3000000,dp:300000,tenor:10,frequency:'monthly',date:'2026-01-01',nextDate:'2026-01-31',notes:''};
async function setup(){
 const db=testDatabase();await db.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,'Owner','owner@test','unused','admin','2026-01-01')").bind(uid).run();
 await mutate(db,{id:uid},{id:crypto.randomUUID(),recordId:accountId,kind:'balance',baseVersion:0,deleted:false,payload:{name:'BCA',category:'Rekening',amount:5000000}});
 const create={id:crypto.randomUUID(),userId:uid,recordId:crypto.randomUUID(),baseVersion:0,action:'create',contract,payCapital:true,capitalAccountId:accountId,accountId,accounts:[{id:accountId,version:1}]};
 return {db,create,user:{id:uid}};
}
const balance=async db=>(await snapshot(db)).find(r=>r.id===accountId);
const action=(record,account,more)=>({id:crypto.randomUUID(),recordId:record.id,userId:uid,baseVersion:record.version,accounts:[{id:account.id,version:account.version}],...more});
test('weekly/monthly schedules preserve anchors, rounding, DP and partial allocation',()=>{
 const p=normalizeGoodsCredit(contract),dates=goodsCreditSchedule(p).map(r=>r.date);
 assert.deepEqual(dates.slice(1,5),['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
 assert.equal(goodsCreditSchedule({...p,frequency:'weekly',nextDate:'2026-01-07'})[2].date,'2026-01-14');
 assert.equal(goodsCreditSchedule({...p,nextDate:'2028-01-31'})[2].date,'2028-02-29');
 const rounded=goodsCreditSchedule({...p,price:1001,dp:100,tenor:4});assert.deepEqual(rounded.map(r=>r.amount),[100,300,300,301]);
 const s=goodsCreditSummary({...p,events:[{type:'payment',amount:450000,date:p.date}]},'2026-02-01');
 assert.equal(s.installmentsLeft,9);assert.equal(s.schedule[1].remaining,150000);assert.equal(s.overdue,150000);assert.equal(s.potentialProfit,1000000);assert.equal(s.uncoveredCapital,1550000);
 assert.equal(goodsCreditSummary({...p,events:[{type:'payment',amount:p.price,date:p.date}]}).status,'Lunas');
 assert.throws(()=>normalizeGoodsCredit({...contract,cost:''}));assert.throws(()=>normalizeGoodsCredit({...contract,tenor:1}));assert.throws(()=>normalizeGoodsCredit({...contract,dp:0}));assert.throws(()=>normalizeGoodsCredit({...contract,date:'2099-01-01'}));
 assert.equal(goodsCreditSchedule(normalizeGoodsCredit({...contract,dp:contract.price,tenor:1})).length,1);
});
test('capital + DP commit once, credit reports remain separate and shared balances update',async()=>{
 const {db,create,user}=await setup();const first=await changeGoodsCredit(db,user,create);
 assert.equal(first.version,1);assert.equal((await balance(db)).payload.amount,3300000);
 assert.deepEqual(await changeGoodsCredit(db,user,create),first);assert.equal((await balance(db)).version,2);
 const records=[...await snapshot(db),...await goodsCredits(db)],report=goodsCreditReport(records,'2026-01-01','2026-01-31');
 assert.equal(report.received,300000);assert.equal(report.capitalOut,2000000);assert.equal(report.remaining,2700000);assert.equal(report.potentialProfit,1000000);
 assert.equal(summarize(records,'2026-01-01','2026-12-31').count,0);assert.equal(fundsSummary(records).piutang,1700000);assert.equal(fundsSummary(records).available,3300000);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM balance_history').first()).n,2);
 db.close();
});
test('partial payment, early settlement and reversal preserve history and date reports',async()=>{
 const {db,create,user}=await setup();let record=await changeGoodsCredit(db,user,{...create,payCapital:false});
 assert.equal((await balance(db)).payload.amount,5300000);
 const pay=action(record,await balance(db),{action:'pay',amount:150000,date:'2026-02-02',accountId,note:'Sebagian'});
 record=await changeGoodsCredit(db,user,pay);assert.equal(goodsCreditSummary(record.payload).paid,450000);
 const reverse=action(record,await balance(db),{action:'reverse',paymentId:pay.id,date:'2026-03-01',note:'Salah nominal'});
 record=await changeGoodsCredit(db,user,reverse);assert.equal(record.payload.events.length,3);assert.equal(goodsCreditSummary(record.payload).paid,300000);
 assert.equal(goodsCreditReport([record],'2026-02-01','2026-02-28').received,150000);assert.equal(goodsCreditReport([record],'2026-02-01','2026-02-28').remaining,2550000);
 assert.equal(goodsCreditReport([record],'2026-03-01','2026-03-31').received,-150000);assert.equal((await balance(db)).payload.amount,5300000);
 await assert.rejects(changeGoodsCredit(db,user,action(record,await balance(db),{...reverse,id:crypto.randomUUID(),baseVersion:record.version,accounts:[{id:accountId,version:(await balance(db)).version}]})),{status:400});
 record=await changeGoodsCredit(db,user,action(record,await balance(db),{action:'pay',amount:2700000,date:'2026-03-02',accountId,note:''}));assert.equal(goodsCreditSummary(record.payload).status,'Lunas');
 await assert.rejects(changeGoodsCredit(db,user,action(record,await balance(db),{action:'pay',amount:1,date:'2026-03-03',accountId,note:''})),{status:400});db.close();
});
test('stale balances, credit conflicts, insufficient funds and cross-account receipts reject safely',async()=>{
 const {db,create,user}=await setup();await assert.rejects(changeGoodsCredit(db,user,{...create,accounts:[{id:accountId,version:99}]}),{status:409});
 await assert.rejects(changeGoodsCredit(db,user,{...create,userId:'someone-else'}),{status:403});
 const record=await changeGoodsCredit(db,user,create);
 await assert.rejects(changeGoodsCredit(db,user,{...create,id:crypto.randomUUID()}),{status:409});
 await assert.rejects(changeGoodsCredit(db,{id:'other-user'},{...create,userId:'other-user'}),{status:403});
 await assert.rejects(changeGoodsCredit(db,user,action(record,await balance(db),{action:'pay',amount:1,date:'2099-01-01',accountId,note:''})),{status:400});
 await assert.rejects(changeGoodsCredit(db,user,{...create,id:crypto.randomUUID(),recordId:crypto.randomUUID(),contract:{...contract,cost:9000000},accounts:[{id:accountId,version:2}]}),{status:400});
 assert.equal((await balance(db)).payload.amount,3300000);assert.equal((await goodsCredits(db)).length,1);db.close();
});
test('concurrent balance edit between read and batch cannot partly commit credit',async()=>{
 const {db,create,user}=await setup();const originalBatch=db.batch.bind(db);let raced=false;
 db.batch=async statements=>{if(!raced){raced=true;await db.prepare('UPDATE records SET version=version+1 WHERE id=?').bind(accountId).run();}return originalBatch(statements);};
 await assert.rejects(changeGoodsCredit(db,user,create),{status:409});
 assert.equal((await goodsCredits(db)).length,0);assert.equal((await balance(db)).payload.amount,5000000);assert.equal((await db.prepare('SELECT count(*) AS n FROM goods_credit_operations').first()).n,0);db.close();
});
test('cash requires exact after-transaction denominations, reversal reduces physical cash',async()=>{
 const {db,create,user}=await setup();await mutate(db,user,{id:crypto.randomUUID(),recordId:'cash-global',kind:'cash',baseVersion:0,deleted:false,payload:{counts:{100000:10}}});
 const input={...create,payCapital:false,accountId:'cash-global',accounts:[{id:'cash-global',version:1}]};
 await assert.rejects(changeGoodsCredit(db,user,input),{status:400});
 const record=await changeGoodsCredit(db,user,{...input,accounts:[{id:'cash-global',version:1,counts:{100000:13}}]});
 assert.equal((await snapshot(db)).find(r=>r.kind==='cash').payload.counts[100000],13);
 await changeGoodsCredit(db,user,{id:crypto.randomUUID(),recordId:record.id,userId:uid,baseVersion:1,action:'reverse',paymentId:input.id,date:'2026-01-02',note:'Pembatalan DP',accounts:[{id:'cash-global',version:2,counts:{100000:10}}]});
 assert.equal((await snapshot(db)).find(r=>r.kind==='cash').payload.counts[100000],10);db.close();
});
test('API credit endpoint requires authentication and same origin',async()=>{
 const {db,create}=await setup(),env={DB:db},url='https://arialink.test/api/goods-credits';
 assert.equal((await handle(new Request(url,{method:'POST',headers:{origin:'https://arialink.test'},body:JSON.stringify(create)}),env)).status,401);
 assert.equal((await handle(new Request(url,{method:'POST',headers:{origin:'https://evil.test'},body:JSON.stringify(create)}),env)).status,403);db.close();
});

test('failed batch rolls back contract, receipt, balances and existing balance audit',async()=>{
 const {db,create,user}=await setup(),batch=db.batch.bind(db);
 db.batch=statements=>batch([...statements,db.prepare('INSERT INTO missing_table VALUES (1)')]);
 await assert.rejects(changeGoodsCredit(db,user,create));
 assert.equal((await goodsCredits(db)).length,0);assert.equal((await balance(db)).payload.amount,5000000);assert.equal((await balance(db)).version,1);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM goods_credit_operations').first()).n,0);assert.equal((await db.prepare('SELECT count(*) AS n FROM balance_history').first()).n,1);db.close();
});
test('malformed accounts and backdated overpayments are rejected without balance writes',async()=>{
 const {db,create,user}=await setup();await assert.rejects(changeGoodsCredit(db,user,{...create,accounts:{}}),{status:400});await assert.rejects(changeGoodsCredit(db,user,{...create,accounts:[null]}),{status:400});
 let record=await changeGoodsCredit(db,user,{...create,payCapital:false});
 const payment=action(record,await balance(db),{action:'pay',amount:2700000,date:'2026-03-01',accountId,note:''});record=await changeGoodsCredit(db,user,payment);
 record=await changeGoodsCredit(db,user,action(record,await balance(db),{action:'reverse',paymentId:payment.id,date:'2026-04-01',note:'Salah nominal'}));
 await assert.rejects(changeGoodsCredit(db,user,action(record,await balance(db),{action:'pay',amount:2700000,date:'2026-03-02',accountId,note:''})),{status:400});
 assert.equal((await balance(db)).payload.amount,5300000);db.close();
});

test('current and future report periods never mark future installments overdue',()=>{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const p={...contract,date,nextDate:'2099-01-01',events:[{type:'payment',date,amount:contract.dp}]};
 const report=goodsCreditReport([{kind:'goods-credit',payload:p}],'2000-01-01','2099-12-31');
 assert.equal(report.asOf,date);assert.equal(report.overdue,0);assert.equal(report.remaining,2700000);
});
