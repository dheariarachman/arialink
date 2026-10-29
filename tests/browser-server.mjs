import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {handle} from '../lib/api.mjs';
import {testDatabase} from './db.mjs';
// Isolated, in-memory local test server. Never uses deployment credentials or D1.
const root=fileURLToPath(new URL('../',import.meta.url)),DB=testDatabase();
const env={DB,SETUP_TOKEN:'browser-fixture-setup-secret-1234567890'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:4178');
 if(url.pathname.startsWith('/api/')){
  const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
  const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}: {})});
  const response=await handle(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(url.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html lang="id"><meta charset="utf-8"><title>ARIALink — Uji offline terisolasi</title><style>body{font:16px Arial;max-width:850px;margin:40px auto;padding:20px}li{padding:12px}h1{font-size:26px}</style><h1>ARIALink · Uji IndexedDB & sinkronisasi</h1><p>Lingkungan pengujian terisolasi, bukan aplikasi Next.js.</p><ol id="results"></ol><p id="status">Pengujian berjalan…</p><script type="module" src="/tests/browser.mjs"></script></html>');return;}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(resolve(root)+sep)&&!path.startsWith(resolve(root)+'/')){res.writeHead(403);res.end();return;}
 if(!url.pathname.startsWith('/lib/')&&!url.pathname.startsWith('/tests/')){res.writeHead(404);res.end();return;}
 res.setHeader('content-type',extname(path)==='.mjs'?'text/javascript; charset=utf-8':'text/plain');res.end(await readFile(path));
 }catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(4178,'127.0.0.1',()=>console.log('Offline integration fixture: http://127.0.0.1:4178'));
process.on('SIGINT',()=>{server.close();DB.close();process.exit(0);});

