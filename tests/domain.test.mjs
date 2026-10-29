import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,profit,receipts,todayWib,rangeFor,summarize,cashTotal} from '../lib/domain.mjs';
import {project} from '../lib/offline.mjs';
test('all transaction fields optional; missing date uses input day in WIB',()=>{
 const r=normalize('transaction',{},new Date('2026-10-26T18:15:00Z'));
 assert.equal(r.date,'2026-10-27');assert.equal(r.type,null);assert.equal(profit(r),null);assert.equal(receipts(r),null);
 assert.equal(todayWib(new Date('2026-12-31T17:01:00Z')),'2027-01-01');
});
test('profit for ordinary and withdrawal transactions, zero and missing fields',()=>{
 assert.equal(profit(normalize('transaction',{received:102000,cost:100000})),2000);
 assert.equal(profit(normalize('transaction',{received:0,cost:0})),0);
 assert.equal(profit(normalize('transaction',{received:0})),null);
 const included=normalize('transaction',{type:'Tarik Tunai',received:505000,cost:500000,adminIncluded:true,separateAdmin:5000});
 assert.equal(profit(included),5000);assert.equal(receipts(included),505000);assert.equal(included.separateAdmin,null);
 const separated=normalize('transaction',{type:'Tarik Tunai',received:500000,cost:500000,adminIncluded:false,separateAdmin:5000});
 assert.equal(profit(separated),5000);assert.equal(receipts(separated),505000);
 assert.equal(profit({...separated,separateAdmin:null}),null);
 assert.equal(profit({...separated,separateAdmin:0}),0);
});
test('invalid dates, negative or fractional rupiah and negative denomination counts rejected',()=>{
 for(const date of ['2026-02-30','bad','2026-13-01'])assert.throws(()=>normalize('transaction',{date}));
 for(const received of [-1,1.5,'1000',Infinity,1e13])assert.throws(()=>normalize('transaction',{received}));
 assert.throws(()=>normalize('balance',{name:'BCA',category:'Rekening',amount:-2}));
 assert.throws(()=>normalize('cash',{counts:{100000:-1}}));
 assert.equal(cashTotal(normalize('cash',{counts:{100000:10,50000:2}})),1100000);
});
test('weekly reports Monday-Sunday across year boundary; leap-month',()=>{
 assert.deepEqual(rangeFor('weekly','2027-01-01'),{start:'2026-12-28',end:'2027-01-03'});
 assert.deepEqual(rangeFor('monthly','2028-02-10'),{start:'2028-02-01',end:'2028-02-29'});
});
test('reports count known values without turning incomplete profit into a number',()=>{
 const rows=[{id:'a',kind:'transaction',payload:normalize('transaction',{date:'2026-10-27',received:102000,cost:100000})},{id:'b',kind:'transaction',payload:normalize('transaction',{date:'2026-10-27',received:5000})},{id:'c',kind:'transaction',deleted:true,payload:{date:'2026-10-27',received:1000,cost:0}}];
 const r=summarize(rows,'2026-10-27','2026-10-27');assert.equal(r.count,2);assert.equal(r.received,107000);assert.equal(r.profit,2000);assert.equal(r.incomplete,1);
});
test('offline projection replays edits and tombstones; transaction does not affect balances',()=>{
 const state={records:[{id:'bank',kind:'balance',payload:{amount:123456},version:1,updatedAt:'2026-10-27T00:00:00Z'}],queue:[{recordId:'tx',kind:'transaction',payload:{received:1000,cost:900},baseVersion:0,updatedAt:'',createdAt:'2026-10-27T01:00:00Z'},{recordId:'tx',kind:'transaction',payload:{received:2000,cost:900},baseVersion:1,createdAt:'2026-10-27T02:00:00Z'}]};
 let rows=project(state);assert.equal(rows.find(r=>r.id==='tx').version,2);assert.equal(rows.find(r=>r.id==='tx').payload.received,2000);assert.equal(rows.find(r=>r.id==='bank').payload.amount,123456);
 state.queue.push({...state.queue[1],baseVersion:2,deleted:true});rows=project(state);assert.equal(rows.find(r=>r.id==='tx').deleted,true);
});
