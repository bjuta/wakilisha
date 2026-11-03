/** WK100 source proposal management. Does not admit or capture sources. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { validateWk100SourceProposal } from '../_shared/wk100-source-proposal-v1.mjs';

const allowedOrigins = new Set([
  'https://wakilisha.africa', 'https://www.wakilisha.africa',
  'https://staging.wakilisha.africa', 'http://localhost:5173',
]);
function headers(req:Request):Record<string,string> {
  const origin=req.headers.get('origin')??'';
  return {'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff','vary':'Origin',
    ...(allowedOrigins.has(origin)?{'access-control-allow-origin':origin}:{})};
}
function reply(req:Request,status:number,body:unknown) {
  return new Response(JSON.stringify(body),{status,headers:headers(req)});
}
const exactKeys=(data:Record<string,unknown>, keys:string[]) =>
  Object.keys(data).length===keys.length && keys.every(key=>Object.hasOwn(data,key));

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(origin && !allowedOrigins.has(origin))return reply(req,403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers(req),
    'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
    'access-control-allow-methods':'POST,OPTIONS'}});
  if(req.method!=='POST')return reply(req,405,{error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')??'';
  if(!/^Bearer [^\s]+$/.test(bearer))return reply(req,401,{error:'authentication_required'});
  let body:Record<string,unknown>;
  try {
    const raw=await req.text();
    if(raw.length>3500)throw Error();
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();
    body=parsed as Record<string,unknown>;
  }catch{return reply(req,400,{error:'request_invalid'});}
  const list=body.action==='list_source_proposals' && exactKeys(body,['action']);
  const submit=body.action==='submit_source_proposal' &&
    exactKeys(body,['action','proposal','expectedRevision']);
  if(!list&&!submit)return reply(req,400,{error:'request_invalid'});
  let normalized:Record<string,unknown>|null=null;
  if(submit){
    try{
      if(!Number.isInteger(body.expectedRevision)||
        (body.expectedRevision as number)<0||(body.expectedRevision as number)>99999)throw Error();
      normalized=validateWk100SourceProposal(body.proposal);
    }catch{return reply(req,400,{error:'proposal_invalid'});}
  }
  const url=Deno.env.get('SUPABASE_URL')??'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
  if(!url||!anon)return reply(req,503,{error:'backend_unavailable'});
  const caller=createClient(url,anon,{global:{headers:{authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const user=await caller.auth.getUser(bearer.slice(7));
  if(user.error||!user.data.user?.id)return reply(req,401,{error:'authentication_required'});
  const permission=await caller.rpc('current_user_has_capability',{required_capability:'manage_ingest'});
  if(permission.error)return reply(req,503,{error:'capability_unavailable'});
  if(permission.data!==true)return reply(req,403,{error:'not_authorized'});
  const chartsPermission=await caller.rpc('current_user_has_capability',{required_capability:'manage_charts'});
  if(chartsPermission.error)return reply(req,503,{error:'capability_unavailable'});
  if(chartsPermission.data!==true)return reply(req,403,{error:'not_authorized'});
  if(list){
    const {data,error}=await caller.rpc('wk100_list_source_proposals_v1');
    if(error||!Array.isArray(data)||data.length>500)
      return reply(req,503,{error:'proposal_list_unavailable'});
    if(data.some(p=>!p||typeof p.providerKey!=='string'||typeof p.sourceKey!=='string'||
      !p.sourceKey.startsWith(p.providerKey+'_')||p.state!=='proposed'||p.canCollect!==false||
      p.canScore!==false||p.canPublish!==false))
      return reply(req,503,{error:'proposal_list_invalid'});
    return reply(req,200,{schemaVersion:'wk100-source-proposals-v1',proposals:data,
      canCollect:false,canScore:false,canPublish:false});
  }
  // SQL validates the original proposal fields independently. Remove server-only
  // projection fields rather than forwarding claimed admission authority.
  if(!normalized)return reply(req,400,{error:'proposal_invalid'});
  const {schemaVersion:_,market:__,state:___,canCollect:____,canScore:_____,canPublish:______, ...payload}=normalized;
  const {data,error}=await caller.rpc('wk100_submit_source_proposal_v1',{
    p_payload:payload,p_expected_revision:body.expectedRevision,
  });
  if(error){
    if(String(error.message??'').includes('wk100_source_proposal_conflict'))
      return reply(req,409,{error:'proposal_revision_conflict'});
    if(String(error.message??'').includes('wk100_proposal_not_authorized'))
      return reply(req,403,{error:'not_authorized'});
    return reply(req,503,{error:'proposal_write_unavailable'});
  }
  if(!data||data.state!=='proposed'||data.canCollect!==false||
    data.canScore!==false||data.canPublish!==false||
    data.providerKey!==payload.providerKey||data.sourceKey!==payload.sourceKey||
    data.revision!==(body.expectedRevision as number)+1)
    return reply(req,503,{error:'proposal_confirmation_invalid'});
  return reply(req,200,{schemaVersion:'wk100-source-proposal-written-v1',saved:data});
});
