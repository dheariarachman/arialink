import {api,rememberUser,loadLocal,enqueue,project,synchronize,resolveConflict} from '../lib/offline.mjs';
import {normalize,addDebtPayment,debtSummary,fundsSummary} from '../lib/domain.mjs';
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
 const debtId=crypto.randomUUID();let debtPayment;
 await run('Utang / piutang dan pembayaran offline tersimpan dengan sisa yang benar',async()=>{
  const payload=normalize('debt',{type:'Piutang',name:'Pelanggan fixture',amount:500000});
  debtPayment={id:crypto.randomUUID(),amount:100000,date:payload.date};
  await enqueue(user.id,'debt',debtId,payload,false,0);
  await enqueue(user.id,'debt',debtId,addDebtPayment(payload,debtPayment),false,1);
  const s=await loadLocal(user.id),rows=project(s),debt=rows.find(r=>r.id===debtId);
  assert(debt.pending&&debt.version===2,'Versi utang / piutang salah');
  assert(debtSummary(debt.payload).remaining===400000,'Sisa pembayaran salah');
  assert(fundsSummary(rows).piutang===400000&&fundsSummary(rows).available===0,'Kas tercampur piutang');
  await synchronize(user.id);
 });
 await run('Respons pembayaran hilang dapat dikirim ulang tanpa menggandakan pembayaran',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  await enqueue(user.id,'debt',debtId,addDebtPayment(current.payload,{id:crypto.randomUUID(),amount:100000,date:current.payload.date}),false,current.version);
  const real=globalThis.fetch;let lost=false;
  globalThis.fetch=async(...args)=>{const response=await real(...args);if(String(args[0]).includes('/api/mutations')&&!lost){lost=true;throw new TypeError('Simulasi respons pembayaran hilang');}return response;};
  try{await synchronize(user.id);throw new Error('Seharusnya respons hilang');}catch(e){assert(e.message.includes('Simulasi'),'Kesalahan tidak sesuai');}finally{globalThis.fetch=real;}
  assert((await loadLocal(user.id)).queue.length===1,'Pembayaran lokal dibuang');await synchronize(user.id);
  const currentAfter=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  assert(currentAfter.payload.payments.length===2&&debtSummary(currentAfter.payload).remaining===300000,'Pembayaran ganda');
 });
 await run('Pembayaran bersamaan ditinjau melalui konflik dan dapat dicatat ulang pada data terbaru',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===debtId),localPayment={id:crypto.randomUUID(),amount:50000,date:current.payload.date};
  await enqueue(user.id,'debt',debtId,addDebtPayment(current.payload,localPayment),false,current.version);
  await api('mutations',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),userId:user.id,recordId:debtId,kind:'debt',payload:addDebtPayment(current.payload,{id:crypto.randomUUID(),amount:100000,date:current.payload.date}),baseVersion:current.version,deleted:false})});
  let conflict;
  try{await synchronize(user.id);throw new Error('Konflik pembayaran tidak terdeteksi');}catch(e){assert(e.status===409&&e.conflict.current.payload.payments.length===3,'Konflik pembayaran salah');conflict=e.conflict;}
  await resolveConflict(user.id,conflict,false);
  const latest=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  await enqueue(user.id,'debt',debtId,addDebtPayment(latest.payload,localPayment),false,latest.version);await synchronize(user.id);
  const final=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  assert(final.payload.payments.length===4&&debtSummary(final.payload).remaining===150000,'Riwayat pembayaran tidak lengkap');
 });
 await run('Pelunasan dan penghapusan utang / piutang offline diperhitungkan tanpa mengubah kas',async()=>{
  const current=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  const full=addDebtPayment(current.payload,{id:crypto.randomUUID(),amount:150000,date:current.payload.date});
  await enqueue(user.id,'debt',debtId,full,false,current.version);
  assert(fundsSummary(project(await loadLocal(user.id))).piutang===0,'Piutang lunas masih dihitung');
  await synchronize(user.id);const settled=(await loadLocal(user.id)).records.find(r=>r.id===debtId);
  await enqueue(user.id,'debt',debtId,settled.payload,true,settled.version);await synchronize(user.id);
  const s=await loadLocal(user.id);assert(s.records.find(r=>r.id===debtId).deleted,'Tombstone utang / piutang hilang');
  assert(fundsSummary(project(s)).adjusted===0,'Kas berubah setelah pelunasan');
 });
 status.textContent=`SELESAI: ${count} pengujian browser lulus.`;status.dataset.result='passed';
}catch(e){status.textContent='GAGAL: '+e.message;status.dataset.result='failed';console.error(e);}
