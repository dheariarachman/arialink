import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,profit,receipts,receiptDate,transactionAmount,transactionDebt,settleTransaction,validateChange,fundsSummary,summarize} from '../lib/domain.mjs';
import {project} from '../lib/offline.mjs';
const credit=(extra={})=>normalize('transaction',{type:'PPOB',date:'2026-10-29',received:105000,cost:100000,credit:{name:'  Sari  '},...extra});
const settlement=(extra={})=>({id:crypto.randomUUID(),date:'2026-10-30',note:'  Tunai  ',...extra});
const record=payload=>({id:'credit-record',kind:'transaction',version:1,payload,updatedAt:'2026-10-29T01:00:00Z'});

test('unpaid transaction has a full piutang, zero receipts, and transaction-date margin',()=>{
 const tx=credit(),r=record(tx),debt=transactionDebt(r);
 assert.equal(tx.credit.name,'Sari');assert.equal(receipts(tx),0);assert.equal(receiptDate(tx),undefined);
 assert.equal(transactionAmount(tx),105000);assert.equal(profit(tx),5000);
 assert.equal(debt.transaction,r);assert.equal(debt.id,r.id);assert.equal(debt.payload.amount,105000);assert.deepEqual(debt.payload.payments,[]);
 const rows=[r,{kind:'balance',payload:{amount:1000000}}];
 assert.deepEqual(fundsSummary(rows),{available:1000000,piutang:105000,utang:0,adjusted:1105000});
 assert.equal(summarize(rows,'2026-10-29','2026-10-29').received,0);
 assert.equal(summarize(rows,'2026-10-29','2026-10-29').profit,5000);
});
test('full settlement collects once on its date without repeating margin or changing manual balances',()=>{
 const unpaid=credit(),tx=settleTransaction(unpaid,settlement()),r=record(tx);
 validateChange('transaction',unpaid,tx);
 assert.equal(tx.credit.settlement.note,'Tunai');assert.equal(receipts(tx),105000);
 assert.equal(receiptDate(tx),'2026-10-30');assert.equal(transactionDebt(r).payload.payments[0].amount,105000);
 assert.throws(()=>settleTransaction(tx,settlement()),/belum lunas/);
 assert.equal(fundsSummary([r]).piutang,0);
 const original=summarize([r],'2026-10-29','2026-10-29'),paid=summarize([r],'2026-10-30','2026-10-30');
 assert.equal(original.received,0);assert.equal(original.profit,5000);assert.equal(original.count,1);
 assert.equal(paid.received,105000);assert.equal(paid.profit,0);assert.equal(paid.count,0);assert.deepEqual(paid.collections,[r]);
 const month=summarize([r],'2026-10-01','2026-10-31');assert.equal(month.received,105000);assert.equal(month.profit,5000);
 assert.equal(summarize([{...r,deleted:true}],'2026-10-01','2026-10-31').received,0);
});
test('credit requires complete positive charges and valid customer, due date, and settlement',()=>{
 for(const received of [null,'',0])assert.throws(()=>credit({received}));
 for(const c of ['',[],{name:''},{name:'Sari',dueDate:'2026-10-28'},{name:'Sari',dueDate:'2026-02-30'},{name:'Sari',settlement:settlement({date:'2026-10-28'})},{name:'Sari',settlement:settlement({id:'bad'})}])assert.throws(()=>credit({credit:c}));
 assert.equal(profit(credit({cost:null})),null);
 assert.throws(()=>credit({type:'Tarik Tunai',adminIncluded:false,separateAdmin:null}));
 const withdrawal=credit({type:'Tarik Tunai',received:500000,cost:500000,adminIncluded:false,separateAdmin:5000});
 assert.equal(transactionAmount(withdrawal),505000);assert.equal(profit(withdrawal),5000);
 assert.equal(transactionDebt(record(withdrawal)).payload.amount,505000);
 assert.equal(receipts(settleTransaction(withdrawal,settlement())),505000);
 assert.throws(()=>credit({type:'Tarik Tunai',received:1000000000000,adminIncluded:false,separateAdmin:1}));
 const wib=normalize('transaction',{received:100,credit:{name:'Sari'}},new Date('2026-10-28T18:00:00Z'));assert.equal(wib.date,'2026-10-29');
});
test('settlement cannot be cleared, rewritten, repriced, backdated or deleted',()=>{
 const unpaid=credit(),paid=settleTransaction(unpaid,settlement());
 assert.throws(()=>validateChange('transaction',unpaid,normalize('transaction',{...unpaid,credit:null})),/tidak dapat dihapus/);
 for(const change of [{received:106000},{cost:90000},{type:'Transfer'},{date:'2026-10-28'},{credit:unpaid.credit},{credit:{...paid.credit,settlement:settlement()}}])assert.throws(()=>validateChange('transaction',paid,normalize('transaction',{...paid,...change})));
 assert.throws(()=>validateChange('transaction',paid,paid,true),/tidak dapat dihapus/);
 assert.doesNotThrow(()=>validateChange('transaction',paid,normalize('transaction',{...paid,source:'BCA'})));
 assert.doesNotThrow(()=>validateChange('transaction',unpaid,unpaid,true));
});
test('offline projection keeps transaction, piutang and settlement in one versioned record',()=>{
 const state={records:[{id:'bank',kind:'balance',payload:{amount:1000000},version:1,updatedAt:'2026-10-29T00:00:00Z'}],queue:[]},unpaid=credit();
 const queue=(payload,baseVersion,deleted=false)=>state.queue.push({recordId:'credit-record',kind:'transaction',payload,baseVersion,deleted,createdAt:'2026-10-30T00:00:00Z'});
 queue(unpaid,0);assert.equal(fundsSummary(project(state)).piutang,105000);
 const paid=settleTransaction(unpaid,settlement());queue(paid,1);
 const rows=project(state);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='credit-record').version,2);
 assert.equal(fundsSummary(rows).piutang,0);assert.equal(fundsSummary(rows).available,1000000);
 assert.equal(summarize(rows,'2026-10-30','2026-10-30').received,105000);
 state.queue=[];queue(unpaid,0);queue(unpaid,1,true);assert.equal(fundsSummary(project(state)).piutang,0);
});
