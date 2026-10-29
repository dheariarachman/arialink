import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,debtSummary,addDebtPayment,fundsSummary,summarize} from '../lib/domain.mjs';
import {project} from '../lib/offline.mjs';

const debt=(extra={})=>normalize('debt',{type:'Piutang',name:'  Sari  ',amount:500000,date:'2026-10-29',...extra});
const payment=(amount,extra={})=>({id:crypto.randomUUID(),date:'2026-10-29',amount,...extra});
test('debt types, WIB default, and partial/full repayments',()=>{
 const first=normalize('debt',{type:'Utang',name:'Supplier',amount:500000},new Date('2026-10-28T18:00:00Z'));
 assert.equal(first.date,'2026-10-29');assert.equal(first.dueDate,null);
 assert.equal(debt().name,'Sari');assert.deepEqual(debtSummary(first),{paid:0,remaining:500000,settled:false});
 const partial=addDebtPayment(first,payment(100000,{note:'  Tunai  '}));
 assert.deepEqual(debtSummary(partial),{paid:100000,remaining:400000,settled:false});
 assert.equal(partial.payments[0].note,'Tunai');assert.equal(first.payments.length,0);
 const full=addDebtPayment(partial,payment(400000));
 assert.deepEqual(debtSummary(full),{paid:500000,remaining:0,settled:true});
 assert.throws(()=>addDebtPayment(full,payment(1)),/melebihi/);
});
test('invalid debt and repayment data rejected, including duplicate payment IDs and unsafe edits',()=>{
 for(const amount of [null,undefined,'',0,-1,0.5,'500000',Infinity,1e13])assert.throws(()=>debt({amount}));
 for(const extra of [{type:'Loan'},{name:' '},{date:'2026-02-30'},{dueDate:'bad'},{dueDate:'2026-10-28'},{notes:'a'.repeat(1001)},{payments:null},{payments:{}},{payments:[null]}])assert.throws(()=>debt(extra));
 for(const amount of [null,0,-1,0.5,'1',500001])assert.throws(()=>addDebtPayment(debt(),payment(amount)));
 for(const extra of [{id:'bad'},{date:'2026-02-30'},{date:'2026-10-28'},{note:'a'.repeat(241)}])assert.throws(()=>addDebtPayment(debt(),payment(1,extra)));
 const p=payment(100000),partial=addDebtPayment(debt(),p);
 assert.throws(()=>addDebtPayment(partial,p),/berulang/);
 assert.throws(()=>normalize('debt',{...partial,amount:99999}),/melebihi/);
 assert.throws(()=>normalize('debt',{...partial,date:'2026-10-30'}),/Tanggal pembayaran/);
 assert.equal(debtSummary(normalize('debt',{...partial,amount:200000,name:'Sari baru'})).remaining,100000);
});
test('funds distinguish available cash from debts; deleted/settled records and profit remain correct',()=>{
 const rows=[
  {kind:'balance',payload:{amount:4000000}},
  {kind:'cash',payload:normalize('cash',{counts:{100000:10}})},
  {kind:'debt',payload:debt()},
  {kind:'debt',payload:debt({type:'Utang',amount:200000})},
  {kind:'debt',payload:addDebtPayment(debt(),payment(500000))},
  {kind:'debt',deleted:true,payload:debt({amount:9000000})},
  {kind:'balance',deleted:true,payload:{amount:9000000}},
  {kind:'transaction',payload:normalize('transaction',{date:'2026-10-29',received:102000,cost:100000})}
 ];
 assert.deepEqual(fundsSummary(rows),{available:5000000,piutang:500000,utang:200000,adjusted:5300000});
 const report=summarize(rows,'2026-10-29','2026-10-29');
 assert.equal(report.received,102000);assert.equal(report.profit,2000);assert.equal(report.count,1);
 const payable={kind:'debt',payload:debt({type:'Utang',amount:6000000})};
 assert.equal(fundsSummary([rows[0],payable]).adjusted,-2000000);
 assert.deepEqual(fundsSummary([]),{available:0,piutang:0,utang:0,adjusted:0});
});
test('offline debt create, repayments, edits and deletion project into totals without changing cash',()=>{
 const state={records:[{id:'bank',kind:'balance',payload:{amount:1000000},updatedAt:'2026-10-29T00:00:00Z',version:1}],queue:[]};
 const queue=(payload,baseVersion,deleted=false)=>state.queue.push({recordId:'debt-id',kind:'debt',payload,baseVersion,deleted,createdAt:'2026-10-29T01:00:00Z'});
 queue(debt(),0);assert.equal(fundsSummary(project(state)).adjusted,1500000);
 const partial=addDebtPayment(debt(),payment(200000));queue(partial,1);
 assert.equal(fundsSummary(project(state)).adjusted,1300000);
 queue(normalize('debt',{...partial,amount:600000}),2);
 assert.equal(fundsSummary(project(state)).piutang,400000);
 queue(partial,3,true);assert.deepEqual(fundsSummary(project(state)),{available:1000000,piutang:0,utang:0,adjusted:1000000});
 assert.equal(state.records[0].payload.amount,1000000);
});
