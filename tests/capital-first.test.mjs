import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './db.mjs';
import {mutate,snapshot} from '../lib/data.mjs';
import {changeGoodsCredit,goodsCredits} from '../lib/goods-credit.mjs';
import {closingReview,closeDay,closingReport} from '../lib/closings.mjs';
import {goodsCreditSummary,goodsCreditReport,goodsCreditSchedule,debtRecord,debtRecordSummary,fundsSummary,financialSnapshot,closingBasisChanged,todayWib} from '../lib/domain.mjs';
const p={item:'Kulkas',customer:'Sari',cost:2000000,price:3000000,dp:300000,tenor:10,frequency:'monthly',date:'2026-01-01',nextDate:'2026-02-01',events:[]};
function credit(paid,extra={}){return {id:'capital-contract',kind:'goods-credit',version:1,payload:{...p,...extra,events:[{id:'payment-1',type:'payment',date:p.date,amount:paid}]}};}
test('payments recover capital first, but a zero capital receivable does not settle the contract',()=>{
 for(const [paid,receivable,surplus,remaining,status] of [[300000,1700000,0,2700000,'Modal belum kembali'],[1900000,100000,0,1100000,'Modal belum kembali'],[2000000,0,0,1000000,'Modal kembali · Cicilan berjalan'],[2200000,0,200000,800000,'Modal kembali · Cicilan berjalan'],[3000000,0,1000000,0,'Lunas']]){
  const record=credit(paid),s=goodsCreditSummary(record.payload),d=debtRecordSummary(debtRecord(record));
  assert.equal(s.capitalReceivable,receivable);assert.equal(s.surplus,surplus);assert.equal(s.remaining,remaining);assert.equal(s.capitalStatus,status);
  assert.equal(d.remaining,receivable);assert.equal(d.settled,remaining===0);assert.equal(d.paid,Math.min(p.cost,paid));
  assert.equal(fundsSummary([record]).piutang,receivable);assert.deepEqual(financialSnapshot([record]).totals,fundsSummary([record]));
  assert.deepEqual(goodsCreditSchedule(record.payload),goodsCreditSchedule(p));
 }
});
test('zero capital and loss-making sales never create negative or uncollectible receivables',()=>{
 let r=credit(300000,{cost:0}),s=goodsCreditSummary(r.payload);
 assert.equal(s.capitalReceivable,0);assert.equal(s.surplus,300000);assert.equal(debtRecordSummary(debtRecord(r)).settled,false);
 r=credit(300000,{cost:4000000});s=goodsCreditSummary(r.payload);
 assert.equal(s.capitalReceivable,2700000);assert.equal(s.capitalLoss,0);assert.equal(s.potentialProfit,-1000000);
 r=credit(3000000,{cost:4000000});s=goodsCreditSummary(r.payload);
 assert.equal(s.capitalReceivable,0);assert.equal(s.capitalRecovered,3000000);assert.equal(s.capitalLoss,1000000);assert.equal(s.surplus,0);assert.equal(debtRecordSummary(debtRecord(r)).settled,true);
 const report=goodsCreditReport([r],'2026-01-01','2026-01-31');assert.equal(report.capitalLoss,1000000);assert.equal(report.periodCapitalLoss,1000000);
});
test('period reports split threshold-crossing receipts and reversals by their WIB business dates',()=>{
 const record={...credit(0),payload:{...p,events:[
  {id:'dp',type:'payment',date:'2026-01-01',amount:300000},
  {id:'jan',type:'payment',date:'2026-01-15',amount:1600000},
  {id:'feb',type:'payment',date:'2026-02-01',amount:300000},
  {id:'mar',type:'payment',date:'2026-03-01',amount:700000},
  {id:'rev-feb',type:'reversal',originalId:'feb',date:'2026-04-01',amount:300000},
  {id:'rev-mar',type:'reversal',originalId:'mar',date:'2026-05-01',amount:700000}
 ]}};
 const jan=goodsCreditReport([record],'2026-01-01','2026-01-31');assert.equal(jan.periodSurplus,0);assert.equal(jan.periodCapitalRecovered,1900000);assert.equal(jan.capitalReceivable,100000);
 const feb=goodsCreditReport([record],'2026-02-01','2026-02-28');assert.equal(feb.received,300000);assert.equal(feb.periodCapitalRecovered,100000);assert.equal(feb.periodSurplus,200000);assert.equal(feb.capitalReceivable,0);
 const mar=goodsCreditReport([record],'2026-03-01','2026-03-31');assert.equal(mar.periodSurplus,700000);assert.equal(mar.periodCapitalRecovered,0);
 const apr=goodsCreditReport([record],'2026-04-01','2026-04-30');assert.equal(apr.periodSurplus,-300000);assert.equal(apr.surplus,600000);
 const may=goodsCreditReport([record],'2026-05-01','2026-05-31');assert.equal(may.periodSurplus,-600000);assert.equal(may.periodCapitalRecovered,-100000);assert.equal(may.capitalReceivable,100000);
 const before=financialSnapshot([record],'2026-01-31').piutang[0];assert.equal(before.remaining,100000);assert.equal(before.goodsCredit.contractRemaining,1100000);
 const future=goodsCreditReport([record],'2099-01-01','2099-01-31');assert.equal(future.periodSurplus,0);assert.equal(future.received,0);
});
async function fixture(options){
 const db=testDatabase(options),user={id:'capital-owner',name:'Owner'},date=todayWib();
 await db.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,'capital@test','unused','admin',?)").bind(user.id,user.name,date).run();
 const bank=await mutate(db,user,{id:crypto.randomUUID(),recordId:crypto.randomUUID(),kind:'balance',baseVersion:0,deleted:false,payload:{name:'BCA',category:'Rekening',amount:5000000}});
 const write=async input=>changeGoodsCredit(db,user,{...input,userId:user.id,accounts:[{id:bank.id,version:(await snapshot(db)).find(r=>r.id===bank.id).version}]});
 const contract={...p,date,nextDate:'2099-01-01'};delete contract.events;
 const c=await write({id:crypto.randomUUID(),recordId:crypto.randomUUID(),baseVersion:0,action:'create',contract,accountId:bank.id,payCapital:true,capitalAccountId:bank.id});
 const rows=async()=>[...await snapshot(db),...await goodsCredits(db)];
 const request=async()=>{const r=await closingReview(db);return {id:crypto.randomUUID(),userId:user.id,businessDate:r.businessDate,revision:r.revision,snapshotVersion:r.snapshotVersion,financialRevision:r.financialRevision,previousId:r.previous?.id??null,explanation:'Uji modal kembali'};};
 return {db,user,date,bank,write,c,rows,request};
}
test('threshold crossing updates real balances once, profit-only payments increase grand total, and correction reopens principal',async()=>{
 const f=await fixture();let c=f.c;const first=fundsSummary(await f.rows());assert.deepEqual(first,{available:3300000,piutang:1700000,utang:0,adjusted:5000000});
 const payment={id:crypto.randomUUID(),recordId:c.id,baseVersion:c.version,action:'pay',accountId:f.bank.id,amount:1900000,date:f.date,note:''};
 c=await f.write(payment);const after=fundsSummary(await f.rows());assert.deepEqual(after,{available:5200000,piutang:0,utang:0,adjusted:5200000});assert.equal(debtRecordSummary(debtRecord(c)).settled,false);
 await f.write(payment);assert.deepEqual(fundsSummary(await f.rows()),after);
 const r=await f.request(),closing=await closeDay(f.db,f.user,r);assert.equal(closing.snapshotVersion,4);assert.equal(closing.financial.creditBasis,'capital-first');assert.equal(closing.financial.piutang[0].paid,2000000);assert.equal(closing.financial.piutang[0].remaining,0);assert.equal(closing.financial.piutang[0].settled,false);assert.equal(closing.financial.piutang[0].goodsCredit.contractRemaining,800000);
 c=await f.write({id:crypto.randomUUID(),recordId:c.id,baseVersion:c.version,action:'pay',accountId:f.bank.id,amount:100000,date:f.date,note:''});assert.equal(fundsSummary(await f.rows()).adjusted,5300000);
 await f.write({id:crypto.randomUUID(),recordId:c.id,baseVersion:c.version,action:'reverse',paymentId:payment.id,date:f.date,note:'Koreksi pembayaran'});assert.equal(fundsSummary(await f.rows()).piutang,1600000);
 assert.deepEqual((await closingReport(f.db)).closings[0],closing);f.db.close();
});
test('v3 snapshot bytes, receipts and contracts survive migration; v4 rejects old reviews and marks basis changes',async()=>{
 const f=await fixture({through:'0006_credit_receivables.sql'}),oldFinancial={utang:[],piutang:[{id:f.c.id,sourceKind:'goods-credit',amount:3000000,paid:300000,remaining:2700000}],totals:{available:3300000,utang:0,piutang:2700000,adjusted:6000000}},day=new Date(Date.now()-86400000);
 await f.db.prepare('INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total,snapshot_version,financial_revision,financial_json) VALUES (?,?,?,?,?,0,?,3300000,3,0,?)').bind('capital-legacy-v3',todayWib(day),day.toISOString(),f.user.id,f.user.name,'[]',JSON.stringify(oldFinancial)).run();
 const before={};for(const table of ['daily_closings','goods_credits','goods_credit_operations','records','mutation_receipts'])before[table]=(await f.db.prepare('SELECT * FROM '+table).all()).results;
 f.db.execMigration(readFileSync(new URL('../migrations/0007_capital_first_receivables.sql',import.meta.url),'utf8'));
 for(const table of Object.keys(before))assert.deepEqual((await f.db.prepare('SELECT * FROM '+table).all()).results,before[table]);
 const request=await f.request();await assert.rejects(closeDay(f.db,f.user,{...request,snapshotVersion:3}),{status:409});
 const review=await closingReview(f.db);assert.equal(review.financial.totals.piutang,1700000);assert.equal(review.previous.financial.totals.piutang,2700000);assert.equal(closingBasisChanged(review,review.previous),true);assert.equal(closingBasisChanged({snapshotVersion:4},{snapshotVersion:4}),false);assert.equal(closingBasisChanged({snapshotVersion:3},{snapshotVersion:2}),true);
 const next=await closeDay(f.db,f.user,request);assert.equal(next.previousSnapshotVersion,3);assert.equal(next.financial.piutang[0].goodsCredit.creditBasis,'capital-first');assert.equal(next.financial.totals.adjusted,5000000);f.db.close();
});
