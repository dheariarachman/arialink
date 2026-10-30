import {normalize,validateChange} from './domain.mjs';
export class HttpError extends Error {constructor(status,message,extra={}){super(message);this.status=status;this.extra=extra;}}
export function decodeRecord(r){return r?{id:r.id,kind:r.kind,payload:JSON.parse(r.payload),version:r.version,deleted:!!r.deleted,authorId:r.author_id,updatedAt:r.updated_at}:null;}
export async function snapshot(db){const r=await db.prepare('SELECT * FROM records ORDER BY updated_at DESC, id').all();return r.results.map(decodeRecord);}
export async function mutate(db,user,input){
  if(!input||typeof input!=='object')throw new HttpError(400,'Perubahan tidak valid.');
  const {id,recordId,kind,baseVersion,deleted}=input;
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||'')||!/^[a-zA-Z0-9-]{8,80}$/.test(recordId||''))throw new HttpError(400,'ID tidak valid.');
  if(!Number.isSafeInteger(baseVersion)||baseVersion<0||typeof deleted!=='boolean')throw new HttpError(400,'Versi tidak valid.');
  if(!['transaction','balance','cash','debt'].includes(kind))throw new HttpError(400,'Jenis catatan tidak valid.');
  if(kind==='cash'&&recordId!=='cash-global')throw new HttpError(400,'ID kas tidak valid.');
  if(kind==='cash'&&deleted)throw new HttpError(400,'Gunakan jumlah nol untuk mengosongkan kas.');
  if(baseVersion===0&&deleted)throw new HttpError(400,'Catatan belum tersimpan di server.');
  const existingReceipt=await db.prepare('SELECT * FROM mutation_receipts WHERE id=?').bind(id).first();
  if(existingReceipt){if(existingReceipt.user_id!==user.id)throw new HttpError(403,'Perubahan bukan milik akun ini.');return JSON.parse(existingReceipt.record_json);}
  const before=decodeRecord(await db.prepare('SELECT * FROM records WHERE id=?').bind(recordId).first());
  if(before&&(before.version!==baseVersion||before.kind!==kind||before.deleted)||!before&&baseVersion!==0)throw new HttpError(409,'Catatan sudah diubah pengguna lain. Tinjau sebelum melanjutkan.',{current:before});
  let payload;try{payload=normalize(kind,input.payload);validateChange(kind,before?normalize(kind,before.payload):null,payload,deleted);}catch(e){throw new HttpError(400,e.message);}
  const now=new Date().toISOString(),data=JSON.stringify(payload);
  const write=baseVersion===0?
    db.prepare('INSERT INTO records(id,kind,payload,version,deleted,author_id,updated_at,last_mutation) SELECT ?,?,?,1,0,?,?,? WHERE NOT EXISTS (SELECT 1 FROM mutation_receipts WHERE id=?) ON CONFLICT(id) DO NOTHING').bind(recordId,kind,data,user.id,now,id,id):
    db.prepare('UPDATE records SET payload=?,version=version+1,deleted=?,author_id=?,updated_at=?,last_mutation=? WHERE id=? AND kind=? AND version=? AND deleted=0 AND NOT EXISTS (SELECT 1 FROM mutation_receipts WHERE id=?)').bind(data,deleted?1:0,user.id,now,id,recordId,kind,baseVersion,id);
  // D1 batch is atomic. Receipt and record commit together, so retries cannot apply twice.
  await db.batch([write,db.prepare(`INSERT OR IGNORE INTO mutation_receipts(id,user_id,record_json) SELECT ?,?,json_object('id',id,'kind',kind,'payload',json(payload),'version',version,'deleted',json(CASE WHEN deleted=1 THEN 'true' ELSE 'false' END),'authorId',author_id,'updatedAt',updated_at) FROM records WHERE id=? AND last_mutation=?`).bind(id,user.id,recordId,id)]);
  const receipt=await db.prepare('SELECT * FROM mutation_receipts WHERE id=?').bind(id).first();
  if(receipt){if(receipt.user_id!==user.id)throw new HttpError(403,'Perubahan bukan milik akun ini.');return JSON.parse(receipt.record_json);}
  const current=decodeRecord(await db.prepare('SELECT * FROM records WHERE id=?').bind(recordId).first());
  throw new HttpError(409,'Catatan sudah diubah pengguna lain. Tinjau sebelum melanjutkan.',{current});
}
