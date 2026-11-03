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
  let week:string;
  try{
    const raw=await req.text();
    if(raw.length>100)throw Error();
    const data=JSON.parse(raw);
    if(!data || Array.isArray(data) || Object.keys(data).length!==2 ||
       data.action!=='read_source_health'||!validEatWeek(data.weekStartEat))throw Error();
    week=data.weekStartEat;
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
