/**
 * Explicit, service-only WK100 candidate source capture endpoint.
 * Disabled by default and never registered as a cron job in this slice.
 * No source is configured, admitted or fetched by this code itself.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { runCandidateCapture } from '../_shared/chart-capture-runtime.mjs';
import { sha256Hex } from '../_shared/chart-candidate-capture.mjs';
import { isGatewayVerifiedServiceRole, runtimeProjectApiUrl } from '../_shared/chart-capture-gateway-role.mjs';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json','cache-control':'no-store'},
});
function constantEqual(a:string,b:string):boolean {
  const aa=new TextEncoder().encode(a),bb=new TextEncoder().encode(b);
  let mismatch=aa.length^bb.length;
  for(let i=0;i<Math.max(aa.length,bb.length);i++) mismatch|=(aa[i]??0)^(bb[i]??0);
  return mismatch===0;
}
async function readApprovedConfig():Promise<Record<string,unknown> | null> {
  const raw=Deno.env.get('WK100_CAPTURE_SOURCE_MANIFEST')??'';
  const expected=Deno.env.get('WK100_CAPTURE_SOURCE_MANIFEST_SHA256')??'';
  if(!raw || raw.length>32_768 || !/^[a-f0-9]{64}$/.test(expected)) return null;
  const observed=await sha256Hex(new TextEncoder().encode(raw));
  if(!constantEqual(observed,expected)) return null;
  let parsed:unknown;
  try { parsed=JSON.parse(raw); } catch {return null;}
  return parsed && typeof parsed==='object' && !Array.isArray(parsed)
    ? parsed as Record<string,unknown> : null;
}
function approvedEntry(manifest:Record<string,unknown>,sourceKey:string,version:string,now:Date) {
  const entries=manifest.sources;
  if(!Array.isArray(entries) || entries.length>8) return null;
  const hit=entries.filter(v=>v && typeof v==='object' &&
    v.source_key===sourceKey && v.contract_version===version);
  if(hit.length!==1) return null;
  const source=hit[0];
  if(source.enabled!==true || source.market!=='KE' ||
    source.method!=='GET' || source.purpose!=='candidate_raw_evidence' ||
    typeof source.endpoint!=='string' || typeof source.authorization_ref!=='string' ||
    typeof source.authorization_expires_at!=='string' ||
    !Number.isFinite(Date.parse(source.authorization_expires_at)) ||
    Date.parse(source.authorization_expires_at)<=now.valueOf()) return null;
  return source;
}

Deno.serve(async (req:Request) => {
  if(req.method!=='POST') return json(405,{error:'method_not_allowed'});
  // The hosted Edge gateway MUST verify the legacy JWT before this handler runs.
  // See supabase/config.toml [functions.wk-chart-capture] verify_jwt = true.
  // A correctly signed service_role JWT can differ byte-for-byte from the
  // platform-injected legacy key (e.g. after Preview key rotation).
  // Do not accept any unsigned, publishable, or claimed-but-unverified token.
  const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!isGatewayVerifiedServiceRole(bearer,req.headers.get('apikey')))
    return json(403,{error:'service_role_required'});
  // The disabled state requires no database access, project configuration,
  // source manifest, or external provider calls. Fail closed until enabled.
  if(Deno.env.get('WK100_CAPTURE_ENABLED')!=='true')
    return json(503,{error:'candidate_collector_disabled'});
  // When separately enabled, require a second platform-secret-bound project
  // reference matching the gateway-verified JWT. Never allow a credential
  // for another project to select its own backend from a Preview deployment.
  const url=runtimeProjectApiUrl(bearer,Deno.env.get('WK100_CAPTURE_PROJECT_REF'));
  if(!url) return json(503,{error:'backend_project_binding_unavailable'});
  const manifest=await readApprovedConfig();
  if(!manifest) return json(503,{error:'source_access_manifest_unavailable'});
  let payload:Record<string,unknown>;
  try {
    const declared=Number(req.headers.get('content-length')??0);
    if(!Number.isFinite(declared) || declared>2048) return json(413,{error:'request_too_large'});
    const reader=req.body?.getReader();
    if(!reader) return json(400,{error:'request_invalid'});
    const chunks:Uint8Array[]=[];let received=0;
    try {
      while(true){const part=await reader.read();if(part.done)break;
        received+=part.value.byteLength;
        if(received>2048){await reader.cancel();return json(413,{error:'request_too_large'});}
        chunks.push(part.value);}
    } finally {try{reader.releaseLock();}catch{/* cancelled */}}
    const bytes=new Uint8Array(received);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!value || typeof value!=='object' || Array.isArray(value) ||
      Object.keys(value).some(k=>!['source_key','contract_version','week_start_eat','scheduled_at','attempt_number'].includes(k)))
      return json(400,{error:'request_invalid'});
    payload=value;
  } catch {return json(400,{error:'request_invalid'});}
  const key=payload.source_key,version=payload.contract_version;
  if(typeof key!=='string'||typeof version!=='string' ||
    typeof payload.week_start_eat!=='string' || typeof payload.scheduled_at!=='string' ||
    !Number.isInteger(payload.attempt_number)) return json(400,{error:'source_invalid'});
  const now=new Date();
  const entry=approvedEntry(manifest,key,version,now);
  if(!entry) return json(403,{error:'source_access_not_authorized'});
  // Only Apple's native catalog charts endpoint may receive the explicitly
  // configured developer token. Never accept request-body headers or secrets.
  let providerAuthorization: {kind:string;token:string} | undefined;
  if(key==='apple_ke') {
    let nativeApple=false;
    try {const endpoint=new URL(entry.endpoint);
      nativeApple=endpoint.protocol==='https:' &&
        endpoint.hostname==='api.music.apple.com' &&
        endpoint.pathname==='/v1/catalog/ke/charts';
    } catch { /* transport rejects malformed endpoints separately */ }
    if(nativeApple) {
      const token=Deno.env.get('WK100_APPLE_MUSIC_DEVELOPER_TOKEN')??'';
      if(!/^[a-zA-Z0-9_.-]{20,8192}$/.test(token))
        return json(503,{error:'source_credential_not_configured',can_publish:false});
      providerAuthorization={kind:'apple_developer_bearer',token};
    }
  }
  const db=createClient(url,bearer,{auth:{persistSession:false,autoRefreshToken:false}});
  const found=await db.from('wk_chart_capture_contracts_v1').select('*')
    .eq('source_key',key).eq('contract_version',version).maybeSingle();
  if(found.error || !found.data) return json(409,{error:'source_contract_absent'});
  if(found.data.admission_state!=='candidate') return json(409,{error:'not_candidate_contract'});
  const rpc=async (name:string,args:Record<string,unknown>)=>{
    const {data,error}=await db.rpc(name,args);
    if(error) throw new Error(`database_${name}_rejected`);
    if(!data || typeof data!=='object') throw new Error('database_receipt_invalid');
    return data;
  };
  const archiveBucket=db.storage.from('wk-chart-raw-evidence-v1');
  const storage={
    async readPrivate(key:string):Promise<Uint8Array> {
      const r=await archiveBucket.download(key);
      if(r.error||!r.data) throw new Error('private_readback_failed');
      return new Uint8Array(await r.data.arrayBuffer());
    },
    async putCreateOnly(key:string,bytes:Uint8Array,options:{contentType:string;upsert:false}):Promise<void> {
      const result=await archiveBucket.upload(key,new Blob([bytes],{type:options.contentType}),{
        contentType:options.contentType,upsert:false,cacheControl:'0'});
      if(!result.error) return;
      // Only a known duplicate may be reconciled. Do not hide unrelated upload errors.
      const duplicate=String(result.error.statusCode)==='409'||
        (String(result.error.statusCode)==='400' && /already exists|duplicate/i.test(result.error.message));
      if(!duplicate) throw new Error('create_only_upload_failed');
      const existing=await storage.readPrivate(key);
      const original=await sha256Hex(bytes);
      if(existing.byteLength!==bytes.byteLength||await sha256Hex(existing)!==original)
        throw new Error('create_only_collision_digest_conflict');
    },
  };
  const backend={
    reserve:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_reserve_v1',args),
    advance:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_advance_v1',args),
    commit:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_commit_v1',args),
    fail:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_fail_v1',args),
  };
  const verifyAccess=async (decision:{source_key:string;exact_endpoint:string;authorization_ref:string})=>{
    const current=approvedEntry(manifest,key,version,new Date());
    return !!current && current.source_key===decision.source_key &&
      current.endpoint===decision.exact_endpoint &&
      current.authorization_ref===decision.authorization_ref;
  };
  try {
    const result=await runCandidateCapture({contract:found.data,
      weekStartEat:String(payload.week_start_eat),scheduledAt:String(payload.scheduled_at),
      attemptNumber:Number(payload.attempt_number),
      access:{source_key:key,endpoint:entry.endpoint,authorization_ref:entry.authorization_ref,
        native_period_key:entry.native_period_key,providerAuthorization},
      verifyAccess,db:backend,storage,
      clock:()=>new Date(),enabled:true,timeoutMs:12000});
    // Never serialize upstream content or credential values into the response.
    return json(200,{status:result.status,receipt_id:result.receipt_id??null,
      can_publish:false});
  } catch(e) {
    const code=e && typeof e==='object' && 'code' in e ? String(e.code) : 'capture_rejected';
    // No provider URL, secret, raw body, or SQL error detail in an HTTP reply.
    const safe=/^[a-z][a-z0-9_]{2,63}$/.test(code) ? code : 'capture_rejected';
    return json(409,{error:safe,can_publish:false});
  }
});
