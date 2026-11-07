/**
 * WK100 governed source scheduler, service-only and disabled by default.
 * Intended to be invoked by a separately approved timed trigger.
 * It NEVER scrapes providers directly, admits sources or publishes charts.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha256Hex } from '../_shared/chart-candidate-capture.mjs';
import { isGatewayVerifiedServiceRole, runtimeProjectApiUrl } from '../_shared/chart-capture-gateway-role.mjs';
import { wk100EatWeekFromUtc, bindWk100DispatchAuthority } from '../_shared/wk100-source-scheduler-authority.mjs';
import { planWk100SourceDispatch, selectWk100AuditedDispatch } from '../_shared/wk100-source-dispatch-plan.mjs';
import { selectWk100CollectNowDispatch } from '../_shared/wk100-collect-now-authority.mjs';

const JSON_HEADERS={'content-type':'application/json','cache-control':'no-store'};
const reply=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const TOKEN=/^[a-f0-9]{64}$/;
async function sealedManifest():Promise<Record<string,unknown>|null>{
  const raw=Deno.env.get('WK100_CAPTURE_SOURCE_MANIFEST')??'';
  const seal=Deno.env.get('WK100_CAPTURE_SOURCE_MANIFEST_SHA256')??'';
  if(raw.length<2||raw.length>32768||!TOKEN.test(seal))return null;
  if(await sha256Hex(new TextEncoder().encode(raw))!==seal)return null;
  try{
    const parsed:unknown=JSON.parse(raw);
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)
      ?parsed as Record<string,unknown>:null;
  }catch{return null;}
}
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!isGatewayVerifiedServiceRole(bearer,req.headers.get('apikey')))
    return reply(403,{error:'service_role_required'});
  // The disabled path performs no DB writes, source lookup or network GET.
  if(Deno.env.get('WK100_SOURCE_SCHEDULER_ENABLED')!=='true'||
    Deno.env.get('WK100_CAPTURE_ENABLED')!=='true')
    return reply(200,{schemaVersion:'wk100-source-scheduler-v1',
      status:'disabled',dispatched:0,canScore:false,canPublish:false});
  const url=runtimeProjectApiUrl(bearer,Deno.env.get('WK100_CAPTURE_PROJECT_REF'));
  const constitutionVersion=Deno.env.get('WK100_SOURCE_CONSTITUTION_VERSION')??'';
  const manifest=await sealedManifest();
  if(!url||!manifest||!/^[a-zA-Z0-9._-]{2,100}$/.test(constitutionVersion))
    return reply(503,{error:'scheduler_authority_unavailable',canPublish:false});
  // Never accept source keys, dates, endpoints or credentials in HTTP JSON.
  const declared=Number(req.headers.get('content-length')??0);
  if(!Number.isFinite(declared)||declared>2)return reply(400,{error:'request_invalid'});
  try{
    const now=new Date();
    const week=wk100EatWeekFromUtc(now);
    const db=createClient(url,bearer,{auth:{persistSession:false,autoRefreshToken:false}});
    const [contractsResult,methodsResult]=await Promise.all([
      db.from('wk_chart_capture_contracts_v1').select('*')
        .eq('admission_state','candidate').limit(101),
      db.rpc('wk100_service_admitted_methods_v1'),
    ]);
    if(contractsResult.error||methodsResult.error||
      !Array.isArray(contractsResult.data)||contractsResult.data.length>100||
      !Array.isArray(methodsResult.data)||methodsResult.data.length>100)
      return reply(503,{error:'scheduler_read_unavailable',canPublish:false});
    // Read the entire EAT week, with bounded stable paging. A partial source
    // attempt history must NEVER be treated as permission to invent a retry.
    const attempts:Record<string,unknown>[]=[];
    for(let offset=0;offset<=5000;offset+=500){
      const {data,error}=await db.from('wk_chart_capture_attempts_v1')
        .select('id,contract_id,week_start_eat,scheduled_at,attempt_number,status,created_at')
        .eq('week_start_eat',week).order('created_at',{ascending:false})
        .order('id',{ascending:false}).range(offset,offset+499);
      if(error||!Array.isArray(data)||attempts.length+data.length>5000)
        return reply(503,{error:'scheduler_attempt_history_unavailable',canPublish:false});
      attempts.push(...data);
      if(data.length<500)break;
      if(offset===5000)return reply(503,{error:'scheduler_attempt_history_unavailable',canPublish:false});
    }
    const approved=await bindWk100DispatchAuthority({
      methodRows:methodsResult.data,manifest,
      sourceContracts:contractsResult.data,
      sha256Hex,nowUtc:now,constitutionVersion,
    });
    const nowUtc=now.toISOString().replace(/\.\d{3}Z$/,'Z');
    // Unapproved historical contract versions cannot veto an otherwise
    // admitted current source. The binder already rejects competing
    // admitted versions of one source as an ambiguity.
    const admittedContracts=new Set(approved.map(d=>d.source_key+'/'+d.contract_version));
    const currentContracts=contractsResult.data.filter(c=>
      admittedContracts.has(c.source_key+'/'+c.contract_version));
    const plan=planWk100SourceDispatch({
      weekStartEat:week,nowUtc,
      sourceContracts:currentContracts,approvedDecisions:approved,
      attempts,executionEnabled:true,
    });
    // Retry intent is a mandatory authority gate, not just a priority
    // hint. The SQL read is service-only, and the exact source, contract,
    // week, scheduled instant and attempt must match before dispatch.
    const queued=await db.rpc('wk100_service_retry_requests_v1',{p_week:week});
    if(queued.error||!Array.isArray(queued.data)||queued.data.length>500)
      return reply(503,{error:'retry_requests_unavailable',canPublish:false});
    const authorized=selectWk100AuditedDispatch({
      jobs:plan.jobs,sourceContracts:currentContracts,retryRequests:queued.data,
    });
    const collectNow=await db.rpc('wk100_service_collect_now_requests_v1',{p_week:week});
    if(collectNow.error||!Array.isArray(collectNow.data)||collectNow.data.length>100)
      return reply(503,{error:'collect_now_requests_unavailable',canPublish:false});
    const immediate=selectWk100CollectNowDispatch({
      requests:collectNow.data,sourceContracts:currentContracts,
      approvedDecisions:approved,attempts,nowUtc,weekStartEat:week,
    });
    const immediateSlots=new Set(immediate.jobs.map(j=>j.source_key+'/'+j.scheduled_at));
    const jobs=[...immediate.jobs,...authorized.jobs.filter(j=>
      !immediateSlots.has(j.source_key+'/'+j.scheduled_at))];
    // A single trigger dispatches at most four source slots. A subsequent
    // five-minute tick can address the rest without exhausting Edge runtime.
    // The capture service owns SQL reservation, leases and private receipts.
    let dispatched=0,rejected=0;
    for(const job of jobs.slice(0,4)){
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),20000);
      try{
        const r=await fetch(url+'/functions/v1/wk-chart-capture',{
          method:'POST',redirect:'error',signal:controller.signal,
          headers:{authorization:'Bearer '+bearer,apikey:bearer,'content-type':'application/json'},
          body:JSON.stringify(job),
        });
        const result:unknown=r.ok?await r.json():null;
        if(r.ok&&result&&typeof result==='object'&&
          (result as Record<string,unknown>).can_publish===false)dispatched+=1;
        else rejected+=1;
      }catch{rejected+=1;}
      finally{clearTimeout(timeout);}
    }
    return reply(200,{schemaVersion:'wk100-source-scheduler-v1',
      status:'evaluated',weekStartEat:week,
      eligible:jobs.length,collectNowEligible:immediate.jobs.length,dispatched,rejected,
      withheldRetries:authorized.withheldRetryCount,
      blocked:plan.blocked.length,canScore:false,canPublish:false});
  }catch{return reply(503,{error:'scheduler_evaluation_failed',canPublish:false});}
});
