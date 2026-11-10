'use client';
import {useRef,useState} from 'react';
import {Button} from './ui/button.jsx';
import {Input} from './ui/input.jsx';
import {Card} from './ui/card.jsx';
import {NativeSelect} from './ui/native-select.jsx';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog.jsx';
import {DEBT_TYPES,MAX_MONEY,normalize,debtSummary,debtRecordSummary,debtSource,addDebtPayment,settleTransaction,todayWib,rupiah} from '../lib/domain.mjs';

const MANUAL_NOTICE='Catatan dan pembayaran ini tidak mengubah saldo rekening, e-wallet, atau kas. Perbarui saldo secara manual bila uang berpindah.';
function MoneyField({label,value,onChange,disabled=false}){
 return <label>{label}<div className="money-field"><span>Rp</span><Input aria-label={label} disabled={disabled} required type="text" inputMode="numeric" value={value===''?'':new Intl.NumberFormat('id-ID').format(Number(value))} onChange={e=>{const raw=e.target.value.replace(/\./g,'');if(/^\d*$/.test(raw)&&Number(raw)<=MAX_MONEY)onChange(raw);}}/></div></label>;
}
function PaymentHistory({payments}){
 return <section className="debt-history"><h3>Riwayat pembayaran</h3>{payments.length?<ul className="debt-payments">{payments.map(p=><li key={p.id}><span>{p.date}</span><b>{rupiah(p.amount)}</b>{p.note&&<span>{p.note}</span>}</li>)}</ul>:<p className="subtle">Belum ada pembayaran.</p>}</section>;
}
export function DebtRecordSummary({payload:p}){
 const {paid,remaining,settled}=debtSummary(p);
 const rows=[['Jenis',p.type],['Nama pihak',p.name],['Tanggal',p.date],['Jatuh tempo',p.dueDate||'—'],['Nominal awal',rupiah(p.amount)],['Sudah dibayar',rupiah(paid)],['Sisa',rupiah(remaining)],['Status',settled?'Lunas':'Belum lunas'],...(p.notes?[['Catatan',p.notes]]:[])];
 return <><dl className="record-details">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><PaymentHistory payments={p.payments||[]}/></>;
}
export function DebtPanel({records,onOpen,onSettle}){
 const [tab,setTab]=useState('ARIALink'),[filter,setFilter]=useState('Semua'),[hideSettled,setHideSettled]=useState(true),[source,setSource]=useState('Semua sumber'),[status,setStatus]=useState('Semua');
 const credit=tab==='Kredit Barang',visible=records.filter(r=>credit
  ?!!r.goodsCredit&&(status==='Semua'||r.summary.status===status)
  :!r.goodsCredit&&(filter==='Semua'||r.payload.type===filter)&&(source==='Semua sumber'||debtSource(r)===source)&&(!hideSettled||!debtRecordSummary(r).settled));
 const label=credit?'kredit barang':filter==='Semua'?'utang & piutang':filter.toLowerCase();
 const sources=[['Transaksi','BRILink'],['Catatan langsung','Manual'],['Kredit Barang','Modal Kredit Barang']];
 const totals=sources.map(([source,label])=>({label,amount:records.filter(r=>r.payload.type==='Piutang'&&debtSource(r)===source).reduce((sum,r)=>sum+debtRecordSummary(r).remaining,0)}));
 return <Card as="section" className="panel page-wide debt-panel">
  <div className="debt-overview"><p className="subtle">Total seluruh sumber; tab hanya mengatur daftar.</p><dl className="debt-source-totals" aria-label="Rincian sisa piutang">{totals.map(({label,amount})=><div key={label}><dt>{label}</dt><dd>{rupiah(amount)}</dd></div>)}</dl></div>
  <div className="tabs debt-source-tabs" role="group" aria-label="Sumber daftar utang dan piutang">{['ARIALink','Kredit Barang'].map(t=><Button key={t} aria-pressed={tab===t} className={tab===t?'selected':''} onClick={()=>setTab(t)}>{t}</Button>)}</div>
  <div className="section-title"><div><h2>Daftar {label} <span className="tag">{visible.length}</span></h2><p className="subtle">{credit?'Sisa tagihan untuk penagihan. Hanya modal belum kembali yang masuk ke total piutang.':'Piutang transaksi BRILink dan catatan utang / piutang manual.'}</p></div>
   <div className="debt-list-filters">{credit?<NativeSelect aria-label="Status kredit" value={status} onChange={e=>setStatus(e.target.value)}>{['Semua','Berjalan','Menunggak','Lunas'].map(s=><option key={s}>{s}</option>)}</NativeSelect>:<>
    <NativeSelect aria-label="Sumber utang dan piutang" value={source} onChange={e=>setSource(e.target.value)}><option>Semua sumber</option><option value="Transaksi">BRILink</option><option value="Catatan langsung">Manual</option></NativeSelect>
    <label className="debt-hide-settled"><input type="checkbox" checked={hideSettled} onChange={e=>setHideSettled(e.target.checked)}/>Sembunyikan yang lunas</label>
    <div className="tabs" role="group" aria-label="Filter jenis utang dan piutang">{['Semua','Utang','Piutang'].map(t=><Button key={t} aria-pressed={filter===t} className={filter===t?'selected':''} onClick={()=>setFilter(t)}>{t}</Button>)}</div>
   </>}</div>
  </div>
  {visible.length?<div className="table-wrap" role="region" aria-label={`Tabel ${label}, geser untuk melihat semua kolom`} tabIndex={0}><table><caption className="sr-only">Daftar {label} beserta sisa dalam rupiah</caption><thead><tr>{(credit?['Pelanggan / barang','Sisa tagihan pelanggan','Modal belum kembali','Cicilan tersisa','Jatuh tempo berikutnya','Status']:['Nama / jenis','Nominal awal','Kembali / dibayar','Sisa piutang / utang','Status']).map(title=><th scope="col" key={title}>{title}</th>)}<th scope="col"><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{visible.map(r=>{
   const p=r.payload,s=debtRecordSummary(r);return <tr key={r.id}><td><b>{p.name}</b>{credit?<small>{r.goodsCredit.payload.item}</small>:<small>{p.type} · {r.transaction?'BRILink':'Manual'} · {p.date}{r.pending?' · Di perangkat':''}</small>}{!credit&&p.dueDate&&<small>Jatuh tempo {p.dueDate}</small>}</td>
    {credit?<><td>{rupiah(r.summary.remaining)}</td><td>{rupiah(s.remaining)}<small>{r.summary.capitalStatus}</small></td><td>{r.summary.installmentsLeft} / {r.goodsCredit.payload.tenor}</td><td>{r.summary.next?.date||'—'}</td></>:<><td>{rupiah(p.amount)}</td><td>{rupiah(s.paid)}</td><td>{rupiah(s.remaining)}</td></>}
    <td><span className="tag">{credit?r.summary.status:s.settled?'Lunas':'Belum lunas'}</span></td><td><div className="debt-row-actions"><Button className="text-button" aria-label={`Detail ${credit?'Kredit Barang':p.type} ${p.name}`} onClick={()=>onOpen(r)}>Detail</Button>{!s.settled&&<Button className="secondary" aria-label={`${credit?'Catat cicilan':p.type==='Utang'?'Bayar':'Lunasi'} ${p.type} ${p.name}`} onClick={()=>onSettle(r)}>{credit?'Catat cicilan':p.type==='Utang'?'Bayar':'Lunasi'}</Button>}</div></td></tr>;
  })}</tbody></table></div>:<div className="empty"><h3>{credit?'Tidak ada kredit barang sesuai filter':`Tidak ada ${label} sesuai filter`}</h3><p>{credit?'Ubah filter status atau catat kontrak melalui menu Kredit Barang.':hideSettled?'Ubah filter atau matikan “Sembunyikan yang lunas” untuk melihat catatan lainnya.':'Ubah filter atau catat uang yang perlu Anda terima atau bayarkan.'}</p>{!credit&&<Button onClick={()=>onOpen()}>Catat utang / piutang</Button>}</div>}
 </Card>;
}
function DebtForm({record,onSave,onClose}){
 const p=record?.payload;
 const [v,setV]=useState(p||{type:'Piutang',name:'',amount:'',date:todayWib(),dueDate:'',notes:'',payments:[]}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const set=(key,value)=>setV(s=>({...s,[key]:value}));
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onSave('debt',record,normalize('debt',{...v,amount:v.amount===''?null:Number(v.amount)}));onClose();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form className="debt-form" onSubmit={submit}><label>Jenis<NativeSelect autoFocus value={v.type} onChange={e=>set('type',e.target.value)}>{DEBT_TYPES.map(t=><option key={t}>{t}</option>)}</NativeSelect><small className="subtle">Piutang: orang lain berutang kepada usaha. Utang: usaha berutang kepada pihak lain.</small></label><label>Nama pihak<Input required maxLength={120} value={v.name} onChange={e=>set('name',e.target.value)}/></label><MoneyField label="Nominal awal" disabled={!!p?.payments?.length} value={v.amount} onChange={x=>set('amount',x)}/><div className="form-grid"><label>Tanggal<Input type="date" required value={v.date} onChange={e=>set('date',e.target.value)}/></label><label>Jatuh tempo (opsional)<Input type="date" min={v.date||undefined} value={v.dueDate||''} onChange={e=>set('dueDate',e.target.value)}/></label></div><label>Catatan (opsional)<textarea maxLength={1000} rows={3} value={v.notes||''} onChange={e=>set('notes',e.target.value)}/></label>{p&&<p className="subtle">Sudah dibayar {rupiah(debtSummary(p).paid)}. Nominal awal dengan riwayat pembayaran tidak dapat diubah.</p>}<p className="notice">{MANUAL_NOTICE}</p>{error&&<p className="error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" className="secondary" onClick={onClose}>Batal</Button><Button disabled={busy}>{busy?'Menyimpan…':'Simpan catatan'}</Button></div></form>;
}
function SettlementForm({record,onSave,onClose}){
 const [v,setV]=useState(()=>({id:crypto.randomUUID(),date:todayWib(),note:''})),[error,setError]=useState(''),[busy,setBusy]=useState(false),saving=useRef(false);
 const p=record.payload,{remaining}=debtSummary(p),set=(key,value)=>setV(s=>({...s,[key]:value}));
 async function submit(e){e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError('');try{if(record.transaction){await onSave('transaction',record.transaction,settleTransaction(record.transaction.payload,v));}else{await onSave('debt',record,addDebtPayment(p,{...v,amount:remaining}));}onClose();}catch(e){setError(e.message);}finally{saving.current=false;setBusy(false);}}
 return <form className="debt-form" onSubmit={submit}><p>{p.type} · {p.name}</p><div className="profit-preview"><span>Nominal pelunasan</span><strong>{rupiah(remaining)}</strong></div><p>Seluruh tagihan dilunasi sekali dalam satu pembayaran. Pembayaran sebagian tidak tersedia.</p>{p.payments.length>0&&<p className="subtle">Riwayat pembayaran lama dipertahankan. Seluruh sisa harus dilunasi sekaligus.</p>}<label>Tanggal pembayaran<Input autoFocus disabled={busy} type="date" required min={p.date} value={v.date} onChange={e=>set('date',e.target.value)}/></label><label>Catatan pembayaran (opsional)<Input disabled={busy} maxLength={240} value={v.note} onChange={e=>set('note',e.target.value)}/></label><p className="notice">{MANUAL_NOTICE}</p>{error&&<p className="error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" className="secondary" disabled={busy} onClick={onClose}>Batal</Button><Button disabled={busy||remaining<=0}>{busy?'Menyimpan…':'Konfirmasi pelunasan'}</Button></div></form>;
}
export function DebtDialog({record,initialMode,onSave,onDelete,onEditTransaction,onClose}){
 const [mode,setMode]=useState(initialMode||(record?'detail':'edit')),returnFocus=useRef(typeof document!=='undefined'?document.activeElement:null);
 const title=mode==='settle'?'Lunasi utang / piutang':mode==='edit'?(record?'Ubah utang / piutang':'Catat utang / piutang'):'Detail utang / piutang';
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent onPointerDownOutside={e=>e.preventDefault()} onCloseAutoFocus={e=>{e.preventDefault();if(returnFocus.current?.isConnected)returnFocus.current.focus();document.querySelector('[aria-label="Filter jenis utang dan piutang"] button[aria-pressed="true"]')?.focus();}}><div className="transaction-dialog-heading"><DialogTitle>{title}</DialogTitle><DialogDescription>{record?.pending?'Tersimpan di perangkat, menunggu sinkronisasi.':'Utang / piutang dilunasi penuh dalam satu pembayaran, tanpa cicilan.'}</DialogDescription></div>{mode==='edit'?<DebtForm record={record} onSave={onSave} onClose={onClose}/>:mode==='settle'?<SettlementForm record={record} onSave={onSave} onClose={onClose}/>:<div className="debt-detail">{record.transaction&&<p className="notice">Piutang terkait transaksi {record.transaction.payload.type||'belum dikategorikan'} tanggal {record.payload.date}. Perubahan dilakukan melalui transaksi yang sama.</p>}<DebtRecordSummary payload={record.payload}/><p className="notice">{MANUAL_NOTICE}</p><div className="form-actions"><Button className="secondary" onClick={()=>{if(record.transaction){onEditTransaction(record.transaction);}else setMode('edit');}}>{record.transaction?'Ubah transaksi':'Ubah catatan'}</Button>{!record.transaction&&<Button className="secondary" onClick={()=>{onDelete(record);onClose();}}>Hapus</Button>}{!debtSummary(record.payload).settled&&<Button onClick={()=>setMode('settle')}>Lunasi</Button>}</div></div>}</DialogContent></Dialog>;
}
