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
    const tx={type,date,received:nullableMoney(input.received),cost:nullableMoney(input.cost),adminIncluded:included,
      separateAdmin:type==='Tarik Tunai'&&!included?nullableMoney(input.separateAdmin):null,
      source:text(input.source),payment:type==='Tarik Tunai'?null:text(input.payment)};
    if(input.credit!=null){
      const c=input.credit;
      if(typeof c!=='object'||Array.isArray(c))throw new Error('Data piutang transaksi tidak valid.');
      const name=text(c.name),dueDate=c.dueDate||null,amount=transactionAmount(tx);
      if(!name)throw new Error('Nama pelanggan diperlukan untuk transaksi belum dibayar.');
      if(tx.received==null||amount<=0||amount>MAX_MONEY||type==='Tarik Tunai'&&!included&&tx.separateAdmin==null)throw new Error('Isi seluruh nominal tagihan, termasuk admin, lebih dari nol dan maksimal 1 triliun.');
      if(dueDate&&(!isDate(dueDate)||dueDate<date))throw new Error('Jatuh tempo tidak valid atau sebelum tanggal transaksi.');
      let settlement=null;
      if(c.settlement!=null){
        const s=c.settlement;
        if(typeof s!=='object'||Array.isArray(s)||typeof s.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(s.id))throw new Error('ID pelunasan tidak valid.');
        if(!isDate(s.date)||s.date<date)throw new Error('Tanggal pelunasan tidak valid atau sebelum tanggal transaksi.');
        settlement={id:s.id,date:s.date,note:text(s.note,240)};
      }
      tx.credit={name,dueDate,settlement};
    }
    return tx;
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
export function transactionAmount(tx){return tx.received==null?null:tx.received+(tx.type==='Tarik Tunai'&&tx.adminIncluded===false?(tx.separateAdmin??0):0);}
export function receipts(tx){return tx.credit&&!tx.credit.settlement?0:transactionAmount(tx);}
export function receiptDate(tx){return tx.credit?tx.credit.settlement?.date:tx.date;}
export function settleTransaction(tx,settlement){
  if(!tx.credit||tx.credit.settlement)throw new Error('Transaksi tidak memiliki piutang yang belum lunas.');
  return normalize('transaction',{...tx,credit:{...tx.credit,settlement}});
}
export function transactionDebt(record){
  const tx=record.payload,c=tx.credit;if(record.kind!=='transaction'||!c)return null;
  const amount=transactionAmount(tx);
  return {...record,kind:'debt',transaction:record,payload:{type:'Piutang',name:c.name,amount,date:tx.date,dueDate:c.dueDate,notes:null,payments:c.settlement?[{...c.settlement,amount}]:[]}};
}
// Historical installments remain readable. Every newly appended payment must settle the balance.
export function validateChange(kind,previous,next,deleted=false){
  if(kind==='debt'){
    const before=previous?.payments||[],after=next.payments;
    if(previous&&before.length&&next.amount!==previous.amount)throw new Error('Nominal dengan riwayat pembayaran tidak dapat diubah.');
    if(after.length<before.length||before.some((p,i)=>JSON.stringify(p)!==JSON.stringify(after[i])))throw new Error('Riwayat pembayaran tersimpan tidak dapat diubah.');
    if(after.length>before.length){
      const remaining=next.amount-before.reduce((s,p)=>s+p.amount,0);
      if(after.length!==before.length+1||after.at(-1).amount!==remaining)throw new Error('Utang / piutang harus dilunasi penuh dalam satu pembayaran.');
    }
  }
  if(kind==='transaction'&&previous?.credit){
    if(!next.credit)throw new Error('Piutang transaksi tidak dapat dihapus. Gunakan pelunasan penuh.');
    const oldSettlement=previous.credit.settlement;
    if(oldSettlement){
      if(deleted)throw new Error('Transaksi yang telah dilunasi tidak dapat dihapus.');
      if(JSON.stringify(oldSettlement)!==JSON.stringify(next.credit.settlement))throw new Error('Pelunasan tersimpan tidak dapat diubah.');
      if(['type','date','received','cost','adminIncluded','separateAdmin'].some(k=>previous[k]!==next[k]))throw new Error('Nominal dan tanggal transaksi yang telah dilunasi tidak dapat diubah.');
    }
  }
}
export function cashTotal(payload){return DENOMS.reduce((s,n)=>s+n*(payload?.counts?.[n]??0),0);}
export function debtSummary(payload){
  const paid=(payload.payments||[]).reduce((s,p)=>s+p.amount,0),remaining=payload.amount-paid;
  return {paid,remaining,settled:remaining===0};
}
export function addDebtPayment(payload,payment){
  const next=normalize('debt',{...payload,payments:[...(payload.payments||[]),payment]});
  validateChange('debt',payload,next);return next;
}
export function fundsSummary(records){
  let available=0,piutang=0,utang=0;
  for(const r of records){
    if(r.deleted)continue;
    if(r.kind==='balance')available+=r.payload.amount;
    if(r.kind==='cash')available+=cashTotal(r.payload);
    const debt=r.kind==='debt'?r:transactionDebt(r);
    if(debt){
      const {remaining}=debtSummary(debt.payload);
      if(debt.payload.type==='Piutang')piutang+=remaining;else utang+=remaining;
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
  const transactions=records.filter(r=>r.kind==='transaction'&&!r.deleted),inRange=date=>date&&date>=start&&date<=end;
  const rows=transactions.filter(r=>inRange(r.payload.date)),collected=transactions.filter(r=>inRange(receiptDate(r.payload)));
  return {count:rows.length,received:collected.reduce((s,r)=>s+(receipts(r.payload)??0),0),cost:rows.reduce((s,r)=>s+(r.payload.cost??0),0),profit:rows.reduce((s,r)=>s+(profit(r.payload)??0),0),incomplete:rows.filter(r=>profit(r.payload)==null).length,rows,collections:collected.filter(r=>r.payload.credit)};
}
export function rupiah(n){return n==null?'—':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);}
