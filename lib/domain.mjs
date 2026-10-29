export const KINDS = ['PPOB', 'Topup e-wallet', 'Transfer', 'Tarik Tunai'];
export const DENOMS = [100000,50000,20000,10000,5000,2000,1000,500,200,100];
export const MAX_MONEY = 1_000_000_000_000;
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
  throw new Error('Jenis catatan tidak valid.');
}
export function profit(tx) {
  if(tx.received==null||tx.cost==null)return null;
  if(tx.type==='Tarik Tunai'&&tx.adminIncluded===false&&tx.separateAdmin==null)return null;
  return tx.received + (tx.type==='Tarik Tunai'&&tx.adminIncluded===false?tx.separateAdmin:0)-tx.cost;
}
export function receipts(tx){return tx.received==null?null:tx.received+(tx.type==='Tarik Tunai'&&tx.adminIncluded===false?(tx.separateAdmin??0):0);}
export function cashTotal(payload){return DENOMS.reduce((s,n)=>s+n*(payload?.counts?.[n]??0),0);}
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
