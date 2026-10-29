/** Private WK100 candidate receipt preview. Disabled unless explicitly configured.
 * Only a signed-in active administrator may request the fixed sealed server
 * selection. No caller-provided source IDs, scoring methods or provider URLs.
 */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {isWk100PrivilegedReader} from '../_shared/wk100-admin-projection.mjs';
import {readWk100SealedCaptureManifest,validWk100CapturePreviewProjectBinding,
  runWk100PrivateCapturePreview} from '../_shared/wk100-capture-private-server.mjs';

const allowedOrigins=new Set(['https://wakilisha.africa','https://www.wakilisha.africa',
  'https://staging.wakilisha.africa','http://localhost:5173']);
function headers(req:Request):Record<string,string>{
  const origin=req.headers.get('origin')??'';
  const h:Record<string,string>={'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff','vary':'Origin'};
  if(allowedOrigins.has(origin))h['access-control-allow-origin']=origin;
  return h;
}
const reply=(req:Request,status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:headers(req)});

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(origin&&!allowedOrigins.has(origin))return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers(req),
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
    'access-control-allow-methods':'POST,OPTIONS'}});
  if(req.method!=='POST')return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [^\s]+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  try{
    const declared=Number(req.headers.get('content-length')??0);
    if(!Number.isFinite(declared)||declared>96)return reply(req,413,{error:'request_too_large'});
    const reader=req.body?.getReader();
    if(!reader)return reply(req,400,{error:'request_invalid'});
    const chunks:Uint8Array[]=[];let total=0;
    try{
      while(true){const part=await reader.read();if(part.done)break;
        total+=part.value.byteLength;
        if(total>96){await reader.cancel();return reply(req,413,{error:'request_too_large'});}
        chunks.push(part.value);}
    }finally{try{reader.releaseLock();}catch{/* cancelled */}}
    if(!total)return reply(req,400,{error:'request_invalid'});
    const bytes=new Uint8Array(total);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!payload||Array.isArray(payload)||typeof payload!=='object'||
      Object.keys(payload).length!==1||payload.action!=='read')
      return reply(req,400,{error:'request_invalid'});
  }catch{return reply(req,400,{error:'request_invalid'});}
  const url=Deno.env.get('SUPABASE_URL')??'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!key||!validWk100CapturePreviewProjectBinding(url,
    Deno.env.get('WK100_CAPTURE_PREVIEW_PROJECT_REF')))return reply(req,503,{error:'project_binding_unavailable'});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=bearer.slice(7);
  let user;
  try{
    const response=await db.auth.getUser(token);
    if(response.error)throw Error();
    user=response.data.user;
  }catch{return reply(req,401,{error:'authentication_required'});}
  if(!user?.id)return reply(req,401,{error:'authentication_required'});
  const roles=await db.from('user_role_assignments').select('role_key,status,expires_at')
    .eq('user_id',user.id).eq('status','active').in('role_key',['super_admin','administrator']);
  if(roles.error)return reply(req,503,{error:'role_verification_unavailable'});
  if(!isWk100PrivilegedReader(roles.data))return reply(req,403,{error:'not_authorized'});
  if(Deno.env.get('WK100_CAPTURE_PREVIEW_ENABLED')!=='true')return reply(req,503,{error:'preview_not_configured'});
  let manifest;
  try{manifest=await readWk100SealedCaptureManifest(
    Deno.env.get('WK100_CAPTURE_PREVIEW_MANIFEST')??'',
    Deno.env.get('WK100_CAPTURE_PREVIEW_MANIFEST_SHA256')??'');}
  catch{return reply(req,503,{error:'preview_manifest_invalid'});}
  try{
    const summary=await runWk100PrivateCapturePreview({db,storage:db.storage,manifest});
    return reply(req,200,summary);
  }catch{
    // Do not reveal source names, URLs, object paths, raw digests or SQL errors.
    return reply(req,409,{error:'private_evidence_unavailable',can_publish:false});
  }
});
