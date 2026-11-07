import {balanceSnapshot,cashTotal,financialSnapshot,closingExplanationRequired} from './domain.mjs';
import {HttpError,decodeRecord} from './data.mjs';

const closingSelect=`SELECT c.*,p.snapshot_version AS previous_snapshot_version,p.business_date AS previous_date,p.total AS previous_total,json_extract(p.financial_json,'$.totals') AS previous_financial_totals FROM daily_closings c LEFT JOIN daily_closings p ON p.id=c.previous_id`;
function decodeClosing(r){return r?{id:r.id,businessDate:r.business_date,closedAt:r.closed_at,authorId:r.author_id,authorName:r.author_name,sourceRevision:r.source_revision,snapshot:JSON.parse(r.snapshot_json),total:r.total,explanation:r.explanation,previousId:r.previous_id,previousDate:r.previous_date,previousTotal:r.previous_total,snapshotVersion:r.snapshot_version,financialRevision:r.financial_revision,financial:r.financial_json?JSON.parse(r.financial_json):null,previousSnapshotVersion:r.previous_snapshot_version,previousFinancialTotals:r.previous_financial_totals?JSON.parse(r.previous_financial_totals):null}:null;}
async function findClosing(db,id){return decodeClosing(await db.prepare(closingSelect+' WHERE c.id=?').bind(id).first());}

export async function closingReview(db){
 // Read versions, values, date and revision in one SQLite snapshot. A separate read
 // of the previous closing is safe because confirmed closings are immutable.
 const row=await db.prepare(`SELECT revision,(SELECT revision FROM financial_state WHERE id=1) AS financial_revision,
 strftime('%Y-%m-%dT%H:%M:%fZ','now') AS server_time,date('now','+7 hours') AS business_date,
 (SELECT id FROM daily_closings ORDER BY business_date DESC LIMIT 1) AS previous_id,
 (SELECT json_group_array(json_object('id',id,'kind',kind,'payload',payload,'version',version,'deleted',deleted,'author_id',author_id,'updated_at',updated_at)) FROM records WHERE kind IN ('balance','cash','debt') OR (kind='transaction' AND json_type(payload,'$.credit')='object')) AS records_json,
 (SELECT json_group_array(json_object('id',id,'kind','goods-credit','payload',payload,'version',version,'deleted',0,'author_id',author_id,'updated_at',updated_at)) FROM goods_credits) AS goods_json
 FROM balance_state WHERE id=1`).first();
 const previous=row.previous_id?await findClosing(db,row.previous_id):null;
 const records=[...JSON.parse(row.records_json),...JSON.parse(row.goods_json)].map(decodeRecord),snapshot=balanceSnapshot(records),total=snapshot.reduce((s,r)=>s+r.amount,0);
 let financial;try{financial=financialSnapshot(records,row.business_date);}catch(e){throw new HttpError(400,e.message);}
 if(!Number.isSafeInteger(total))throw new HttpError(400,'Total saldo melebihi batas perhitungan aman.');
 return {businessDate:row.business_date,serverTime:row.server_time,revision:row.revision,financialRevision:row.financial_revision,snapshotVersion:3,snapshot,financial,total,previous};
}

export async function closeDay(db,user,input){
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(input.id||'')||!Number.isSafeInteger(input.revision)||input.revision<0)throw new HttpError(400,'Data penutupan tidak valid.');
 if(input.userId!==user.id)throw new HttpError(403,'Akun penutupan berbeda dengan akun aktif.');
 const replay=await findClosing(db,input.id);
 if(replay){if(replay.authorId!==user.id)throw new HttpError(403,'Penutupan bukan milik akun ini.');return replay;}
 if(input.snapshotVersion!==3||!Number.isSafeInteger(input.financialRevision)||input.financialRevision<0)throw new HttpError(409,'Versi tinjauan lama. Perbarui aplikasi dan buka ulang Tutup Hari untuk menyimpan Saldo, Utang, dan Piutang.');
 if(input.explanation!=null&&(typeof input.explanation!=='string'||input.explanation.length>1000))throw new HttpError(400,'Penjelasan maksimal 1.000 karakter.');
 const explanation=input.explanation?.trim()||null,review=await closingReview(db);
 if(input.businessDate!==review.businessDate)throw new HttpError(409,'Tanggal WIB telah berubah. Buka ulang Tutup Hari.');
 if(review.previous?.businessDate>=review.businessDate)throw new HttpError(409,'Hari ini sudah ditutup. Muat ulang laporan.');
 if(input.revision!==review.revision||input.financialRevision!==review.financialRevision||(input.previousId??null)!==(review.previous?.id??null))throw new HttpError(409,'Saldo atau penutupan berubah. Buka ulang Tutup Hari untuk meninjau nilai terbaru.');
 if(closingExplanationRequired(review)&&!explanation)throw new HttpError(400,'Isi penjelasan perubahan dari penutupan sebelumnya.');
 // Compare-and-insert closes the race with other balance writes, another closer,
 // and midnight WIB. No client totals or account values are trusted.
 await db.prepare(`INSERT INTO daily_closings(id,business_date,closed_at,author_id,author_name,source_revision,snapshot_json,total,explanation,previous_id,snapshot_version,financial_revision,financial_json)
 SELECT ?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?,?,?,?,?,?,?,3,?,?
 WHERE (SELECT revision FROM balance_state WHERE id=1)=?
 AND (SELECT revision FROM financial_state WHERE id=1)=?
 AND (SELECT id FROM daily_closings ORDER BY business_date DESC LIMIT 1) IS ?
 AND date('now','+7 hours')=?
 ON CONFLICT DO NOTHING`).bind(input.id,review.businessDate,user.id,user.name,review.revision,JSON.stringify(review.snapshot),review.total,explanation,review.previous?.id??null,review.financialRevision,JSON.stringify(review.financial),review.revision,review.financialRevision,review.previous?.id??null,review.businessDate).run();
 const saved=await findClosing(db,input.id);
 if(saved){if(saved.authorId!==user.id)throw new HttpError(403,'Penutupan bukan milik akun ini.');return saved;}
 throw new HttpError(409,'Saldo, tanggal, atau penutupan berubah. Muat ulang laporan dan tinjau kembali.');
}

export async function closingReport(db){
 const closings=(await db.prepare(closingSelect+' ORDER BY c.business_date DESC').all()).results.map(decodeClosing);
 const metadata=await db.prepare('SELECT revision,history_started_at FROM balance_state WHERE id=1').first();
 const history=(await db.prepare('SELECT * FROM balance_history ORDER BY revision DESC').all()).results.map(r=>{
  const before=r.before_payload?JSON.parse(r.before_payload):null,after=JSON.parse(r.after_payload);
  const amount=(p,deleted)=>deleted||!p?0:r.kind==='cash'?cashTotal(p):p.amount;
  return {revision:r.revision,recordId:r.record_id,kind:r.kind,name:r.kind==='cash'?'Kas':after.name,previousName:r.kind==='cash'?'Kas':before?.name,before:amount(before,r.before_deleted),after:amount(after,r.after_deleted),deleted:!!r.after_deleted,created:!!r.before_deleted,reason:after.adjustmentReason||null,authorId:r.author_id,authorName:r.author_name,changedAt:r.changed_at};
 });
 return {closings,history,revision:metadata.revision,historyStartedAt:metadata.history_started_at};
}
