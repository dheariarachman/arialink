import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './db.mjs';
import {mutate,snapshot} from '../lib/data.mjs';
import {changeGoodsCredit,goodsCredits} from '../lib/goods-credit.mjs';
import {closingReview,closeDay,closingReport} from '../lib/closings.mjs';
import {debtRecord,debtSource,debtRecordSummary,fundsSummary,financialSnapshot,todayWib} from '../lib/domain.mjs';
async function fixture(options){
 const db=testDatabase(options),user={id:'credit-receivable-owner',name:'Owner'},date=todayWib();
 await db.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,'receivable@test','unused','admin',?)").bind(user.id,user.name,date).run();
 const bank=await mutate(db,user,{id:crypto.randomUUID(),recordId:crypto.randomUUID(),kind:'balance',baseVersion:0,deleted:false,payload:{name:'Bank',category:'Rekening',amount:5000000}});
 const create=()=>({id:crypto.randomUUID(),recordId:crypto.randomUUID(),userId:user.id,baseVersion:0,action:'create',contract:{item:'Kulkas',customer:'Sari',cost:2000000,price:3000000,dp:300000,tenor:10,frequency:'monthly',date,nextDate:'2099-01-01'},payCapital:false,accountId:bank.id});
 const write=async input=>changeGoodsCredit(db,user,{...input,accounts:[{id:bank.id,version:(await snapshot(db)).find(r=>r.id===bank.id).version}]});
 const records=async()=>[...await snapshot(db),...await goodsCredits(db)];
 const request=async()=>{const r=await closingReview(db);return {id:crypto.randomUUID(),userId:user.id,businessDate:r.businessDate,revision:r.revision,snapshotVersion:r.snapshotVersion,financialRevision:r.financialRevision,previousId:r.previous?.id??null,explanation:'Penutupan uji'};};
 return {db,user,date,bank,create,write,records,request};
}
test('goods credit is a read-only receivable; partial payment and reversal transfer value exactly once',async()=>{
 const f=await fixture();let credit=await f.write(f.create()),rows=await f.records(),funds=fundsSummary(rows);
 const projected=debtRecord(credit);assert.equal(debtSource(projected),'Kredit Barang');assert.equal(projected.goodsCredit.id,credit.id);assert.equal(projected.payload.amount,2000000);assert.equal(debtRecordSummary(projected).remaining,1700000);assert.equal(projected.summary.installmentsLeft,9);
 assert.equal(rows.filter(r=>r.kind==='debt').length,0);assert.equal(funds.piutang,1700000);assert.equal(funds.adjusted,7000000);
 const payment={id:crypto.randomUUID(),recordId:credit.id,userId:f.user.id,baseVersion:credit.version,action:'pay',amount:150000,date:f.date,accountId:f.bank.id,note:''};
 credit=await f.write(payment);rows=await f.records();assert.equal(fundsSummary(rows).piutang,1550000);assert.equal(fundsSummary(rows).available,5450000);assert.equal(fundsSummary(rows).adjusted,funds.adjusted);assert.deepEqual(financialSnapshot(rows).totals,fundsSummary(rows));
 await f.write(payment);assert.equal(fundsSummary(await f.records()).piutang,1550000);
 credit=await f.write({id:crypto.randomUUID(),recordId:credit.id,userId:f.user.id,baseVersion:credit.version,action:'reverse',paymentId:payment.id,date:f.date,note:'Koreksi'});
 assert.equal(debtRecordSummary(debtRecord(credit)).paid,300000);assert.deepEqual(fundsSummary(await f.records()),funds);
 credit=await f.write({id:crypto.randomUUID(),recordId:credit.id,userId:f.user.id,baseVersion:credit.version,action:'pay',amount:2700000,date:f.date,accountId:f.bank.id,note:''});assert.equal(debtRecord(credit).summary.status,'Lunas');assert.equal(fundsSummary(await f.records()).piutang,0);f.db.close();
});
test('same customer contracts remain separate; direct and transaction receivables are counted once',async()=>{
 const f=await fixture();const a=await f.write(f.create()),b=await f.write(f.create());
 for(const [kind,payload] of [['debt',{type:'Piutang',name:'Sari',amount:10000}],['transaction',{received:20000,credit:{name:'Sari'}}],['debt',{type:'Utang',name:'Supplier',amount:5000}]])await mutate(f.db,f.user,{id:crypto.randomUUID(),recordId:crypto.randomUUID(),kind,baseVersion:0,deleted:false,payload});
 const records=await f.records(),financial=financialSnapshot(records);assert.equal(financial.piutang.length,4);assert.equal(financial.piutang.filter(r=>[a.id,b.id].includes(r.id)).length,2);assert.equal(financial.totals.piutang,3430000);assert.equal(financial.totals.utang,5000);assert.deepEqual(financial.totals,fundsSummary(records));
 const historical={...a,payload:{...a.payload,date:'2099-01-01'}};assert.equal(debtRecord(historical),null);assert.equal(debtRecord({...a,deleted:true}),null);f.db.close();
});
test('closing v4 saves capital positions; changes invalidate review and never rewrite confirmed history',async()=>{
 const f=await fixture();let credit=await f.write(f.create());const old=await f.request();
 const payment={id:crypto.randomUUID(),recordId:credit.id,userId:f.user.id,baseVersion:credit.version,action:'pay',amount:150000,date:f.date,accountId:f.bank.id,note:''};credit=await f.write(payment);
 await assert.rejects(closeDay(f.db,f.user,old),{status:409});
 const request=await f.request();await assert.rejects(closeDay(f.db,f.user,{...request,snapshotVersion:2}),{status:409});
 const closing=await closeDay(f.db,f.user,request),row=closing.financial.piutang[0];assert.equal(closing.snapshotVersion,4);assert.equal(row.sourceKind,'goods-credit');assert.equal(row.name,'Sari');assert.equal(row.goodsCredit.item,'Kulkas');assert.equal(row.remaining,1550000);assert.equal(row.goodsCredit.installmentsLeft,9);assert.equal(row.status,'Modal belum kembali');assert.equal('events' in row,false);
 await f.write({id:crypto.randomUUID(),recordId:credit.id,userId:f.user.id,baseVersion:credit.version,action:'reverse',paymentId:payment.id,date:f.date,note:'Koreksi'});
 assert.deepEqual((await closingReport(f.db)).closings[0],closing);assert.deepEqual(await closeDay(f.db,f.user,request),closing);assert.equal(fundsSummary(await f.records()).piutang,1700000);f.db.close();
});
test('credit-only changes invalidate the final compare-and-insert even without a balance write',async()=>{
 const f=await fixture(),credit=await f.write(f.create()),request=await f.request();let changed=false;
 const racing={prepare(sql){const s=f.db.prepare(sql);return sql.startsWith('INSERT INTO daily_closings')?{bind(...args){return {async run(){if(!changed){changed=true;await f.db.prepare('UPDATE goods_credits SET version=version+1 WHERE id=?').bind(credit.id).run();}return s.bind(...args).run();}};}}:s;}};
 await assert.rejects(closeDay(racing,f.user,request),{status:409});assert.equal((await closingReport(f.db)).closings.length,0);f.db.close();
});
test('migration preserves old v2 snapshots and existing contracts without creating duplicate debts',async()=>{
 const f=await fixture({through:'0005_goods_credit.sql'}),credit=await f.write(f.create()),day=new Date(Date.now()-86400000);
 const oldFinancial={utang:[],piutang:[],totals:{available:5300000,utang:0,piutang:0,adjusted:5300000}};
 await f.db.prepare('INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total,snapshot_version,financial_revision,financial_json) VALUES (?,?,?,?,?,0,?,5300000,2,0,?)').bind('legacy-v2-closing',todayWib(day),day.toISOString(),f.user.id,f.user.name,'[]',JSON.stringify(oldFinancial)).run();
 const before=await goodsCredits(f.db),history=(await closingReport(f.db)).closings[0];
 f.db.execMigration(readFileSync(new URL('../migrations/0006_credit_receivables.sql',import.meta.url),'utf8'));
 f.db.execMigration(readFileSync(new URL('../migrations/0007_capital_first_receivables.sql',import.meta.url),'utf8'));
 assert.deepEqual(await goodsCredits(f.db),before);assert.deepEqual((await closingReport(f.db)).closings[0],history);
 const review=await closingReview(f.db);assert.equal(review.previous.snapshotVersion,2);assert.equal(review.financial.piutang[0].id,credit.id);assert.equal((await snapshot(f.db)).filter(r=>r.kind==='debt').length,0);
 const next=await closeDay(f.db,f.user,await f.request());assert.equal(next.previousSnapshotVersion,2);assert.equal(next.financial.totals.piutang,1700000);assert.equal(next.previousFinancialTotals.piutang,0);f.db.close();
});
