// WAKILISHA Charts 2.0 Phase 1: one signed-in, capability-gated
// research-original and authorized-GET capture worker.
// No scoring, Registry mutation, publication, timer or key exposure.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { decodeCharts2Original, listCharts2SourceContracts } from "../_shared/charts2-original-candidate.mjs";

const MAX_BYTES = 4_000_000;
const MAX_REQUEST_BYTES = 6_000_000;
const BUCKET = "charts2-evidence-private-v1";
const SOURCES = new Map(listCharts2SourceContracts().map((s) => [s.source_key, s]));
const MIME = Object.freeze({
  apple_ke:"text/html",mdundo_ke:"text/html",audiomack_ke:"text/html",
  shazam_ke:"text/csv",youtube_ke:"application/json",
});
const EXT = Object.freeze({
  "text/html":".html","text/csv":".csv","application/json":".json",
});
const ORIGINS = new Set([
  "https://wakilisha.africa","https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173","http://localhost:4173",
]);

function response(req: Request, status: number, body: unknown) {
  const origin = req.headers.get("origin");
  const cors = origin && ORIGINS.has(origin) ? {
    "access-control-allow-origin": origin, "vary":"Origin",
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"authorization, apikey, content-type, x-client-info",
  } : {};
  return new Response(JSON.stringify(body), {
    status,headers:{"content-type":"application/json; charset=utf-8",
      "cache-control":"no-store", ...cors},
  });
}
class Reject extends Error {
  constructor(public status: number, code: string) { super(code); }
}
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Reject(503,"charts2_runtime_unconfigured");
  return value;
}
function sourceKey(raw: unknown): string {
  if (typeof raw !== "string" || !SOURCES.has(raw))
    throw new Reject(400,"charts2_source_not_selected");
  return raw;
}
function expectedUrl(source_key:string, endpoint: string) {
  let u:URL;
  try {u = new URL(endpoint);}catch{throw new Reject(422,"charts2_endpoint_unqualified");}
  if (u.protocol!=="https:" || u.username || u.password || u.port || u.hash)
    throw new Reject(422,"charts2_endpoint_unqualified");
  const permitted:Record<string,string[]> = {
    apple_ke:["music.apple.com"],
    shazam_ke:["shazam.com","www.shazam.com"],
    mdundo_ke:["mdundo.com","www.mdundo.com"],
    youtube_ke:["charts.youtube.com"],
    audiomack_ke:["audiomack.com","www.audiomack.com"],
  };
  if (!permitted[source_key]?.includes(u.hostname))
    throw new Reject(422,"charts2_endpoint_unqualified");
  const contract=SOURCES.get(source_key);
  if(contract.first_party_endpoint && contract.first_party_endpoint!==endpoint)
    throw new Reject(422,"charts2_endpoint_unqualified");
}
function decodeContentType(raw:string|null) {
  return (raw??"").split(";")[0].toLowerCase().trim();
}
async function bodyBytes(source_key:string, blob:Blob) {
  if(blob.size < 1 || blob.size > MAX_BYTES)
    throw new Reject(413,"charts2_original_size_invalid");
  if(decodeContentType(blob.type) && decodeContentType(blob.type)!==MIME[source_key])
    throw new Reject(415,"charts2_original_type_invalid");
  return new Uint8Array(await blob.arrayBuffer());
}
async function session(req:Request) {
  const token=req.headers.get("authorization")??"";
  if(!/^Bearer [^\s]+$/.test(token))
    throw new Reject(401,"charts2_authentication_required");
  const url=required("SUPABASE_URL");
  const anon=required("SUPABASE_ANON_KEY");
  const client=createClient(url,anon,{
    global:{headers:{Authorization:token}},auth:{persistSession:false},
  });
  const {data,error}=await client.auth.getUser(token.slice(7));
  if(error||!data?.user)throw new Reject(401,"charts2_authentication_required");
  const capability=await client.rpc("current_user_has_capability",{
    required_capability:"manage_charts",
  });
  if(capability.error||capability.data!==true)
    throw new Reject(403,"charts2_manage_charts_required");
  return {user:data.user,
    server:createClient(url,required("SUPABASE_SERVICE_ROLE_KEY"),
      {auth:{persistSession:false}})};
}

async function storeOriginal(server:any, source_key:string, bytes:Uint8Array,
                            sha:string, contentType:string) {
  const key=`${source_key}/${sha.slice(0,2)}/${sha}${EXT[contentType]}`;
  const store=server.storage.from(BUCKET);
  const existing=await store.download(key);
  if(existing.error) {
    const upload=await store.upload(key,new Blob([bytes],{type:contentType}),{
      contentType,upsert:false,cacheControl:"0",
    });
    // A concurrent identical upload is harmless; read and rehash regardless.
    if(upload.error) {
      const raced=await store.download(key);
      if(raced.error)throw new Reject(503,"charts2_evidence_upload_failed");
    }
  }
  const reread=await store.download(key);
  if(reread.error||!reread.data)
    throw new Reject(503,"charts2_evidence_readback_failed");
  const original=new Uint8Array(await reread.data.arrayBuffer());
  if(original.byteLength!==bytes.byteLength)
    throw new Reject(409,"charts2_storage_digest_mismatch");
  const verified=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",original)),
    x=>x.toString(16).padStart(2,"0")).join("");
  if(verified!==sha)throw new Reject(409,"charts2_storage_digest_mismatch");
  return key;
}

async function handle(req:Request) {
  if(req.headers.get("origin")&&!ORIGINS.has(req.headers.get("origin")!))
    throw new Reject(403,"charts2_origin_not_allowed");
  const {user,server}=await session(req);
  const url=new URL(req.url);
  const mode=url.searchParams.get("mode")??"upload";
  let key:string, endpoint:string, target_period_key:string|null=null;
  let contentType:string, bytes:Uint8Array, methodRevision:number|null=null;
  let captureMode:"research_original_upload"|"service_original";

  if(mode==="upload") {
    const declared=Number(req.headers.get("content-length")??0);
    if(Number.isFinite(declared)&&declared>MAX_REQUEST_BYTES)
      throw new Reject(413,"charts2_request_too_large");
    const form=await req.formData();
    key=sourceKey(form.get("source_key"));
    endpoint=String(form.get("source_endpoint")??"");
    expectedUrl(key,endpoint);
    const file=form.get("original");
    if(!(file instanceof File))
      throw new Reject(400,"charts2_original_required");
    contentType=MIME[key];
    bytes=await bodyBytes(key,file);
    const period=form.get("target_period_key");
    target_period_key=period===null?null:String(period);
    captureMode="research_original_upload";
  } else if(mode==="collect") {
    const supplied=await req.json().catch(()=>null);
    key=sourceKey(supplied?.source_key);
    if(Object.keys(supplied??{}).some(k=>k!=="source_key"&&k!=="target_period_key"))
      throw new Reject(400,"charts2_collect_arguments_invalid");
    const period=supplied?.target_period_key;
    target_period_key=period===undefined?null:String(period);
    const decision=await server.rpc("charts2_get_collector_method_v1",{p_source_key:key});
    if(decision.error)throw new Reject(503,"charts2_source_method_read_failed");
    const method=decision.data?.[0];
    if(!method||method.reviewed_method!=="GET")
      throw new Reject(409,"charts2_source_method_held");
    endpoint=method.exact_endpoint;
    methodRevision=method.method_revision;
    expectedUrl(key,endpoint);
    const controller=new AbortController();
    const abort=setTimeout(()=>controller.abort(),12000);
    let upstream:Response;
    try {
      upstream=await fetch(endpoint,{method:"GET",redirect:"error",
        credentials:"omit",headers:{accept:MIME[key]},signal:controller.signal});
    }catch{throw new Reject(502,"charts2_source_transport_failed");}
    finally{clearTimeout(abort);}
    if(upstream.status!==200)throw new Reject(502,"charts2_source_non_200");
    contentType=decodeContentType(upstream.headers.get("content-type"));
    if(contentType!==MIME[key])throw new Reject(415,"charts2_source_type_unqualified");
    const size=Number(upstream.headers.get("content-length")??0);
    if(size>MAX_BYTES)throw new Reject(413,"charts2_source_too_large");
    bytes=await bodyBytes(key,new Blob([await upstream.arrayBuffer()],{type:contentType}));
    captureMode="service_original";
  } else {
    throw new Reject(400,"charts2_mode_unrecognized");
  }

  const observedAt=new Date().toISOString();
  const candidate=await decodeCharts2Original({
    source_key:key,original_bytes:bytes,endpoint,observed_at:observedAt,
    target_period_key,
  });
  // This is evidence-only, never a score admission.
  if(candidate.can_score!==false||candidate.can_publish!==false||
     candidate.evidence_only!==true||candidate.source_access_authorized!==false)
    throw new Reject(500,"charts2_candidate_authority_failure");
  const path=await storeOriginal(server,key,bytes,candidate.payload_sha256,contentType);
  const payload={
    source_key:key,source_endpoint:endpoint,capture_mode:captureMode,
    observed_at:observedAt,original_object_key:path,
    original_sha256:candidate.payload_sha256,
    original_byte_length:bytes.byteLength,
    original_verified_at:new Date().toISOString(),
    original_content_type:contentType,
    expected_depth:candidate.declared_depth,
    observations:candidate.rows,
    parser_version:"charts2-source-parsers-v1",
    provider_updated_at:candidate.provider_updated_at,
    provider_week_ending_date:candidate.provider_week_ending_date,
    native_period_authority:candidate.provider_week_ending_date
      ?"provider_declared_end_date":"unknown",
    method_revision:methodRevision,captured_by:user.id,
    verification_state:"server_sha256_storage_readback",
  };
  const write=await server.rpc("charts2_commit_verified_original_v1",{
    p_capture:payload,
  });
  if(write.error||!write.data)
    throw new Reject(503,"charts2_verified_receipt_commit_failed");
  return {
    status:candidate.status,source_key:key,market:"KE",
    receipt_id:write.data,observed_depth:candidate.observed_depth,
    declared_depth:candidate.declared_depth,
    original_sha256:candidate.payload_sha256,
    unresolved_identity_count:candidate.unresolved_identity_count,
    source_method_state:captureMode==="research_original_upload"
      ?"research_not_admitted":"collector_admitted",
    can_score:false,can_publish:false,
  };
}

serve(async(req)=>{
  if(req.method==="OPTIONS") {
    if(req.headers.get("origin")&&!ORIGINS.has(req.headers.get("origin")!))
      return response(req,403,{ok:false,error:"charts2_origin_not_allowed"});
    return response(req,200,{ok:true});
  }
  if(req.method!=="POST")return response(req,405,{ok:false,error:"charts2_method_not_allowed"});
  try{return response(req,200,{ok:true,...await handle(req)});}
  catch(e) {
    const error=e instanceof Reject?e:new Reject(500,"charts2_capture_failed");
    // No raw source contents, provider credentials or user identifiers in logs.
    return response(req,error.status,{ok:false,error:error.message});
  }
});
