// WAKILISHA Charts 2.0 Phase 1: one signed-in, capability-gated
// research-original, reviewed GET and first-party YouTube POST capture worker.
// No scoring, Registry mutation, publication, timer or key exposure.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { decodeCharts2Original, listCharts2SourceContracts, charts2YouTubeNativeWeeklyPost } from "../_shared/charts2-original-candidate.mjs";
import {scoreCharts2PrivatePreviewV1,CHARTS2_PRIVATE_METHODOLOGY_V1} from "../_shared/charts2-private-scoring-v1.mjs";
import {buildCharts2PrivateNativeReviewV1} from "../_shared/charts2-private-native-review-v1.mjs";

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
    mdundo_ke:["play.mdundo.com"],
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
async function readCappedStream(body:ReadableStream<Uint8Array>|null,limit:number) {
  if(!body)throw new Reject(400,"charts2_original_required");
  const reader=body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try {
    for(;;) {
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>limit)throw new Reject(413,"charts2_original_size_invalid");
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  if(total<1)throw new Reject(400,"charts2_original_required");
  const merged=new Uint8Array(total);
  let position=0;
  for(const c of chunks){merged.set(c,position);position+=c.byteLength;}
  return merged;
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
  return {user:data.user,authClient:client,
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



/** Only verified actor session may invoke the service-role snapshot. */
async function studioSnapshot(server:any) {
  const read=await server.rpc("charts2_studio_private_snapshot_v1");
  if(read.error||read.data?.contract!=="charts2-private-studio/v1")
    throw new Reject(503,"charts2_studio_snapshot_unavailable");
  return read.data;
}
async function verifyPrivateOriginal(server:any,receipt:any) {
  if(!receipt||typeof receipt.original_object_key!=="string" ||
     receipt.original_bucket!==BUCKET ||
     !/^[a-f0-9]{64}$/.test(receipt.original_sha256??"")||
     !Number.isInteger(receipt.original_byte_length) ||
     receipt.original_byte_length<1||receipt.original_byte_length>MAX_BYTES)
    throw new Reject(409,"charts2_studio_original_invalid");
  const storage=await server.storage.from(BUCKET).download(receipt.original_object_key);
  if(storage.error||!storage.data)
    throw new Reject(503,"charts2_studio_original_unavailable");
  const bytes=new Uint8Array(await storage.data.arrayBuffer());
  if(bytes.length!==receipt.original_byte_length)
    throw new Reject(409,"charts2_studio_original_mismatch");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
    x=>x.toString(16).padStart(2,"0")).join("");
  if(hash!==receipt.original_sha256)
    throw new Reject(409,"charts2_studio_original_mismatch");
}
async function requireRegistryReviewer(authClient:any) {
  const result=await authClient.rpc("current_user_has_capability",{
    required_capability:"manage_registry",
  });
  if(result.error||result.data!==true)
    throw new Reject(403,"charts2_manage_registry_required");
}
const TRACK_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function studioAction(mode:string,req:Request,server:any,authClient:any) {
  if(mode==="studio_preview") {
    const snapshot=await studioSnapshot(server);
    const receipts=snapshot.receipts??[];
    if(!Array.isArray(receipts)||receipts.length!==5) {
      return {state:"incomplete_source_set",can_publish:false,
        source_methods:snapshot.source_methods,methodology:snapshot.methodology,
        receipt_count:receipts.length};
    }
    await Promise.all(receipts.map((r:any)=>verifyPrivateOriginal(server,r)));
    let preview;
    try {
      preview=scoreCharts2PrivatePreviewV1({
        receipts,registry_links:snapshot.registry_links,
      });
    } catch {throw new Reject(409,"charts2_studio_unqualified_snapshot");}
    const locked=CHARTS2_PRIVATE_METHODOLOGY_V1;
    const storedWeights=snapshot.methodology?.rule_set?.weights;
    if(snapshot.methodology?.version!==locked.version||
       snapshot.methodology?.scoring_policy_version!==locked.scoring_policy_version||
       !storedWeights||typeof storedWeights!=="object"||
       Object.keys(storedWeights).length!==Object.keys(locked.sources).length||
       Object.entries(locked.sources).some(([name,policy])=>
         storedWeights[name]!==policy.weight_points))
      throw new Reject(409,"charts2_studio_methodology_mismatch");
    // Independent PostgreSQL authority recomputes the same canonical
    // order. Never expose an unverified Edge-only ranking as freeze-ready.
    const gate=await server.rpc("charts2_private_freeze_preflight_v1");
    if(gate.error||gate.data?.contract!=="charts2-private-freeze-preflight/v1")
      throw new Reject(503,"charts2_freeze_preflight_unavailable");
    const preflight=gate.data;
    const dbRanking=preflight.ranking??[];
    if(!Array.isArray(dbRanking)||
       preflight.eligible_count!==preview.candidates.length||
       preflight.unresolved_count!==preview.unresolved.length||
       preflight.conflict_count!==preview.conflicts.length||
       dbRanking.length!==Math.min(preview.candidates.length,100)||
       dbRanking.some((r:any,i:number)=>
         r.track_id!==preview.candidates[i]?.track_id||
         r.score_units!==preview.candidates[i]?.score_units))
      throw new Reject(409,"charts2_private_freeze_score_disagreement");
    // Provisional appearances are independent from the Registry freeze gate.
    // If a source-label collision makes review unsafe, leave the existing
    // verified Studio and freeze preflight available without a false list.
    let native_review=null;
    try {native_review=buildCharts2PrivateNativeReviewV1({receipts});}
    catch {native_review=null;}
    return {state:"private_review",preview,native_review,source_methods:snapshot.source_methods,
      history:snapshot.history??[],read_at:snapshot.read_at,
      server_verified_originals:receipts.length,
      freeze_gate:{
        input_sha256:preflight.input_sha256,
        ranking_sha256:preflight.ranking_sha256,
        eligible_count:preflight.eligible_count,
        unresolved_count:preflight.unresolved_count,
        conflict_count:preflight.conflict_count,
        freeze_ready:preflight.freeze_ready,
        latest_freeze_id:preflight.latest_freeze_id,
        recent_freezes:preflight.recent_freezes??[],
      },
      can_publish:false};
  }
  if(mode==="studio_freeze") {
    await requireRegistryReviewer(authClient);
    const supplied=await req.json().catch(()=>null);
    const ack="I approve freezing this exact 100-recording private chart candidate. It will not publish.";
    if(!supplied||typeof supplied!=="object"||Array.isArray(supplied)||
       Object.keys(supplied).some(k=>![
         "expected_input_sha256","expected_previous_id","acknowledgement",
       ].includes(k))||
       typeof supplied.expected_input_sha256!=="string"||
       !/^[a-f0-9]{64}$/.test(supplied.expected_input_sha256)||
       (supplied.expected_previous_id!==null&&
        (typeof supplied.expected_previous_id!=="string"||
         !TRACK_UUID.test(supplied.expected_previous_id)))||
       supplied.acknowledgement!==ack)
      throw new Reject(400,"charts2_freeze_explicit_approval_invalid");
    const snapshot=await studioSnapshot(server);
    const receipts=snapshot.receipts??[];
    if(!Array.isArray(receipts)||receipts.length!==5)
      throw new Reject(409,"charts2_freeze_requires_five_receipts");
    await Promise.all(receipts.map((r:any)=>verifyPrivateOriginal(server,r)));
    // The database recomputes the entire ranking and expected digest under
    // a transaction-serialized CAS. It ignores any browser-submitted scores.
    const outcome=await authClient.rpc("charts2_freeze_private_candidate_v1",{
      p_expected_input_sha256:supplied.expected_input_sha256,
      p_expected_previous_id:supplied.expected_previous_id,
      p_ack:supplied.acknowledgement,
    });
    if(outcome.error||!outcome.data) {
      const m=outcome.error?.message??"";
      if(m.includes("charts2_private_freeze_requires_charts_and_registry"))
        throw new Reject(403,"charts2_freeze_review_authority_required");
      if(m.includes("charts2_private_freeze_stale_snapshot")||
         m.includes("charts2_private_freeze_revision_conflict"))
        throw new Reject(409,"charts2_freeze_stale_review_reload");
      if(m.includes("charts2_private_freeze_insufficient_registry_authority"))
        throw new Reject(409,"charts2_freeze_identity_review_incomplete");
      throw new Reject(422,"charts2_private_freeze_rejected");
    }
    return {state:"private_frozen",...outcome.data,can_publish:false};
  }
  if(mode==="studio_track_search") {
    await requireRegistryReviewer(authClient);
    const supplied=await req.json().catch(()=>null);
    if(!supplied||typeof supplied.query!=="string" ||
       Object.keys(supplied).some(k=>k!=="query"))
      throw new Reject(400,"charts2_studio_track_search_invalid");
    const q=supplied.query.trim();
    if(q.length<2||q.length>80)
      throw new Reject(400,"charts2_studio_track_search_invalid");
    const safe=q.replace(/[\\%_]/g,"\\$&");
    const result=TRACK_UUID.test(q)
      ? await server.from("registry_tracks")
          .select("id,title,isrc,status,release_id").eq("id",q).limit(10)
      : await server.from("registry_tracks")
          .select("id,title,isrc,status,release_id")
          .ilike("title","%"+safe+"%").limit(10);
    if(result.error)throw new Reject(503,"charts2_studio_registry_search_failed");
    return {state:"registry_candidates",tracks:(result.data??[])
      .filter((r:any)=>r.status==="active"),can_publish:false};
  }
  if(mode==="studio_review_link") {
    await requireRegistryReviewer(authClient);
    const supplied=await req.json().catch(()=>null);
    if(!supplied||typeof supplied!=="object"||Array.isArray(supplied)||
       Object.keys(supplied).some(k=>![
         "source_key","rank","receipt_id","original_sha256",
         "track_id","review_note","evidence_url","acknowledgement"
       ].includes(k)))
      throw new Reject(400,"charts2_studio_review_invalid");
    const source=sourceKey(supplied.source_key);
    if(!Number.isSafeInteger(supplied.rank)||supplied.rank<1||
       !TRACK_UUID.test(supplied.track_id??"")||
       !TRACK_UUID.test(supplied.receipt_id??"")||
       !/^[a-f0-9]{64}$/.test(supplied.original_sha256??"")||
       typeof supplied.review_note!=="string"||
       supplied.review_note.trim().length<40||
       supplied.review_note.trim().length>1000||
       typeof supplied.evidence_url!=="string"||
       supplied.acknowledgement!==
         "I have independently verified this exact recording and authorize its Registry provider link.")
      throw new Reject(400,"charts2_studio_review_invalid");
    let url:URL;
    try {url=new URL(supplied.evidence_url);} catch {
      throw new Reject(400,"charts2_studio_review_evidence_url_invalid");
    }
    if(url.protocol!=="https:"||url.username||url.password||
       url.hostname==="localhost"||url.hostname.endsWith(".local"))
      throw new Reject(400,"charts2_studio_review_evidence_url_invalid");
    const snapshot=await studioSnapshot(server);
    const receipt=(snapshot.receipts??[]).find((r:any)=>
      r.source_key===source&&r.id===supplied.receipt_id &&
      r.original_sha256===supplied.original_sha256);
    const observation=receipt?.observations?.find((o:any)=>o.rank===supplied.rank);
    if(!observation||typeof observation.provider_track_id!=="string"||
       !observation.provider_track_id.trim())
      throw new Reject(409,"charts2_studio_recording_id_unavailable");
    await verifyPrivateOriginal(server,receipt);
    const canonical=await server.from("registry_tracks").select("id,status")
      .eq("id",supplied.track_id).maybeSingle();
    if(canonical.error||canonical.data?.status!=="active")
      throw new Reject(409,"charts2_studio_track_ineligible");
    const provider=CHARTS2_PRIVATE_METHODOLOGY_V1.sources[source].provider_key;
    const existing=(snapshot.registry_links??[]).filter((x:any)=>
      x.provider_key===provider&&
      x.provider_track_id===observation.provider_track_id&&
      x.match_status==="matched");
    if(existing.some((x:any)=>x.track_id!==supplied.track_id))
      throw new Reject(409,"charts2_studio_registry_identity_conflict");
    // Canonical writes go through Registry's accepted human-reviewed broker.
    // The actor's own JWT is sent, NEVER the service-role client.
    const accepted=await authClient.rpc("admin_admit_registry_track_provider_link_v1",{
      p_track_id:supplied.track_id,p_provider_key:provider,
      p_provider_track_id:observation.provider_track_id,
      p_match_method:"manual",p_match_confidence:1,p_match_status:"matched",
      p_raw_payload:{
        charts2_studio_review_v1:true,source_key:source,
        receipt_id:receipt.id,original_sha256:receipt.original_sha256,
        provider_track_id:observation.provider_track_id,
        review_note:supplied.review_note.trim(),
        evidence_url:url.toString(),
      },
    });
    if(accepted.error)
      throw new Reject(409,"charts2_studio_registry_review_rejected");
    return {state:"registry_review_submitted",source_key:source,
      rank:supplied.rank,receipt_id:receipt.id,
      // Existing Registry broker owns the authoritative mutation and audit.
      broker_result:accepted.data,can_publish:false};
  }
  throw new Reject(400,"charts2_mode_unrecognized");
}

/** The single bounded original-byte transport for collector and method probe. */
async function fetchSourceOriginal(source_key:string, endpoint:string,
  nativeRequest:{method:"POST",body:string}|null) {
  const controller=new AbortController();
  const abort=setTimeout(()=>controller.abort(),12000);
  try {
    const upstream=await fetch(endpoint,{
      method:nativeRequest?.method??"GET",redirect:"error",
      credentials:"omit",cache:"no-store",
      headers:{accept:nativeRequest
        ?"application/json, text/html, text/csv, application/octet-stream"
        :MIME[source_key],...(nativeRequest?{"content-type":"application/json"}:{})},
      ...(nativeRequest?{body:nativeRequest.body}:{}),
      signal:controller.signal,
    });
    if(upstream.status!==200)throw new Reject(502,"charts2_source_non_200");
    const contentType=decodeContentType(upstream.headers.get("content-type"));
    if(contentType!==MIME[source_key])throw new Reject(415,"charts2_source_type_unqualified");
    const size=Number(upstream.headers.get("content-length")??0);
    if(size>MAX_BYTES)throw new Reject(413,"charts2_source_too_large");
    const bytes=await readCappedStream(upstream.body,MAX_BYTES);
    return {bytes,contentType};
  } catch(e) {
    if(e instanceof Reject)throw e;
    throw new Reject(502,"charts2_source_transport_failed");
  } finally {clearTimeout(abort);}
}

async function handle(req:Request) {
  if(req.headers.get("origin")&&!ORIGINS.has(req.headers.get("origin")!))
    throw new Reject(403,"charts2_origin_not_allowed");
  const {user,server,authClient}=await session(req);
  const url=new URL(req.url);
  const mode=url.searchParams.get("mode")??"upload";
  if(["studio_preview","studio_track_search","studio_review_link","studio_freeze"].includes(mode))
    return studioAction(mode,req,server,authClient);
  let key:string, endpoint:string, target_period_key:string|null=null;
  let contentType:string, bytes:Uint8Array, methodRevision:number|null=null;
  let captureMode:"research_original_upload"|"service_original";

  if(mode==="verify_method") {
    // Signed-in, capability-gated first-party probe; never auto-admits any
    // source method. GET providers remain native as-of observations, not weeks.
    const supplied=await req.json().catch(()=>null);
    if(!supplied||typeof supplied!=="object"||Array.isArray(supplied)||
       Object.keys(supplied).some(k=>k!=="source_key"&&k!=="target_period_key"))
      throw new Reject(400,"charts2_method_probe_arguments_invalid");
    key=sourceKey(supplied.source_key);
    const period=supplied.target_period_key;
    if(key==="youtube_ke" && typeof period!=="string")
      throw new Reject(422,"charts2_method_probe_period_invalid");
    if(key!=="youtube_ke" && period!==undefined && period!==null)
      throw new Reject(422,"charts2_get_probe_period_forbidden");
    const source=SOURCES.get(key);
    endpoint=source.first_party_endpoint;
    expectedUrl(key,endpoint);
    let nativeRequest:{method:"POST",body:string}|null=null;
    if(key==="youtube_ke") {
      try {
        nativeRequest=charts2YouTubeNativeWeeklyPost(key,endpoint,period);
      } catch {
        throw new Reject(422,"charts2_method_probe_period_invalid");
      }
    }
    const result=await fetchSourceOriginal(key,endpoint,nativeRequest);
    let verified;
    try {
      verified=await decodeCharts2Original({
        source_key:key,endpoint,
        target_period_key:key==="youtube_ke"?period:null,
        observed_at:new Date().toISOString(),original_bytes:result.bytes,
      });
    } catch {
      throw new Reject(422,"charts2_method_probe_original_unqualified");
    }
    if(verified.evidence_only!==true||verified.can_score!==false||
       verified.can_publish!==false||verified.observed_depth<1||
       verified.observed_depth>source.depth ||
       (key==="youtube_ke"&&!verified.provider_week_ending_date))
      throw new Reject(422,"charts2_method_probe_original_unqualified");
    const objectKey=await storeOriginal(
      server,key,result.bytes,verified.payload_sha256,result.contentType);
    const recorded=key==="youtube_ke"
      ? await server.rpc("charts2_record_youtube_method_probe_v1",{
          p_actor:user.id,p_period:period,
          p_end_date:verified.provider_week_ending_date,
          p_sha:verified.payload_sha256,p_object_key:objectKey,
          p_size:result.bytes.byteLength,p_depth:verified.observed_depth,
        })
      : await server.rpc("charts2_record_get_method_probe_v1",{
          p_source_key:key,p_actor:user.id,
          p_sha:verified.payload_sha256,p_object_key:objectKey,
          p_size:result.bytes.byteLength,p_depth:verified.observed_depth,
        });
    if(recorded.error||!recorded.data?.probe_id||
       !Number.isInteger(recorded.data.expected_revision))
      throw new Reject(503,"charts2_method_probe_record_failed");
    return {
      source_key:key,method:nativeRequest?"POST":"GET",review_state:"unchanged",
      probe_id:recorded.data.probe_id,
      expected_revision:recorded.data.expected_revision,
      original_sha256:verified.payload_sha256,
      provider_week_ending_date:verified.provider_week_ending_date,
      provider_updated_at:verified.provider_updated_at,
      native_period:verified.native_period,
      observed_status:verified.status,
      observed_depth:verified.observed_depth,expected_depth:source.depth,
      unresolved_identity_count:verified.unresolved_identity_count,
      can_score:false,can_publish:false,
      action_required:"explicit_method_review",
    };
  }
  if(mode==="review_method") {
    // Source admission or revocation is authorized by the user's own JWT
    // inside the SQL RPC, never by passing a claimed reviewer through service_role.
    const supplied=await req.json().catch(()=>null);
    if(!supplied||typeof supplied!=="object"||Array.isArray(supplied)||
       Object.keys(supplied).some(k=>![
         "source_key","action","probe_id","expected_revision","acknowledgement"
       ].includes(k)))
      throw new Reject(400,"charts2_method_review_arguments_invalid");
    key=sourceKey(supplied.source_key);
    if(!["admit","hold"].includes(supplied.action)||
       !Number.isInteger(supplied.expected_revision)||
       supplied.expected_revision<0||supplied.expected_revision>2147483645||
       typeof supplied.acknowledgement!=="string")
      throw new Reject(400,"charts2_method_review_arguments_invalid");
    const probe=supplied.probe_id??null;
    if(probe!==null&&(typeof probe!=="string"||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(probe)))
      throw new Reject(400,"charts2_method_review_probe_invalid");
    const args={
      p_action:supplied.action,p_probe_id:probe,
      p_expected_revision:supplied.expected_revision,
      p_ack:supplied.acknowledgement,
    };
    const outcome=key==="youtube_ke"
      ? await authClient.rpc("charts2_decide_youtube_method_v1",args)
      : await authClient.rpc("charts2_decide_get_method_v1",{
          ...args,p_source_key:key,
        });
    if(outcome.error||!outcome.data) {
      const code=outcome.error?.message??"";
      if(code.includes("charts2_method_review_revision_conflict"))
        throw new Reject(409,"charts2_method_review_revision_conflict");
      if(code.includes("charts2_method_review_not_authorized"))
        throw new Reject(403,"charts2_manage_charts_required");
      if(code.includes("charts2_method_review_evidence_unqualified"))
        throw new Reject(409,"charts2_method_review_evidence_unqualified");
      throw new Reject(422,"charts2_method_review_rejected");
    }
    return outcome.data;
  }

  if(mode==="upload") {
    const declared=Number(req.headers.get("content-length")??0);
    if(Number.isFinite(declared)&&declared>MAX_REQUEST_BYTES)
      throw new Reject(413,"charts2_request_too_large");
    const bounded=await readCappedStream(req.body,MAX_REQUEST_BYTES);
    const form=await new Response(bounded,{
      headers:{"content-type":req.headers.get("content-type")??""},
    }).formData().catch(()=>{
      throw new Reject(400,"charts2_form_invalid");
    });
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
    if(key!=="youtube_ke"&&period!==undefined&&period!==null)
      throw new Reject(422,"charts2_get_collect_period_forbidden");
    target_period_key=period===undefined||period===null?null:String(period);
    const decision=await server.rpc("charts2_get_collector_method_v1",{p_source_key:key});
    if(decision.error)throw new Reject(503,"charts2_source_method_read_failed");
    const method=decision.data?.[0];
    // Only YouTube's native Kenya Top Songs request may use an admitted POST.
    // Other four approved source methods stay GET-only.
    if(!method||!((key==="youtube_ke"&&method.reviewed_method==="POST")||
      (key!=="youtube_ke"&&method.reviewed_method==="GET")))
      throw new Reject(409,"charts2_source_method_held");
    endpoint=method.exact_endpoint;
    methodRevision=method.method_revision;
    expectedUrl(key,endpoint);
    let nativeRequest:{method:"POST",body:string}|null=null;
    if(key==="youtube_ke") {
      try {
        nativeRequest=charts2YouTubeNativeWeeklyPost(key,endpoint,target_period_key);
      } catch {
        throw new Reject(422,"charts2_youtube_period_unqualified");
      }
    }
    const result=await fetchSourceOriginal(key,endpoint,nativeRequest);
    bytes=result.bytes;
    contentType=result.contentType;
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
