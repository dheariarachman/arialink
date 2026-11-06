import {normalizeGoodsCredit,goodsCreditSummary,nullableMoney,isDate,todayWib,normalize,cashTotal,MAX_MONEY} from './domain.mjs';
import {HttpError,decodeRecord} from './data.mjs';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
export function decodeGoodsCredit(row){return row?{id:row.id,kind:'goods-credit',payload:JSON.parse(row.payload),version:row.version,deleted:false,authorId:row.author_id,updatedAt:row.updated_at}:null;}
export async function goodsCredits(db){return (await db.prepare('SELECT * FROM goods_credits ORDER BY updated_at DESC,id').all()).results.map(decodeGoodsCredit);}

export async function changeGoodsCredit(db,user,input){
 if(!input||!validId(input.id)||!validId(input.recordId)||!Number.isSafeInteger(input.baseVersion)||input.baseVersion<0)throw new HttpError(400,'Identitas perubahan kredit tidak valid.');
 if(!Array.isArray(input.accounts)||input.accounts.some(a=>!a||!validId(a.id)||!Number.isSafeInteger(a.version)||a.version<1)||new Set(input.accounts.map(a=>a.id)).size!==input.accounts.length)throw new HttpError(400,'Data sumber saldo tidak valid.');
 if(input.userId!==user.id)throw new HttpError(403,'Akun perubahan berbeda dengan akun aktif.');
 const receipt=await db.prepare('SELECT * FROM goods_credit_operations WHERE id=?').bind(input.id).first();
 if(receipt){if(receipt.user_id!==user.id)throw new HttpError(403,'Perubahan bukan milik akun ini.');return JSON.parse(receipt.record_json);}
 const before=decodeGoodsCredit(await db.prepare('SELECT * FROM goods_credits WHERE id=?').bind(input.recordId).first());
 if((before?.version??0)!==input.baseVersion)throw new HttpError(409,'Kredit berubah. Sinkronkan lalu buka ulang formulir.');
 let p,event,effects=[];
 const addEffect=(accountId,delta)=>{if(!validId(accountId))throw new Error('Pilih sumber saldo.');effects.push({accountId,delta});};
 try{
  if(input.action==='create'){
   if(before)throw new Error('Kredit sudah ada.');
   p={...normalizeGoodsCredit(input.contract),events:[]};
   if(typeof input.payCapital!=='boolean')throw new Error('Pilihan pembayaran modal tidak valid.');
   if(input.payCapital&&p.cost>0){addEffect(input.capitalAccountId,-p.cost);p.events.push({id:input.id+'-cost',type:'capital',date:p.date,amount:p.cost,accountId:input.capitalAccountId,note:'Pembayaran modal barang'});}
   addEffect(input.accountId,p.dp);p.events.push({id:input.id,type:'payment',date:p.date,amount:p.dp,accountId:input.accountId,note:'Cicilan pertama / DP'});
  }else{
   if(!before)throw new Error('Kredit tidak ditemukan.');
   p={...before.payload,events:[...before.payload.events]};
   if(!isDate(input.date)||input.date<p.date||input.date>todayWib())throw new Error('Tanggal pembayaran tidak valid.');
   if(typeof input.note!=='string'||input.note.length>240)throw new Error('Catatan maksimal 240 karakter.');
   if(input.action==='pay'){
    const amount=nullableMoney(input.amount);
    if(!amount||amount>goodsCreditSummary(p).remaining)throw new Error('Pembayaran harus lebih dari nol dan tidak melebihi sisa tagihan.');
    event={id:input.id,type:'payment',date:input.date,amount,accountId:input.accountId,note:input.note.trim()||null};addEffect(event.accountId,amount);
   }else if(input.action==='reverse'){
    const payment=p.events.find(e=>e.id===input.paymentId&&e.type==='payment');
    if(!payment||p.events.some(e=>e.originalId===payment.id))throw new Error('Pembayaran tidak ditemukan atau sudah dibatalkan.');
    if(input.date<payment.date||!input.note.trim())throw new Error('Isi tanggal koreksi dan alasan pembatalan pembayaran.');
    event={id:input.id,type:'reversal',originalId:payment.id,date:input.date,amount:payment.amount,accountId:payment.accountId,note:input.note.trim()};addEffect(event.accountId,-event.amount);
   }else throw new Error('Tindakan kredit tidak valid.');
   p.events.push(event);
   // A backdated payment/correction must never produce a negative or overpaid historical balance.
   for(const date of [...new Set(p.events.map(e=>e.date))]){const s=goodsCreditSummary(p,date);if(s.paid<0||s.remaining<0)throw new Error('Tanggal koreksi menyebabkan saldo pembayaran historis tidak valid.');}
  }
 }catch(e){throw new HttpError(400,e.message);}
 const deltas=new Map();for(const e of effects)deltas.set(e.accountId,(deltas.get(e.accountId)||0)+e.delta);
 const targets=[];
 for(const [accountId,delta] of deltas){
  const r=decodeRecord(await db.prepare('SELECT * FROM records WHERE id=?').bind(accountId).first());
  if(!r||r.deleted||!['balance','cash'].includes(r.kind))throw new HttpError(400,'Sumber saldo tidak tersedia.');
  const supplied=input.accounts?.find(a=>a.id===accountId);
  if(!supplied||supplied.version!==r.version)throw new HttpError(409,'Saldo berubah. Sinkronkan lalu buka ulang formulir.');
  const amount=(r.kind==='cash'?cashTotal(r.payload):r.payload.amount)+delta;
  if(!Number.isSafeInteger(amount)||amount<0||amount>MAX_MONEY)throw new HttpError(400,'Saldo tidak cukup atau melebihi batas nominal.');
  let payload;
  try{
   const adjustmentReason=`Kredit Barang · ${p.customer} · ${p.item} · ${input.action}${input.note?' · '+input.note:''}`;
   payload=r.kind==='cash'?normalize('cash',{counts:supplied.counts,adjustmentReason}):normalize('balance',{...r.payload,amount,adjustmentReason});
   if(r.kind==='cash'&&(!supplied.counts||cashTotal(payload)!==amount))throw new Error('Total pecahan kas setelah transaksi harus sesuai perubahan saldo.');
  }catch(e){throw new HttpError(400,e.message);}
  targets.push({...r,payload});
 }
 for(const e of p.events)if(!e.accountName){const account=targets.find(r=>r.id===e.accountId);e.accountName=account.kind==='cash'?'Kas':account.payload.name;}
 const now=new Date().toISOString(),version=input.baseVersion+1;
 const record={id:input.recordId,kind:'goods-credit',payload:p,version,deleted:false,authorId:user.id,updatedAt:now};
 // The guarded operation insert is the commit gate. D1 executes the entire batch
 // atomically; every write requires that gate. Stale credit OR balance means zero writes.
 const guards=targets.map(()=>"EXISTS (SELECT 1 FROM records WHERE id=? AND version=? AND deleted=0)").join(' AND ');
 const guardArgs=targets.flatMap(r=>[r.id,r.version]);
 const creditGuard=before?'EXISTS (SELECT 1 FROM goods_credits WHERE id=? AND version=?)':'NOT EXISTS (SELECT 1 FROM goods_credits WHERE id=?)';
 const statements=[db.prepare(`INSERT OR IGNORE INTO goods_credit_operations(id,user_id,record_json) SELECT ?,?,'{}' WHERE ${creditGuard}${guards?' AND '+guards:''}`).bind(input.id,user.id,input.recordId,...(before?[before.version]:[]),...guardArgs)];
 const gate="EXISTS (SELECT 1 FROM goods_credit_operations WHERE id=? AND user_id=? AND record_json='{}')";
 if(before)statements.push(db.prepare(`UPDATE goods_credits SET payload=?,version=?,author_id=?,updated_at=? WHERE id=? AND ${gate}`).bind(JSON.stringify(p),version,user.id,now,input.recordId,input.id,user.id));
 else statements.push(db.prepare(`INSERT INTO goods_credits(id,payload,version,author_id,updated_at) SELECT ?,?,1,?,? WHERE ${gate}`).bind(input.recordId,JSON.stringify(p),user.id,now,input.id,user.id));
 for(const r of targets)statements.push(db.prepare(`UPDATE records SET payload=?,version=version+1,author_id=?,updated_at=?,last_mutation=? WHERE id=? AND ${gate}`).bind(JSON.stringify(r.payload),user.id,now,input.id,r.id,input.id,user.id));
 statements.push(db.prepare("UPDATE goods_credit_operations SET record_json=? WHERE id=? AND user_id=? AND record_json='{}'").bind(JSON.stringify(record),input.id,user.id));
 await db.batch(statements);
 const saved=await db.prepare('SELECT * FROM goods_credit_operations WHERE id=?').bind(input.id).first();
 if(!saved)throw new HttpError(409,'Kredit atau saldo berubah. Sinkronkan lalu buka ulang formulir.');
 if(saved.user_id!==user.id)throw new HttpError(403,'Perubahan bukan milik akun ini.');
 return JSON.parse(saved.record_json);
}
