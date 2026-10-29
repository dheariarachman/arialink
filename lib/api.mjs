import {hashPassword,verifyPassword,digest,validateUser,publicUser,sessionUser,sessionCookie} from './auth.mjs';
import {HttpError,mutate,snapshot} from './data.mjs';
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
async function body(request){
 const raw=await request.text();if(raw.length>50000)throw new HttpError(413,'Data terlalu besar.');
 try{return JSON.parse(raw);}catch{throw new HttpError(400,'Data JSON tidak valid.');}
}
async function throttle(db,request,email){
 const ip=request.headers.get('cf-connecting-ip')||'local',bucket=Math.floor(Date.now()/900000);
 const key=await digest(ip+'|'+String(email).slice(0,254));
 await db.prepare('INSERT INTO auth_limits(key,attempts,window) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window').bind(key,bucket).run();
 const row=await db.prepare('SELECT attempts FROM auth_limits WHERE key=?').bind(key).first();
 if(row.attempts>10)throw new HttpError(429,'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
}
export async function handle(request,env){
 try{
  if(!env?.DB)throw new HttpError(503,'Database belum dikonfigurasi. Ikuti README untuk migrasi D1.');
  const db=env.DB,url=new URL(request.url),path=url.pathname.replace(/^\/api\//,''),method=request.method;
  if(!['GET','HEAD'].includes(method)&&request.headers.get('origin')!==url.origin)throw new HttpError(403,'Asal permintaan tidak valid.');
  if(path==='setup'&&method==='GET')return json({needsSetup:!(await db.prepare('SELECT id FROM users LIMIT 1').first())});
  if(path==='setup'&&method==='POST'){
   const input=await body(request);await throttle(db,request,'setup');
   if(!env.SETUP_TOKEN||env.SETUP_TOKEN.startsWith('replace-')||env.SETUP_TOKEN.length<24||input.setupToken!==env.SETUP_TOKEN)throw new HttpError(403,'Kode setup tidak valid.');
   if(await db.prepare('SELECT id FROM users LIMIT 1').first())throw new HttpError(409,'Setup sudah selesai. Silakan masuk.');
   let v;try{v=validateUser(input);}catch(e){throw new HttpError(400,e.message);}
   try{await db.prepare("INSERT INTO users(id,name,email,password_hash,role,bootstrap_slot,created_at) VALUES (?,?,?,?,'admin','initial',?)").bind(crypto.randomUUID(),v.name,v.email,await hashPassword(v.password),new Date().toISOString()).run();}catch{throw new HttpError(409,'Setup sudah selesai atau email telah dipakai.');}
   return json({ok:true},201);
  }
  if(path==='login'&&method==='POST'){
   const input=await body(request),email=typeof input.email==='string'?input.email.trim().toLowerCase():'';await throttle(db,request,email);
   const u=await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
   const valid=typeof input.password==='string'&&input.password.length<=256&&await verifyPassword(input.password,u?.password_hash||await hashPassword('dummy-password'));
   if(!u||!u.active||!valid)throw new HttpError(401,'Email atau kata sandi tidak sesuai.');
   const token=crypto.randomUUID()+crypto.randomUUID();
   await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),u.id,Date.now()+604800000)]);
   return json({user:publicUser(u)},200,{'Set-Cookie':sessionCookie(token,request)});
  }
  const user=await sessionUser(db,request);if(!user)throw new HttpError(401,'Silakan masuk kembali. Antrean offline tetap tersimpan pada akun ini.');
  if(path==='me'&&method==='GET')return json({user:publicUser(user)});
  if(path==='logout'&&method==='POST'){
   const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('arialink_session='))?.slice(17);
   if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
   return json({ok:true},200,{'Set-Cookie':sessionCookie('',request,true)});
  }
  if(path==='state'&&method==='GET')return json({records:await snapshot(db)});
  if(path==='mutations'&&method==='POST'){const input=await body(request);if(input.userId!==user.id)throw new HttpError(403,'Akun antrean berbeda dengan akun aktif.');return json({record:await mutate(db,user,input)});}
  if(path==='users'){
   if(user.role!=='admin')throw new HttpError(403,'Hanya admin yang mengelola akun.');
   if(method==='GET'){const r=await db.prepare('SELECT id,name,email,role,active FROM users ORDER BY created_at').all();return json({users:r.results.map(publicUser)});}
   if(method==='POST'){
    let v;try{v=validateUser(await body(request));}catch(e){throw new HttpError(400,e.message);}
    try{await db.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),v.name,v.email,await hashPassword(v.password),v.role,new Date().toISOString()).run();}catch{throw new HttpError(409,'Email sudah digunakan.');}
    return json({ok:true},201);
   }
   if(method==='PATCH'){
    const input=await body(request);if(input.id===user.id)throw new HttpError(400,'Perubahan akun sendiri tidak tersedia pada layar ini.');
    if(typeof input.id!=='string'||typeof input.active!=='boolean')throw new HttpError(400,'Data akun tidak valid.');
    const target=await db.prepare('SELECT id FROM users WHERE id=?').bind(input.id).first();if(!target)throw new HttpError(404,'Akun tidak ditemukan.');
    if(input.password!==undefined&&(typeof input.password!=='string'||input.password.length<10||input.password.length>256))throw new HttpError(400,'Kata sandi harus 10–256 karakter.');
    const statements=[db.prepare('UPDATE users SET active=? WHERE id=?').bind(input.active?1:0,input.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(input.id)];
    if(input.password)statements.push(db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(input.password),input.id));
    await db.batch(statements);return json({ok:true});
   }
  }
  throw new HttpError(404,'Halaman tidak ditemukan.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message,...e.extra},e.status);console.error('ARIALink API error',e?.name);return json({error:'Permintaan gagal diproses. Periksa koneksi database atau log server.'},500);}
}


