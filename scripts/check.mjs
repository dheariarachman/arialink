import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await scan(p);else if(/\.(mjs|js)$/.test(e.name)){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status)throw new Error(r.stderr);}}}
await scan('tests');await scan('lib');await scan('public');await scan('scripts');await scan('app/api');
JSON.parse((await readFile('package.json','utf8')).replace(/^\uFEFF/,''));
console.log('JavaScript syntax and package JSON checked. JSX and Next.js build require installed dependencies.');

