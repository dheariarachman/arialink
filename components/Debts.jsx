'use client';
import {useRef,useState} from 'react';
import {Button} from './ui/button.jsx';
import {Input} from './ui/input.jsx';
import {Card} from './ui/card.jsx';
import {NativeSelect} from './ui/native-select.jsx';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog.jsx';
import {DEBT_TYPES,MAX_MONEY,normalize,debtSummary,addDebtPayment,todayWib,rupiah} from '../lib/domain.mjs';

const MANUAL_NOTICE='Catatan dan pembayaran ini tidak mengubah saldo rekening, e-wallet, atau kas. Perbarui saldo secara manual bila uang berpindah.';
function MoneyField({label,value,onChange}){
 return <label>{label}<div className="money-field"><span>Rp</span><Input aria-label={label} required type="text" inputMode="numeric" value={value===''?'':new Intl.NumberFormat('id-ID').format(Number(value))} onChange={e=>{const raw=e.target.value.replace(/\./g,'');if(/^\d*$/.test(raw)&&Number(raw)<=MAX_MONEY)onChange(raw);}}/></div></label>;
}
function PaymentHistory({payments}){
 return <section className="debt-history"><h3>Riwayat pembayaran</h3>{payments.length?<ul className="debt-payments">{payments.map(p=><li key={p.id}><span>{p.date}</span><b>{rupiah(p.amount)}</b>{p.note&&<span>{p.note}</span>}</li>)}</ul>:<p className="subtle">Belum ada pembayaran.</p>}</section>;
}
export function DebtRecordSummary({payload:p}){
 const {paid,remaining,settled}=debtSummary(p);
 return <><div className="detail-lines"><div><span>Jenis</span><b>{p.type}</b></div><div><span>Nama pihak</span><b>{p.name}</b></div><div><span>Tanggal</span><b>{p.date}</b></div><div><span>Jatuh tempo</span><b>{p.dueDate||'—'}</b></div><div><span>Nominal awal</span><b>{rupiah(p.amount)}</b></div><div><span>Sudah dibayar</span><b>{rupiah(paid)}</b></div><div><span>Sisa</span><b>{rupiah(remaining)}</b></div><div><span>Status</span><b>{settled?'Lunas':'Belum lunas'}</b></div>{p.notes&&<div><span>Catatan</span><b>{p.notes}</b></div>}</div><PaymentHistory payments={p.payments||[]}/></>;
}
export function DebtPanel({records,onOpen}){
 return <Card as="section" className="panel page-wide"><div className="section-title"><h2>Daftar utang & piutang <span className="tag">{records.length}</span></h2></div>{records.length?<div className="table-wrap" role="region" aria-label="Tabel utang dan piutang, geser untuk melihat semua kolom" tabIndex={0}><table><caption className="sr-only">Utang dan piutang beserta sisa dalam rupiah</caption><thead><tr><th scope="col">Nama / jenis</th><th scope="col">Nominal awal</th><th scope="col">Sisa</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{records.map(r=>{const p=r.payload,s=debtSummary(p);return <tr key={r.id}><td><b>{p.name}</b><small>{p.type} · {p.date}{r.pending?' · Di perangkat':''}</small>{p.dueDate&&<small>Jatuh tempo {p.dueDate}</small>}</td><td>{rupiah(p.amount)}</td><td>{rupiah(s.remaining)}</td><td><span className="tag">{s.settled?'Lunas':'Belum lunas'}</span></td><td><Button className="text-button" aria-label={`Detail ${p.type} ${p.name}`} onClick={()=>onOpen(r)}>Detail</Button></td></tr>;})}</tbody></table></div>:<div className="empty"><h3>Belum ada utang atau piutang</h3><p>Catat uang yang perlu Anda terima atau bayarkan.</p><Button onClick={()=>onOpen()}>Catat utang / piutang</Button></div>}</Card>;
}
function DebtForm({record,onSave,onClose}){
 const p=record?.payload;
 const [v,setV]=useState(p||{type:'Piutang',name:'',amount:'',date:todayWib(),dueDate:'',notes:'',payments:[]}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const set=(key,value)=>setV(s=>({...s,[key]:value}));
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onSave('debt',record,normalize('debt',{...v,amount:v.amount===''?null:Number(v.amount)}));onClose();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form className="debt-form" onSubmit={submit}><label>Jenis<NativeSelect autoFocus value={v.type} onChange={e=>set('type',e.target.value)}>{DEBT_TYPES.map(t=><option key={t}>{t}</option>)}</NativeSelect><small className="subtle">Piutang: orang lain berutang kepada usaha. Utang: usaha berutang kepada pihak lain.</small></label><label>Nama pihak<Input required maxLength={120} value={v.name} onChange={e=>set('name',e.target.value)}/></label><MoneyField label="Nominal awal" value={v.amount} onChange={x=>set('amount',x)}/><div className="form-grid"><label>Tanggal<Input type="date" required value={v.date} onChange={e=>set('date',e.target.value)}/></label><label>Jatuh tempo (opsional)<Input type="date" min={v.date||undefined} value={v.dueDate||''} onChange={e=>set('dueDate',e.target.value)}/></label></div><label>Catatan (opsional)<textarea maxLength={1000} rows={3} value={v.notes||''} onChange={e=>set('notes',e.target.value)}/></label>{p&&<p className="subtle">Sudah dibayar {rupiah(debtSummary(p).paid)}. Nominal awal tidak boleh kurang dari jumlah pembayaran.</p>}<p className="notice">{MANUAL_NOTICE}</p>{error&&<p className="error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" className="secondary" onClick={onClose}>Batal</Button><Button disabled={busy}>{busy?'Menyimpan…':'Simpan catatan'}</Button></div></form>;
}
function PaymentForm({record,onSave,onClose}){
 const [v,setV]=useState(()=>({id:crypto.randomUUID(),amount:'',date:todayWib(),note:''})),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const p=record.payload,{remaining}=debtSummary(p),set=(key,value)=>setV(s=>({...s,[key]:value}));
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{const payload=addDebtPayment(p,{...v,amount:v.amount===''?null:Number(v.amount)});await onSave('debt',record,payload);onClose();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form className="debt-form" onSubmit={submit}><p>{p.type} · {p.name}</p><div className="profit-preview"><span>Sisa sebelum pembayaran</span><strong>{rupiah(remaining)}</strong></div><MoneyField label="Nominal pembayaran" value={v.amount} onChange={x=>set('amount',x)}/><label>Tanggal pembayaran<Input autoFocus type="date" required min={p.date} value={v.date} onChange={e=>set('date',e.target.value)}/></label><label>Catatan pembayaran (opsional)<Input maxLength={240} value={v.note} onChange={e=>set('note',e.target.value)}/></label><p className="notice">{MANUAL_NOTICE}</p>{error&&<p className="error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" className="secondary" onClick={onClose}>Batal</Button><Button disabled={busy}>{busy?'Menyimpan…':'Simpan pembayaran'}</Button></div></form>;
}
export function DebtDialog({record,onSave,onDelete,onClose}){
 const [mode,setMode]=useState(record?'detail':'edit'),returnFocus=useRef(typeof document!=='undefined'?document.activeElement:null);
 const title=mode==='payment'?'Catat pembayaran':mode==='edit'?(record?'Ubah utang / piutang':'Catat utang / piutang'):'Detail utang / piutang';
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent onPointerDownOutside={e=>e.preventDefault()} onCloseAutoFocus={e=>{e.preventDefault();if(returnFocus.current?.isConnected)returnFocus.current.focus();}}><div className="transaction-dialog-heading"><DialogTitle>{title}</DialogTitle><DialogDescription>{record?.pending?'Tersimpan di perangkat, menunggu sinkronisasi.':'Sisa utang / piutang dihitung dari nominal awal dan riwayat pembayaran.'}</DialogDescription></div>{mode==='edit'?<DebtForm record={record} onSave={onSave} onClose={onClose}/>:mode==='payment'?<PaymentForm record={record} onSave={onSave} onClose={onClose}/>:<div className="debt-detail"><DebtRecordSummary payload={record.payload}/><p className="notice">{MANUAL_NOTICE}</p><div className="form-actions"><Button className="secondary" onClick={()=>{onDelete(record);onClose();}}>Hapus</Button><Button className="secondary" onClick={()=>setMode('edit')}>Ubah catatan</Button>{!debtSummary(record.payload).settled&&<Button onClick={()=>setMode('payment')}>Catat pembayaran</Button>}</div></div>}</DialogContent></Dialog>;
}
