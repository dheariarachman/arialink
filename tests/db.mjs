import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function testDatabase({through}={}){
 const sqlite=new DatabaseSync(':memory:'),dir=new URL('../migrations/',import.meta.url);
 for(const file of readdirSync(dir).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
  if(through&&file>through)break;
  sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL(file,dir),'utf8').replace(/^\uFEFF/,''));sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
 const wrap=(sql,args=[])=>({bind(...next){return wrap(sql,next);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:r.changes}};},sql,args});
 return {prepare:sql=>wrap(sql),async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close:()=>sqlite.close()};
}
