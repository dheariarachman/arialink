import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
// Generate the original ARIALink lettermark without external graphics tooling.
function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
for(const size of [192,512]){
 const data=Buffer.alloc((size*4+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const nx=x/size,ny=y/size,inside=ny>.23&&ny<.76;
  const half=(ny-.23)*.37+.035,left=.5-half,right=.5+half;
  const stem=inside&&((nx>left-.045&&nx<left+.035)||(nx>right-.035&&nx<right+.045));
  const bar=ny>.57&&ny<.63&&nx>left&&nx<right;
  const c=stem||bar?[255,255,255]:[17,24,39];const i=y*(size*4+1)+1+x*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255;
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 writeFileSync(`public/icon-${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('PWA icons generated.');
