import {api,rememberUser,loadLocal,enqueue,project,synchronize,resolveConflict} from '../lib/offline.mjs';
import {normalize,addDebtPayment,debtSummary,fundsSummary,settleTransaction,transactionDebt,summarize} from '../lib/domain.mjs';
const list=document.getElementById('results'),status=document.getElementById('status');let count=0;
function assert(value,label){if(!value)throw new Error(label);}
async function run(label,fn){await fn();const li=document.createElement('li');li.textContent='LULUS — '+label;list.append(li);count++;}
try{
 const setup=await api('setup');if(setup.needsSetup)await api('setup',{method:'POST',body:JSON.stringify({name:'Fixture Admin',email:'fixture@example.test',password:'fixture-only-password-123',setupToken:'browser-fixture-setup-secret-1234567890'})});
 const {user}=await api('login',{method:'POST',body:JSON.stringify({email:'fixture@example.test',password:'fixture-only-password-123'})});await rememberUser(user);
 const recordId=crypto.randomUUID();
 await run('Catatan offline tersimpan di IndexedDB dengan field kosong',async()=>{
  await enqueue(user.id,'transaction',recordId,normalize('transaction',{}),false,0);
  const s=await loadLocal(user.id);assert(s.queue.length===1,'Antrean tidak tersimpan');assert(project(s).find(r=>r.id===recordId).payload.received===null,'Nominal kosong berubah');
 });
 await run('Ubah catatan sebelum online mempertahankan urutan versi',async()=>{
  await enqueue(user.id,'transaction',recordId,normalize('transaction',{received:102000,cost:100000}),false,1);
  const s=await loadLocal(user.id);assert(s.queue.length===2&&project(s).find(r=>r.id===recordId).version===2,'Versi antrean salah');
 });
 await run('Respons hilang setelah server menyimpan tidak menggandakan transaksi',async()=>{
  const real=globalThis.fetch;let lost=false;globalThis.fetch=async(...args)=>{const response=await real(...args);if(String(args[0]).includes('/api/mutations')&&!lost){lost=true;throw new TypeError('Simulasi respons koneksi terputus');}return response;};
  try{await synchronize(user.id);throw new Error('Seharusnya koneksi terputus');}catch(e){assert(e.message.includes('Simulasi'),'Kesalahan tidak sesuai');}finally{globalThis.fetch=real;}
  assert((await loadLocal(user.id)).queue.length===2,'Antrean dibuang saat respons hilang');
  await synchronize(user.id);const s=await loadLocal(user.id);assert(s.queue.length===0,'Antrean belum terkirim');assert(s.records.filter(r=>r.id===recordId).length===1,'Transaksi ganda');assert(s.records.find(r=>r.id===recordId).version===2,'Edit belum diterapkan');
 });
 let conflict;
 await run('Perubahan pengguna lain memunculkan konflik tanpa menimpa data',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===recordId);
  await enqueue(user.id,'transaction',recordId,{...current.payload,received:103000},false,current.version);
  await api('mutations',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),userId:user.id,recordId,kind:'transaction',payload:{...current.payload,received:104000},baseVersion:current.version,deleted:false})});
  try{await synchronize(user.id);throw new Error('Konflik tidak terdeteksi');}catch(e){assert(e.status===409&&e.conflict.current.payload.received===104000,'Konflik tidak sesuai');conflict=e.conflict;}
  assert((await loadLocal(user.id)).queue.length===1,'Data lokal hilang');
 });
 await run('Pilihan gunakan perubahan saya disimpan dengan versi server terbaru',async()=>{
  await resolveConflict(user.id,conflict,true);await synchronize(user.id);const s=await loadLocal(user.id);assert(s.queue.length===0,'Resolusi belum terkirim');assert(s.records.find(r=>r.id===recordId).payload.received===103000,'Resolusi tidak sesuai');
 });
 await run('Form yang terbuka pada versi lama tidak menimpa edit lokal terbaru',async()=>{
  const r=(await loadLocal(user.id)).records.find(r=>r.id===recordId);await enqueue(user.id,'transaction',recordId,r.payload,false,r.version);
  try{await enqueue(user.id,'transaction',recordId,r.payload,false,r.version);throw new Error('Versi lama diterima');}catch(e){assert(e.message.includes('Catatan berubah'),'Kesalahan tidak sesuai');}await synchronize(user.id);
 });
 await run('Antrean akun lain terisolasi dan tidak terkirim lewat sesi admin',async()=>{
  const other={id:crypto.randomUUID(),name:'Fixture Other',role:'member',email:'other@example.test'};await rememberUser(other);await enqueue(other.id,'transaction',crypto.randomUUID(),normalize('transaction',{}),false,0);
  try{await synchronize(other.id);throw new Error('Akun berbeda terkirim');}catch(e){assert(e.status===401,'Akun berbeda tidak dicegah');}
  assert((await loadLocal(other.id)).queue.length===1,'Antrean akun lain hilang');assert((await loadLocal(user.id)).queue.length===0,'Antrean admin tercampur');await rememberUser(user);
 });
 await run('Tambah lalu hapus catatan offline membatalkan antrean yang belum dikirim',async()=>{
  const id=crypto.randomUUID(),payload=normalize('transaction',{});await enqueue(user.id,'transaction',id,payload,false,0);await enqueue(user.id,'transaction',id,payload,true,1);assert(!(await loadLocal(user.id)).queue.some(q=>q.recordId===id),'Antrean catatan terhapus masih ada');
 });
 const debtId=crypto.randomUUID();
 await run('Utang / piutang offline menolak cicilan dan menyimpan seluruh tagihan',async()=>{
  const payload=normalize('debt',{type:'Piutang',name:'Pelanggan fixture',amount:500000});
  await enqueue(user.id,'debt',debtId,payload,false,0);
  const partial={...payload,payments:[{id:crypto.randomUUID(),amount:100000,date:payload.date}]};
  try{await enqueue(user.id,'debt',debtId,partial,false,1);throw new Error('Cicilan diterima');}catch(e){assert(e.message.includes('dilunasi penuh'),'Cicilan tidak dicegah');}
  const s=await loadLocal(user.id),rows=project(s),debt=rows.find(r=>r.id===debtId);
  assert(debt.pending&&debt.version===1,'Versi utang / piutang salah');
  assert(debtSummary(debt.payload).remaining===500000,'Tagihan berubah');
  assert(fundsSummary(rows).piutang===500000&&fundsSummary(rows).available===0,'Kas tercampur piutang');
  await synchronize(user.id);
 });
 await run('Respons pelunasan hilang dikirim ulang tanpa pembayaran ganda',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  await enqueue(user.id,'debt',debtId,addDebtPayment(current.payload,{id:crypto.randomUUID(),amount:500000,date:current.payload.date}),false,current.version);
  const real=globalThis.fetch;let lost=false;
  globalThis.fetch=async(...args)=>{const response=await real(...args);if(String(args[0]).includes('/api/mutations')&&!lost){lost=true;throw new TypeError('Simulasi respons pelunasan hilang');}return response;};
  try{await synchronize(user.id);throw new Error('Seharusnya respons hilang');}catch(e){assert(e.message.includes('Simulasi'),'Kesalahan tidak sesuai');}finally{globalThis.fetch=real;}
  assert((await loadLocal(user.id)).queue.length===1,'Pelunasan lokal dibuang');await synchronize(user.id);
  const currentAfter=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  assert(currentAfter.payload.payments.length===1&&debtSummary(currentAfter.payload).settled,'Pelunasan ganda');
 });
 await run('Pelunasan bersamaan ditinjau lewat konflik dan data server dipertahankan',async()=>{
  const id=crypto.randomUUID(),payload=normalize('debt',{type:'Piutang',name:'Konflik fixture',amount:300000});
  await enqueue(user.id,'debt',id,payload,false,0);await synchronize(user.id);
  const current=(await loadLocal(user.id)).records.find(r=>r.id===id);
  const full=()=>addDebtPayment(current.payload,{id:crypto.randomUUID(),amount:300000,date:current.payload.date});
  await enqueue(user.id,'debt',id,full(),false,current.version);
  await api('mutations',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),userId:user.id,recordId:id,kind:'debt',payload:full(),baseVersion:current.version,deleted:false})});
  let conflict;
  try{await synchronize(user.id);throw new Error('Konflik tidak terdeteksi');}catch(e){assert(e.status===409&&e.conflict.current.payload.payments.length===1,'Konflik pelunasan salah');conflict=e.conflict;}
  try{await resolveConflict(user.id,conflict,true);throw new Error('Pelunasan server ditimpa');}catch(e){assert(e.message.includes('tidak dapat diubah'),'Riwayat pelunasan tidak dilindungi');}
  await resolveConflict(user.id,conflict,false);await synchronize(user.id);
  const final=(await loadLocal(user.id)).records.find(r=>r.id===id);assert(final.payload.payments.length===1&&debtSummary(final.payload).settled,'Pelunasan tidak utuh');
 });
 await run('Pelunasan menolak versi lama dan pengiriman ganda',async()=>{
  const id=crypto.randomUUID(),payload=normalize('debt',{type:'Utang',name:'Pelunasan fixture',amount:200000});
  await enqueue(user.id,'debt',id,payload,false,0);await synchronize(user.id);
  const stale=(await loadLocal(user.id)).records.find(r=>r.id===id);
  await enqueue(user.id,'debt',id,normalize('debt',{...payload,name:'Nama terbaru'}),false,stale.version);
  const full=addDebtPayment(stale.payload,{id:crypto.randomUUID(),amount:200000,date:payload.date});
  try{await enqueue(user.id,'debt',id,full,false,stale.version);throw new Error('Versi lama diterima');}catch(e){assert(e.message.includes('Catatan berubah'),'Versi pelunasan tidak diperiksa');}
  const latest=project(await loadLocal(user.id)).find(r=>r.id===id),settled=addDebtPayment(latest.payload,{id:crypto.randomUUID(),amount:200000,date:payload.date});
  await enqueue(user.id,'debt',id,settled,false,latest.version);
  try{await enqueue(user.id,'debt',id,settled,false,latest.version);throw new Error('Pelunasan ganda diterima');}catch(e){assert(e.message.includes('Catatan berubah'),'Pelunasan ganda tidak dicegah');}
  await synchronize(user.id);const server=(await api('state')).records.find(r=>r.id===id);
  assert(debtSummary(server.payload).settled&&server.payload.payments.length===1,'Pelunasan server salah');
 });
 const creditId=crypto.randomUUID();
 await run('Transaksi belum dibayar dan piutang offline memakai satu catatan',async()=>{
  const tx=normalize('transaction',{date:'2026-10-29',type:'PPOB',received:105000,cost:100000,credit:{name:'Pelanggan transaksi'}});
  await enqueue(user.id,'transaction',creditId,tx,false,0);
  const rows=project(await loadLocal(user.id)),r=rows.find(r=>r.id===creditId);
  assert(transactionDebt(r).payload.amount===105000,'Piutang transaksi salah');assert(fundsSummary(rows).piutang===105000,'Piutang dihitung ganda');
  assert(summarize([r],'2026-10-29','2026-10-29').received===0,'Tagihan dihitung sebagai uang diterima');
  await synchronize(user.id);const server=(await api('state')).records;
  assert(server.filter(r=>r.id===creditId).length===1,'Transaksi ganda');
 });
 await run('Pelunasan transaksi offline bertahan setelah reload data dan retry respons hilang',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===creditId),tx=settleTransaction(current.payload,{id:crypto.randomUUID(),date:'2026-10-30',note:'Lunas tunai'});
  await enqueue(user.id,'transaction',creditId,tx,false,current.version);
  const rows=project(await loadLocal(user.id)),r=rows.find(r=>r.id===creditId);
  assert(fundsSummary(rows).piutang===0,'Piutang lunas masih dihitung');
  assert(summarize([r],'2026-10-29','2026-10-29').profit===5000,'Laba tanggal transaksi berubah');
  assert(summarize([r],'2026-10-30','2026-10-30').received===105000&&summarize([r],'2026-10-30','2026-10-30').profit===0,'Penerimaan atau laba pelunasan salah');
  const real=globalThis.fetch;let lost=false;
  globalThis.fetch=async(...args)=>{const response=await real(...args);if(String(args[0]).includes('/api/mutations')&&!lost){lost=true;throw new TypeError('Simulasi respons pelunasan transaksi hilang');}return response;};
  try{await synchronize(user.id);throw new Error('Respons harus hilang');}catch(e){assert(e.message.includes('Simulasi'),'Kesalahan tidak sesuai');}finally{globalThis.fetch=real;}
  await synchronize(user.id);const after=(await loadLocal(user.id)).records.find(r=>r.id===creditId);
  assert(after.version===2&&transactionDebt(after).payload.payments.length===1,'Pelunasan transaksi ganda');
  try{await enqueue(user.id,'transaction',creditId,after.payload,true,after.version);throw new Error('Transaksi lunas dihapus');}catch(e){assert(e.message.includes('tidak dapat dihapus'),'Pelunasan terhapus');}
 });
 await run('Penghapusan utang lunas dan pembatalan transaksi offline tidak mengubah kas',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  await enqueue(user.id,'debt',debtId,current.payload,true,current.version);await synchronize(user.id);
  assert((await loadLocal(user.id)).records.find(r=>r.id===debtId).deleted,'Tombstone utang / piutang hilang');
  const id=crypto.randomUUID(),tx=normalize('transaction',{received:100000,credit:{name:'Dibatalkan'}});
  await enqueue(user.id,'transaction',id,tx,false,0);await enqueue(user.id,'transaction',id,tx,true,1);
  const s=await loadLocal(user.id);assert(!s.queue.some(q=>q.recordId===id),'Pembatalan piutang terpisah dari transaksi');
  assert(fundsSummary(project(s)).available===0,'Saldo manual berubah');
 });
 status.textContent=`SELESAI: ${count} pengujian browser lulus.`;status.dataset.result='passed';
}catch(e){status.textContent='GAGAL: '+e.message;status.dataset.result='failed';console.error(e);}
