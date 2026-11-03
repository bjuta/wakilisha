/** WK100 Admin source method review. An admitted decision is NOT collector activation. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { validateWk100SourceMethodDecision, validateWk100ContractEnrollmentIntent } from '../_shared/wk100-source-method-decision-v1.mjs';

const ORIGINS=new Set([
  'https://wakilisha.africa','https://www.wakilisha.africa',
  'https://staging.wakilisha.africa','http://localhost:5173',
]);
function headers(req:Request):Record<string,string>{
  const origin=req.headers.get('origin')??'';
  return {'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff','vary':'Origin',
    ...(ORIGINS.has(origin)?{'access-control-allow-origin':origin}:{})};
}
function reply(req:Request,status:number,body:unknown) {
  return new Response(JSON.stringify(body),{status,headers:headers(req)});
}
const exact=(obj:Record<string,unknown>,keys:string[])=>
  Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const isRow=(d:unknown):boolean=>{
  if(!d||typeof d!=='object'||Array.isArray(d))return false;
  const p=d as Record<string,unknown>;
  return typeof p.sourceKey==='string'&&typeof p.providerKey==='string'&&
    p.sourceKey.startsWith(p.providerKey+'_')&&
    Number.isInteger(p.proposalRevision)&&Number.isInteger(p.decisionRevision)&&
    ['held','collector_admitted','paused','retired'].includes(String(p.decisionState))&&
    p.canScore===false&&p.canPublish===false;
};

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(origin&&!ORIGINS.has(origin))return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
    ...headers(req),'access-control-allow-methods':'POST,OPTIONS',
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  }});
  if(req.method!=='POST')return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [^\s]+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  let body:Record<string,unknown>;
  try {
    const raw=await req.text();
    if(raw.length>3500)throw Error('too_large');
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('bad_json');
    body=parsed as Record<string,unknown>;
  }catch{return reply(req,400,{error:'request_invalid'});}
  const list=body.action==='list_method_decisions'&&exact(body,['action']);
  const review=body.action==='review_source_method'&&
    exact(body,['action','decision','expectedDecisionRevision']);
  const enroll=body.action==='enroll_capture_contract'&&
    exact(body,['action','enrollment']);
  if(!list&&!review&&!enroll)return reply(req,400,{error:'request_invalid'});
  let enrollment:Record<string,unknown>|null=null;
  if(enroll){
    try{enrollment=validateWk100ContractEnrollmentIntent(body.enrollment);}
    catch{return reply(req,400,{error:'contract_enrollment_invalid'});}
  }
  let decision:Record<string,unknown>|null=null;
  if(review){
    try {
      if(!Number.isInteger(body.expectedDecisionRevision)||
        (body.expectedDecisionRevision as number)<0||
        (body.expectedDecisionRevision as number)>99999)throw Error('bad_revision');
      const validated=validateWk100SourceMethodDecision(body.decision);
      const {canCollect:_,canScore:__,canPublish:___,...safe}=validated;
      decision=safe;
    }catch{return reply(req,400,{error:'method_review_invalid'});}
  }
  const url=Deno.env.get('SUPABASE_URL')??'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
  if(!url||!anon)return reply(req,503,{error:'backend_unavailable'});
  // Caller JWT is verified by GoTrue and passed through the authenticated
  // PostgREST RPC. No service-role credential or caller-selected project URL.
  const caller=createClient(url,anon,{global:{headers:{authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const user=await caller.auth.getUser(bearer.slice(7));
  if(user.error||!user.data.user?.id)return reply(req,401,{error:'authentication_required'});
  const ingest=await caller.rpc('current_user_has_capability',{required_capability:'manage_ingest'});
  if(ingest.error)return reply(req,503,{error:'capability_unavailable'});
  if(ingest.data!==true)return reply(req,403,{error:'not_authorized'});
  if(list){
    const {data,error}=await caller.rpc('wk100_list_source_method_decisions_v1');
    if(error||!Array.isArray(data)||data.length>500||data.some(d=>!isRow(d)))
      return reply(req,503,{error:'method_decisions_unavailable'});
    return reply(req,200,{schemaVersion:'wk100-source-method-decisions-v1',
      decisions:data,canCollect:false,canScore:false,canPublish:false});
  }
  const charts=await caller.rpc('current_user_has_capability',{required_capability:'manage_charts'});
  if(charts.error)return reply(req,503,{error:'capability_unavailable'});
  if(charts.data!==true)return reply(req,403,{error:'not_authorized'});
  if(enrollment){
    if(!enrollment)return reply(req,400,{error:'contract_enrollment_invalid'});
    const {data,error}=await caller.rpc('wk100_enroll_source_capture_contract_v1',{
      p_source_key:enrollment.sourceKey,
      p_contract_version:enrollment.contractVersion,
      p_adapter_sha256:enrollment.adapterSha256,
      p_expected_proposal_revision:enrollment.expectedProposalRevision,
      p_expected_decision_revision:enrollment.expectedDecisionRevision,
    });
    if(error){
      const message=String(error.message??'');
      if(message.includes('wk100_contract_enrollment_not_authorized'))
        return reply(req,403,{error:'not_authorized'});
      if(message.includes('wk100_contract_already_enrolled')||
         message.includes('wk100_contract_proposal_stale_or_unqualified')||
         message.includes('wk100_contract_method_not_current'))
        return reply(req,409,{error:'contract_enrollment_conflict'});
      return reply(req,503,{error:'contract_enrollment_unavailable'});
    }
    const result=data as Record<string,unknown>|null;
    if(!result||result.sourceKey!==enrollment.sourceKey||
      result.contractVersion!==enrollment.contractVersion||
      result.proposalRevision!==enrollment.expectedProposalRevision||
      result.decisionRevision!==enrollment.expectedDecisionRevision||
      result.state!=='candidate'||
      result.canCollect!==false||result.canScore!==false||
      result.canPublish!==false||
      typeof result.contractId!=='string')
      return reply(req,503,{error:'contract_enrollment_confirmation_invalid'});
    return reply(req,200,{schemaVersion:'wk100-capture-contract-enrolled-v1',
      enrollment:result,canCollect:false,canScore:false,canPublish:false});
  }
  if(!decision)return reply(req,400,{error:'method_review_invalid'});
  const {data,error}=await caller.rpc('wk100_review_source_method_v1',{
    p_payload:decision,p_expected_decision_revision:body.expectedDecisionRevision,
  });
  if(error){
    const message=String(error.message??'');
    if(message.includes('wk100_method_review_conflict')||
       message.includes('wk100_method_review_proposal_stale'))
      return reply(req,409,{error:'method_revision_conflict'});
    if(message.includes('wk100_method_review_not_authorized')||
       message.includes('wk100_method_admission_requires_super_admin'))
      return reply(req,403,{error:'not_authorized'});
    if(message.includes('wk100_method_admission_unqualified'))
      return reply(req,422,{error:'method_unqualified'});
    return reply(req,503,{error:'method_write_unavailable'});
  }
  const valid=isRow(data)&&data.sourceKey===decision.sourceKey&&
    data.providerKey===decision.providerKey&&
    data.proposalRevision===decision.proposalRevision&&
    data.decisionRevision===(body.expectedDecisionRevision as number)+1&&
    data.decisionState===decision.decisionState;
  if(!valid)return reply(req,503,{error:'method_confirmation_invalid'});
  return reply(req,200,{schemaVersion:'wk100-source-method-written-v1',
    saved:data,canCollect:false,canScore:false,canPublish:false});
});
