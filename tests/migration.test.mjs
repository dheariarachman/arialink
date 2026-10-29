import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './db.mjs';
import {mutate} from '../lib/data.mjs';

test('debt migration preserves old records, tombstones and retry receipts; old/new writes coexist',async()=>{
 const db=testDatabase({through:'0001_initial.sql'}),user={id:'migration-user'};
 await db.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,'Test','test@example.test','hash','admin','2026-10-29')").bind(user.id).run();
 const make=(kind,payload,recordId=crypto.randomUUID())=>({id:crypto.randomUUID(),recordId,kind,payload,baseVersion:0,deleted:false});
 const balance=make('balance',{name:'BCA',category:'Rekening',amount:7000000});
 const tx=make('transaction',{received:102000,cost:100000}),cash=make('cash',{counts:{100000:10}},'cash-global');
 await mutate(db,user,balance);await mutate(db,user,tx);await mutate(db,user,cash);
 await mutate(db,user,{...tx,id:crypto.randomUUID(),baseVersion:1,deleted:true});
 const before=(await db.prepare('SELECT * FROM records ORDER BY id').all()).results;
 const receipts=(await db.prepare('SELECT * FROM mutation_receipts ORDER BY id').all()).results;
 const sql=readFileSync(new URL('../migrations/0002_debts.sql',import.meta.url),'utf8');
 await db.batch(sql.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
 assert.deepEqual((await db.prepare('SELECT * FROM records ORDER BY id').all()).results,before);
 assert.deepEqual((await db.prepare('SELECT * FROM mutation_receipts ORDER BY id').all()).results,receipts);
 assert.equal((await mutate(db,user,balance)).version,1);
 const changed=await mutate(db,user,{...balance,id:crypto.randomUUID(),baseVersion:1,payload:{...balance.payload,amount:6000000}});
 assert.equal(changed.version,2);
 const debt=await mutate(db,user,make('debt',{type:'Utang',name:'Supplier',amount:500000}));
 assert.equal(debt.kind,'debt');assert.equal(debt.version,1);
 assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);db.close();
});
