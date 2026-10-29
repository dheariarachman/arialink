const enc=new TextEncoder();
const hex=a=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');
export const digest=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
export async function hashPassword(password,salt=crypto.randomUUID()){
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return `pbkdf2:100000:${salt}:${hex(bits)}`;
}
export async function verifyPassword(password,stored){
  const parts=stored.split(':');if(parts.length!==4||parts[0]!=='pbkdf2')return false;
  const actual=await hashPassword(password,parts[2]);let diff=actual.length^stored.length;
  for(let i=0;i<stored.length;i++)diff|=stored.charCodeAt(i)^(actual.charCodeAt(i)||0);
  return diff===0;
}
export function publicUser(user){return {id:user.id,name:user.name,email:user.email,role:user.role,active:!!user.active};}
export function validateUser(input){
  const name=typeof input.name==='string'?input.name.trim():'';
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  if(!name||name.length>100)throw new Error('Nama diperlukan (maksimal 100 karakter).');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Email tidak valid.');
  if(typeof input.password!=='string'||input.password.length<10||input.password.length>256)throw new Error('Kata sandi harus 10–256 karakter.');
  if(input.role&&!['admin','member'].includes(input.role))throw new Error('Hak akses tidak valid.');
  return {name,email,password:input.password,role:input.role||'member'};
}
export async function sessionUser(db,request){
  const token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('arialink_session='))?.slice(17);
  if(!token)return null;
  const user=await db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await digest(token),Date.now()).first();
  return user;
}
export function sessionCookie(token,request,expire=false){return `arialink_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expire?0:604800}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
