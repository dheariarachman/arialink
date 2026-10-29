import { getCloudflareContext } from '@opennextjs/cloudflare';
import { handle } from '../../../lib/api.mjs';
export const dynamic = 'force-dynamic';
async function route(request){
 try { const {env}=await getCloudflareContext({async:true}); return handle(request,env); }
 catch { return Response.json({error:'Database belum siap. Jalankan migrasi D1 dan periksa konfigurasi.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
export {route as GET,route as POST,route as PATCH};
