import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { buildWk100PrivatePreview } from '../_shared/wk100-private-preview-core.mjs';
import { isWk100PrivilegedReader, makeWk100RestrictedPreview } from '../_shared/wk100-admin-projection.mjs';

// This endpoint never fetches providers, writes evidence, or creates an edition.
// The exact input remains in project-bound server-only environment configuration.
const origins=new Set([
  'https://wakilisha.africa',
  'https://www.wakilisha.africa',
  'https://staging.wakilisha.africa',
  'http://localhost:5173',
]);
function headers(req:Request):Record<string,string> {
  const origin=req.headers.get('origin')??'';
  const h:Record<string,string>={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if(origins.has(origin)) h['access-control-allow-origin']=origin;
  return h;
}
function reply(req:Request,status:number,body:unknown):Response{return new Response(JSON.stringify(body),{status,headers:headers(req)});}
function validBinding(url:string,ref:string|undefined):boolean {
  if(typeof ref!=='string'||!/^[a-z0-9]{20}$/.test(ref)) return false;
  try {const u=new URL(url);return u.protocol==='https:'&&u.hostname===ref+'.supabase.co'&&!u.username&&!u.password;} catch{return false;}
}
async function sha256(s:string):Promise<string> {
  const encoded=new TextEncoder().encode(s);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoded));
  return [...digest].map(v=>v.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(origin && !origins.has(origin)) return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers(req),
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
    'access-control-allow-methods':'POST,OPTIONS'}});
  if(req.method!=='POST') return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [^\s]+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  let payload;
  try {
    const body=await req.text();
    if(body.length>96)throw Error();
    payload=JSON.parse(body);
    if(!payload||Array.isArray(payload)||Object.keys(payload).length!==1||payload.action!=='read')throw Error();
  }catch{return reply(req,400,{error:'request_invalid'});}
  const url=Deno.env.get('SUPABASE_URL')??'';
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!url||!serviceKey)return reply(req,503,{error:'backend_unavailable'});
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=bearer.slice(7);
  let user;
  try {const result=await db.auth.getUser(token);if(result.error)throw Error();user=result.data.user;}
  catch{return reply(req,401,{error:'authentication_required'});}
  if(!user?.id)return reply(req,401,{error:'authentication_required'});
  const roles=await db.from('user_role_assignments').select('role_key,status,expires_at')
    .eq('user_id',user.id).eq('status','active').in('role_key',['super_admin','administrator']);
  if(roles.error)return reply(req,503,{error:'role_verification_unavailable'});
  if(!isWk100PrivilegedReader(roles.data))return reply(req,403,{error:'not_authorized'});
  if(Deno.env.get('WK100_PRIVATE_PREVIEW_ENABLED')!=='true')return reply(req,503,{error:'preview_not_configured'});
  if(!validBinding(url,Deno.env.get('WK100_PRIVATE_PREVIEW_PROJECT_REF')))return reply(req,503,{error:'project_binding_unavailable'});
  const text=Deno.env.get('WK100_PRIVATE_PREVIEW_INPUT')??'';
  const expected=Deno.env.get('WK100_PRIVATE_PREVIEW_INPUT_SHA256')??'';
  if(text.length<2||text.length>262144||!/^[a-f0-9]{64}$/.test(expected))
    return reply(req,503,{error:'preview_input_unavailable'});
  if(await sha256(text)!==expected)return reply(req,503,{error:'preview_input_unavailable'});
  let input;
  try{input=JSON.parse(text);}catch{return reply(req,503,{error:'preview_input_invalid'});}
  if(input?.dataset_mode!=='synthetic')return reply(req,503,{error:'preview_real_data_not_authorized'});
  try{
    const {privateAudit}=buildWk100PrivatePreview(input,expected);
    return reply(req,200,makeWk100RestrictedPreview(input,privateAudit));
  }catch{return reply(req,503,{error:'preview_input_invalid'});}
});
