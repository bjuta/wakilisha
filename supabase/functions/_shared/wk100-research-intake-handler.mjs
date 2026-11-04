/**
 * Exact restricted research HTTP handler with injected server-only dependencies.
 * The Production Deno entrypoint supplies real clients and environment values.
 * Local tests cannot bypass project binding or authentication checks.
 */
import {coerceWk100ShazamResearchIntakeReceipt} from './wk100-research-receipt-bridge.mjs';
// Server-only upload. NEVER mount a Storage policy exposing raw evidence to browsers.
// The private schema is accessible only via narrowly scoped, audited RPCs.
const ORIGINS=new Set([
  'https://wakilisha.africa','https://www.wakilisha.africa',
  'https://staging.wakilisha.africa','http://localhost:5173',
]);
const MAX_REQUEST_BYTES=4_300_000;
function headers(req){
  const origin=req.headers.get('origin')??'';
  const headers={
    'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff','vary':'Origin',
  };
  if(ORIGINS.has(origin))headers['access-control-allow-origin']=origin;
  return headers;
}
function reply(req,status,body){
  return new Response(JSON.stringify(body),{status,headers:headers(req)});
}
function boundProject(url,expected){
  if(!/^[a-z0-9]{20}$/.test(expected))return false;
  try{
    const u=new URL(url);
    return u.protocol==='https:' && u.hostname===`${expected}.supabase.co` &&
      u.pathname==='/' && !u.username && !u.password && !u.search && !u.hash;
  }catch{return false;}
}
async function boundedBody(req){
  if(!req.body)throw Error('body_invalid');
  const chunks=[];
  let size=0;
  const reader=req.body.getReader();
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_REQUEST_BYTES)throw Error('payload_too_large');
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const buf=new Uint8Array(size);let pos=0;
  for(const chunk of chunks){buf.set(chunk,pos);pos+=chunk.byteLength;}
  return buf;
}
export function createWk100ResearchIntakeHandler({createClient,executeWk100ResearchIntake,readEnv}){
  if(typeof createClient!=='function'||typeof executeWk100ResearchIntake!=='function'||
     typeof readEnv!=='function')throw Error('wk100_research_handler_dependency_invalid');
  return async req=>{
  const origin=req.headers.get('origin')??'';
  if(origin && !ORIGINS.has(origin))return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
    ...headers(req),'access-control-allow-methods':'POST,OPTIONS',
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  }});
  if(req.method!=='POST')return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer \S+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  if(readEnv('WK100_RESEARCH_INTAKE_ENABLED')!=='true')
    return reply(req,503,{error:'intake_not_enabled'});
  const url=readEnv('SUPABASE_URL')??'';
  const ref=readEnv('WK100_RESEARCH_INTAKE_PROJECT_REF')??'';
  const anon=readEnv('SUPABASE_ANON_KEY')??'';
  const secret=readEnv('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!boundProject(url,ref)||!anon||!secret)return reply(req,503,{error:'backend_unavailable'});
  const token=bearer.slice(7);
  const serviceDb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const callerDb=createClient(url,anon,{
    global:{headers:{Authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  // Read live Auth user, not user_metadata, and revalidate current database role
  // before any private bytes are read or any reservation/Storage write occurs.
  let auth;
  try{auth=await serviceDb.auth.getUser(token);}
  catch{return reply(req,503,{error:'backend_unavailable'});}
  if(auth?.error||!auth?.data?.user?.id)return reply(req,401,{error:'authentication_required'});
  let chart,ingest;
  try{
    [chart,ingest]=await Promise.all([
      callerDb.rpc('current_user_has_capability',{required_capability:'manage_charts'}),
      callerDb.rpc('current_user_has_capability',{required_capability:'manage_ingest'}),
    ]);
  }catch{return reply(req,503,{error:'capability_unavailable'});}
  if(chart?.error||ingest?.error)return reply(req,503,{error:'capability_unavailable'});
  if(chart.data!==true||ingest.data!==true)return reply(req,403,{error:'not_authorized'});
  const contentType=req.headers.get('content-type')??'';
  if(!/^multipart\/form-data;\s*boundary=[A-Za-z0-9'()+_,.\/:=?-]{1,150}(?:;.*)?$/i.test(contentType))
    return reply(req,415,{error:'multipart_required'});
  const length=req.headers.get('content-length');
  if(length && (!/^\d+$/.test(length)||Number(length)>MAX_REQUEST_BYTES))
    return reply(req,413,{error:'payload_too_large'});
  let originalBytes,receipt,week;
  try{
    const body=await boundedBody(req);
    const request=new Request(req.url,{method:'POST',headers:{'content-type':contentType},body});
    const form=await request.formData();
    const file=form.get('original_csv');
    const receiptText=form.get('receipt_json');
    const weekText=form.get('research_week_start_eat');
    if(!(file instanceof File)||typeof receiptText!=='string'||
       typeof weekText!=='string'||file.size<1||file.size>4_194_304||
       receiptText.length>4096||weekText.length!==10||[...form.keys()].sort().join(',')!==
         'original_csv,receipt_json,research_week_start_eat')throw Error();
    originalBytes=new Uint8Array(await file.arrayBuffer());
    receipt=JSON.parse(receiptText);week=weekText;
  }catch{return reply(req,400,{error:'research_payload_invalid'});}
  try{
    // Bind a locally verified receipt to the authenticated actor and the
    // existing private research-intake contract. No provider-fetch claim.
    const canonicalReceipt=await coerceWk100ShazamResearchIntakeReceipt({
      originalBytes,receipt,researchWeekStartEat:week,
      authenticatedUserId:auth.data.user.id,
    });
    const data=await executeWk100ResearchIntake({
      originalBytes,receipt:canonicalReceipt,researchWeekStartEat:week,
      authenticatedUserId:auth.data.user.id,
      callerDb,serviceDb,restrictedStorage:serviceDb.storage,
    });
    return reply(req,200,data);
  }catch(error){
    // Invalid native source/metadata is not a retryable infrastructure error.
    if(error instanceof Error && error.message.startsWith('wk100_research_import_'))
      return reply(req,422,{error:'research_source_invalid'});
    // A failed DB finalization may leave private bytes and a durable reserve:
    // NEVER delete them. Identical retry reconciles the same observation.
    return reply(req,409,{error:'research_receipt_not_verified',retryable:true});
  }
  };
}
