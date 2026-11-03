import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { validEatWeek, projectWk100SourceHealth } from '../_shared/wk100-source-admin-projection.mjs';

const origins=new Set([
  'https://wakilisha.africa','https://www.wakilisha.africa',
  'https://staging.wakilisha.africa','http://localhost:5173',
]);
function headers(req:Request):Record<string,string>{
  const origin=req.headers.get('origin')??'';
  return {'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff','vary':'Origin',
    ...(origins.has(origin)?{'access-control-allow-origin':origin}:{})};
}
function reply(req:Request,status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:headers(req)});
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(origin&&!origins.has(origin))return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers(req),
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
    'access-control-allow-methods':'POST,OPTIONS'}});
  if(req.method!=='POST')return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [^\s]+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  let week:string,action:'health'|'original',contractId='',receiptId='';
  try{
    const raw=await req.text();
    if(raw.length>320)throw Error();
    const data=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data)||
       !validEatWeek(data.weekStartEat))throw Error();
    week=data.weekStartEat;
    if(data.action==='read_source_health'&&Object.keys(data).length===2){
      action='health';
    }else if(data.action==='verify_private_original'&&Object.keys(data).length===4&&
      typeof data.contractId==='string'&&typeof data.receiptId==='string'&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.contractId)&&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.receiptId)){
      action='original';contractId=data.contractId;receiptId=data.receiptId;
    }else throw Error();
  }catch{return reply(req,400,{error:'request_invalid'});}
  const url=Deno.env.get('SUPABASE_URL')??'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!url||!anon||!serviceKey)return reply(req,503,{error:'backend_unavailable'});
  const token=bearer.slice(7);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const caller=createClient(url,anon,{global:{headers:{authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await admin.auth.getUser(token);
  if(identity.error||!identity.data.user?.id)return reply(req,401,{error:'authentication_required'});
  const allowed=await caller.rpc('current_user_has_capability',{required_capability:'manage_ingest'});
  if(allowed.error)return reply(req,503,{error:'capability_unavailable'});
  if(allowed.data!==true)return reply(req,403,{error:'not_authorized'});
  const charts=await caller.rpc('current_user_has_capability',{required_capability:'manage_charts'});
  if(charts.error)return reply(req,503,{error:'capability_unavailable'});
  if(charts.data!==true)return reply(req,403,{error:'not_authorized'});
  if(action==='original'){
    // Authorize the exact receipt through its contract and EAT week.
    // Neither a browser-supplied path nor arbitrary Storage key is accepted.
    const {data:record,error:recordError}=await admin.from('wk_chart_capture_attempts_v1')
      .select('id,contract_id,week_start_eat,scheduled_at,attempt_number,status,payload_sha256,raw_object_key,native_period_authority')
      .eq('id',receiptId).eq('contract_id',contractId).eq('week_start_eat',week).maybeSingle();
    if(recordError)return reply(req,503,{error:'original_receipt_unavailable'});
    if(!record)return reply(req,404,{error:'original_receipt_not_found'});
    const hash=record.payload_sha256,key=record.raw_object_key;
    if(!['succeeded','partial_depth','parse_failed','target_period_unavailable'].includes(record.status)||
       typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||
       typeof key!=='string'||key.length>300||!key.startsWith('v1/'+week+'/')||
       key.includes('..')||!/^[A-Za-z0-9_./-]+$/.test(key))
      return reply(req,409,{error:'original_receipt_not_verifiable'});
    try{
      const {data:original,error:readError}=await admin.storage
        .from('wk-chart-raw-evidence-v1').download(key);
      if(readError||!original||original.size<1||original.size>4_194_304)
        return reply(req,503,{error:'original_readback_unavailable'});
      const bytes=await original.arrayBuffer();
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      const calculated=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
      if(calculated!==hash)return reply(req,503,{error:'original_digest_mismatch'});
      return reply(req,200,{
        schemaVersion:'wk100-admin-original-readback-v1',weekStartEat:week,
        contractId,receiptId,originalVerified:true,payloadSha256:hash,
        byteLength:original.size,status:record.status,
        nativePeriodAuthority:record.native_period_authority,
        canScore:false,canPublish:false,
      });
    }catch{return reply(req,503,{error:'original_readback_unavailable'});}
  }
  // Only explicitly selected read-only columns are allowed across this
  // service-role boundary. No raw object keys, endpoints or credentials.
  const [contracts,attempts]=await Promise.all([
    admin.from('wk_chart_capture_contracts_v1')
      .select('id,source_key,provider_key,source_surface,market,behavior,native_metric,expected_depth,cadence_kind,interval_hours,eat_hour,eat_minute,weekday_eat,minimum_healthy_checkpoints,adapter_version,contract_version,admission_state')
      .order('created_at',{ascending:false}).limit(100),
    admin.from('wk_chart_capture_attempts_v1')
      .select('id,contract_id,week_start_eat,scheduled_at,attempt_number,created_at,fetched_at,status,observed_depth,native_period_authority,native_period_start,native_period_end,payload_sha256,failure_code')
      .eq('week_start_eat',week).order('created_at',{ascending:false}).limit(1000),
  ]);
  if(contracts.error||attempts.error)return reply(req,503,{error:'source_health_unavailable'});
  // Never silently present a partial source list as the entire constitution.
  if((contracts.data?.length??0)>=100||(attempts.data?.length??0)>=1000)
    return reply(req,503,{error:'source_health_page_limit'});
  try{
    return reply(req,200,projectWk100SourceHealth(contracts.data,attempts.data,week));
  }catch{return reply(req,503,{error:'source_projection_unavailable'});}
});
