export const KINDS = ['PPOB', 'Topup e-wallet', 'Transfer', 'Tarik Tunai'];
export const DENOMS = [100000,50000,20000,10000,5000,2000,1000,500,200,100];
export const MAX_MONEY = 1_000_000_000_000;
export const DEBT_TYPES = ['Piutang','Utang'];
export function todayWib(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = type => p.find(x=>x.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function isDate(s) { return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s; }
export function nullableMoney(x) {
  if (x===null||x===undefined||x==='') return null;
  if (typeof x!=='number' || !Number.isSafeInteger(x) || x<0 || x>MAX_MONEY) throw new Error('Nominal harus rupiah bulat, tidak negatif, maksimal 1 triliun.');
  return x;
}
function text(x,max=120){if(x==null||x==='')return null;if(typeof x!=='string'||x.length>max)throw new Error('Teks tidak valid atau terlalu panjang.');return x.trim()||null;}
export function normalize(kind, input, now = new Date()) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('Data tidak valid.');
  if(kind==='transaction') {
    const type=text(input.type); if(type&&!KINDS.includes(type))throw new Error('Jenis transaksi tidak valid.');
    const date=input.date||todayWib(now);if(!isDate(date))throw new Error('Tanggal tidak valid.');
    if(input.adminIncluded!=null && typeof input.adminIncluded!=='boolean')throw new Error('Pilihan admin tidak valid.');
    const included=input.adminIncluded!==false;
    return {type,date,received:nullableMoney(input.received),cost:nullableMoney(input.cost),adminIncluded:included,
      separateAdmin:type==='Tarik Tunai'&&!included?nullableMoney(input.separateAdmin):null,
      source:text(input.source),payment:type==='Tarik Tunai'?null:text(input.payment)};
  }
  if(kind==='balance') {
    if(!['Rekening','E-wallet'].includes(input.category))throw new Error('Jenis saldo tidak valid.');
    const name=text(input.name);if(!name)throw new Error('Nama rekening atau e-wallet diperlukan.');
    return {name,category:input.category,amount:nullableMoney(input.amount)??0};
  }
  if(kind==='cash') {
    const counts={};for(const n of DENOMS){const q=input.counts?.[n]??0;if(!Number.isSafeInteger(q)||q<0||q>1_000_000)throw new Error('Jumlah pecahan harus bilangan bulat, tidak negatif.');counts[n]=q;}
    return {counts};
  }
  if(kind==='debt') {
    if(!DEBT_TYPES.includes(input.type))throw new Error('Jenis utang / piutang tidak valid.');
    const name=text(input.name);if(!name)throw new Error('Nama pihak diperlukan.');
    const amount=nullableMoney(input.amount);if(amount==null||amount===0)throw new Error('Nominal awal harus lebih dari nol.');
    const date=input.date||todayWib(now),dueDate=input.dueDate||null;
    if(!isDate(date)||dueDate!==null&&!isDate(dueDate))throw new Error('Tanggal tidak valid.');
    if(dueDate&&dueDate<date)throw new Error('Jatuh tempo tidak boleh sebelum tanggal catatan.');
    const rawPayments=input.payments===undefined?[]:input.payments;
    if(!Array.isArray(rawPayments))throw new Error('Riwayat pembayaran tidak valid.');
    const ids=new Set(),payments=rawPayments.map(p=>{
      if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(p.id)||ids.has(p.id))throw new Error('ID pembayaran tidak valid atau berulang.');
      ids.add(p.id);
      const amount=nullableMoney(p.amount);if(amount==null||amount===0)throw new Error('Pembayaran harus lebih dari nol.');
      if(!isDate(p.date)||p.date<date)throw new Error('Tanggal pembayaran tidak valid atau sebelum tanggal catatan.');
      return {id:p.id,date:p.date,amount,note:text(p.note,240)};
    });
    let remaining=amount;for(const p of payments){remaining-=p.amount;if(remaining<0)throw new Error('Pembayaran melebihi sisa utang / piutang.');}
    return {type:input.type,name,amount,date,dueDate,notes:text(input.notes,1000),payments};
  }
  throw new Error('Jenis catatan tidak valid.');
}
export function profit(tx) {
  if(tx.received==null||tx.cost==null)return null;
  if(tx.type==='Tarik Tunai'&&tx.adminIncluded===false&&tx.separateAdmin==null)return null;
  return tx.received + (tx.type==='Tarik Tunai'&&tx.adminIncluded===false?tx.separateAdmin:0)-tx.cost;
}
export function receipts(tx){return tx.received==null?null:tx.received+(tx.type==='Tarik Tunai'&&tx.adminIncluded===false?(tx.separateAdmin??0):0);}
export function cashTotal(payload){return DENOMS.reduce((s,n)=>s+n*(payload?.counts?.[n]??0),0);}
export function debtSummary(payload){
  const paid=(payload.payments||[]).reduce((s,p)=>s+p.amount,0),remaining=payload.amount-paid;
  return {paid,remaining,settled:remaining===0};
}
export function addDebtPayment(payload,payment){return normalize('debt',{...payload,payments:[...(payload.payments||[]),payment]});}
export function fundsSummary(records){
  let available=0,piutang=0,utang=0;
  for(const r of records){
    if(r.deleted)continue;
    if(r.kind==='balance')available+=r.payload.amount;
    if(r.kind==='cash')available+=cashTotal(r.payload);
    if(r.kind==='debt'){
      const {remaining}=debtSummary(r.payload);
      if(r.payload.type==='Piutang')piutang+=remaining;else utang+=remaining;
    }
  }
  return {available,piutang,utang,adjusted:available+piutang-utang};
}
export function rangeFor(period,date){
  if(!isDate(date))throw new Error('Tanggal tidak valid.');
  if(period==='monthly')return {start:date.slice(0,7)+'-01',end:new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)).toISOString().slice(0,10)};
  if(period==='weekly'){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)};}
  return {start:date,end:date};
}
export function summarize(records,start,end){
  const rows=records.filter(r=>r.kind==='transaction'&&!r.deleted&&r.payload.date>=start&&r.payload.date<=end);
  return {count:rows.length,received:rows.reduce((s,r)=>s+(receipts(r.payload)??0),0),cost:rows.reduce((s,r)=>s+(r.payload.cost??0),0),profit:rows.reduce((s,r)=>s+(profit(r.payload)??0),0),incomplete:rows.filter(r=>profit(r.payload)==null).length,rows};
}
export function rupiah(n){return n==null?'—':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);}
