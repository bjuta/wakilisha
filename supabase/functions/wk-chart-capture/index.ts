/**
 * Explicit, service-only WK100 candidate source capture endpoint.
 * Disabled by default and never registered as a cron job in this slice.
 * No source is configured, admitted or fetched by this code itself.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { runCandidateCapture } from '../_shared/chart-capture-runtime.mjs';
import { selectWk100AuditedDispatch } from '../_shared/wk100-source-dispatch-plan.mjs';
import { isWk100CaptureConstitutionCurrent } from '../_shared/wk100-source-scheduler-authority.mjs';
import { sha256Hex, isWk100YouTubeNativePost } from '../_shared/chart-candidate-capture.mjs';
import { isGatewayVerifiedServiceRole, runtimeProjectApiUrl } from '../_shared/chart-capture-gateway-role.mjs';
import { isWk100AppleCatalogChart, resolveWk100AppleProviderAuthorization } from '../_shared/wk100-apple-service-credential.mjs';

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
    (source.method!=='GET'&&
      !(source.method==='POST'&&
        isWk100YouTubeNativePost(sourceKey,source.endpoint,source.native_period_key))) ||
    source.purpose!=='candidate_raw_evidence' ||
    typeof source.endpoint!=='string' || typeof source.authorization_ref!=='string' ||
    typeof source.adapter_sha256!=='string' ||
    !/^[a-f0-9]{64}$/.test(source.adapter_sha256) ||
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
      Object.keys(value).some(k=>!['source_key','contract_version','week_start_eat','scheduled_at','attempt_number','collection_mode'].includes(k)))
      return json(400,{error:'request_invalid'});
    payload=value;
  } catch {return json(400,{error:'request_invalid'});}
  const key=payload.source_key,version=payload.contract_version;
  if(typeof key!=='string'||typeof version!=='string' ||
    typeof payload.week_start_eat!=='string' || typeof payload.scheduled_at!=='string' ||
    !Number.isInteger(payload.attempt_number)) return json(400,{error:'source_invalid'});
  if(payload.collection_mode!==undefined && payload.collection_mode!=='collect_now')
    return json(400,{error:'collection_mode_invalid'});
  const collectionMode=payload.collection_mode==='collect_now'?'collect_now':'scheduled';
  const now=new Date();
  const entry=approvedEntry(manifest,key,version,now);
  if(!entry) return json(403,{error:'source_access_not_authorized'});
  // Bind collection to the *current* service-only method authority. A source
  // manifest permits a route, but it never admits or re-admits a source.
  // The same check repeats before transport to honour pause/retire actions.
  const db=createClient(url,bearer,{auth:{persistSession:false,autoRefreshToken:false}});
  const endpointSha256=await sha256Hex(new TextEncoder().encode(entry.endpoint));
  const constitutionVersion=Deno.env.get('WK100_SOURCE_CONSTITUTION_VERSION')??'';
  const methodAllowed=async():Promise<boolean>=>{
    if(!/^[a-zA-Z0-9._-]{2,100}$/.test(constitutionVersion))return false;
    // Both probes execute using the gateway-verified service credential,
    // not browser input, and each check is repeated before actual transport.
    const [authority,current]=await Promise.all([
      db.rpc('wk100_service_capture_method_allowed_v1',{
        p_source_key:key,p_contract_version:version,
        p_endpoint_sha256:endpointSha256,
        p_authorization_ref:entry.authorization_ref,
        p_parser_class:entry.parser_class,
      }),
      db.rpc('wk100_service_admitted_methods_v1'),
    ]);
    return !authority.error&&authority.data===true&&!current.error&&
      isWk100CaptureConstitutionCurrent({
        rows:current.data,sourceKey:key,contractVersion:version,
        endpointSha256,authorizationRef:entry.authorization_ref,
        parserClass:entry.parser_class,constitutionVersion,nowUtc:new Date(),
        httpMethod:entry.method,
      });
  };
  if(!await methodAllowed())
    return json(403,{error:'source_method_not_admitted',can_publish:false});
  const found=await db.from('wk_chart_capture_contracts_v1').select('*')
    .eq('source_key',key).eq('contract_version',version).maybeSingle();
  if(found.error || !found.data) return json(409,{error:'source_contract_absent'});
  if(found.data.admission_state!=='candidate') return json(409,{error:'not_candidate_contract'});
  if(!/^[a-f0-9]{64}$/.test(found.data.adapter_sha256??'') ||
     found.data.adapter_sha256!==entry.adapter_sha256 ||
     found.data.adapter_version!==entry.parser_class)
    return json(409,{error:'source_adapter_digest_mismatch',can_publish:false});
  // The service-role token alone cannot invent an Admin Collect Now request.
  // A signed-in Admin must have created its exact current-clock SQL ticket.
  // The separate SQL reserve_now function repeats this check atomically.
  if(collectionMode==='collect_now'){
    if(payload.attempt_number!==1)
      return json(403,{error:'collect_now_retry_forbidden',can_publish:false});
    const tickets=await db.rpc('wk100_service_collect_now_requests_v1',{
      p_week:payload.week_start_eat,
    });
    if(tickets.error||!Array.isArray(tickets.data)||tickets.data.length>100)
      return json(503,{error:'collect_now_authority_unavailable',can_publish:false});
    const allowed=tickets.data.some(t=>
      t.contract_id===found.data.id &&
      t.source_key===key && t.contract_version===version &&
      Number.isFinite(Date.parse(t.scheduled_at)) &&
      Date.parse(t.scheduled_at)===Date.parse(String(payload.scheduled_at)));
    if(!allowed)return json(403,{error:'collect_now_not_authorized',can_publish:false});
  }
  // This endpoint is independently callable by a service credential. It
  // must not trust the scheduler as the only guard for attempt 2..8.
  // Query the service-only immutable action ledger before credentials,
  // reservation or provider egress. A direct call cannot forge approval.
  if(Number(payload.attempt_number)>1){
    const queued=await db.rpc('wk100_service_retry_requests_v1',{
      p_week:payload.week_start_eat,
    });
    if(queued.error||!Array.isArray(queued.data)||queued.data.length>500)
      return json(503,{error:'retry_request_authority_unavailable',can_publish:false});
    let allowed=false;
    try{
      const dispatch=selectWk100AuditedDispatch({
        jobs:[{source_key:key,contract_version:version,
          week_start_eat:payload.week_start_eat,
          scheduled_at:payload.scheduled_at,attempt_number:payload.attempt_number}],
        sourceContracts:[found.data],retryRequests:queued.data,
      });
      allowed=dispatch.jobs.length===1;
    }catch{return json(503,{error:'retry_request_authority_unavailable',can_publish:false});}
    if(!allowed)
      return json(403,{error:'retry_request_not_authorized',can_publish:false});
  }
  // No Apple credential is read unless this exact source is currently
  // admitted AND the manifest routes to Apple's official Kenya chart API.
  // The existing platform signing key can only be reused after a separate
  // WK100-specific opt-in. Preview reads its own bound database, never Production.
  // A minted developer token stays in memory and is sent only to the approved
  // Apple endpoint by the existing no-redirect candidate transport.
  let providerAuthorization: {kind:string;token:string} | undefined;
  if(isWk100AppleCatalogChart(key,entry.endpoint)){
    const credentials=await resolveWk100AppleProviderAuthorization({
      sourceKey:key,endpoint:entry.endpoint,db,
      directToken:Deno.env.get('WK100_APPLE_MUSIC_DEVELOPER_TOKEN')??'',
      reuseExisting:Deno.env.get('WK100_APPLE_USE_EXISTING_PLATFORM_CREDENTIALS')==='true',
    });
    if(!credentials)
      return json(503,{error:'source_credential_not_configured',can_publish:false});
    providerAuthorization=credentials;
  }
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
    reserveNow:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_reserve_now_v1',args),
    advance:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_advance_v1',args),
    commit:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_commit_v1',args),
    fail:(args:Record<string,unknown>)=>rpc('wk_chart_runtime_fail_v1',args),
  };
  const verifyAccess=async (decision:{source_key:string;exact_endpoint:string;authorization_ref:string})=>{
    const current=approvedEntry(manifest,key,version,new Date());
    return !!current && current.source_key===decision.source_key &&
      current.endpoint===decision.exact_endpoint &&
      current.authorization_ref===decision.authorization_ref &&
      await methodAllowed();
  };
  try {
    const result=await runCandidateCapture({contract:found.data,
      weekStartEat:String(payload.week_start_eat),scheduledAt:String(payload.scheduled_at),
      attemptNumber:Number(payload.attempt_number),collectionMode,
      access:{source_key:key,endpoint:entry.endpoint,authorization_ref:entry.authorization_ref,
        method:entry.method,native_period_key:entry.native_period_key,
        parser_class:entry.parser_class,providerAuthorization},
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
