/**
 * WK100 browser transport for an existing researcher-directed Shazam receipt.
 * This module never persists original bytes, actor references or rank labels.
 */
const MAX_ORIGINAL=4194304, MAX_RECEIPT=4096;
const SHA=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ACTOR=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,239}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URLs=new Set([
  "https://www.shazam.com/charts/top-200/kenya",
  "https://www.shazam.com/services/charts/csv/top-200/kenya",
]);
const KEYS=["schema_version","source_key","source_url","observed_at",
  "operator_ref","acquisition_mode","raw_sha256","byte_length","observed_depth",
  "source_native_period","identity_state","can_publish"];
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=code=>{throw new Error("wk100_research_ui_"+code);};
const validWeek=week=>{
  if(typeof week!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(week))return false;
  const d=new Date(week+"T12:00:00Z");
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===week&&d.getUTCDay()===1;
};
const validUTC=time=>typeof time==="string"&&UTC.test(time)&&
  Number.isFinite(Date.parse(time))&&new Date(time).toISOString().replace(".000Z","Z")===time;

export async function prepareWk100ResearchForm({originalCsv,receiptFile,weekStartEat}){
  if(!validWeek(weekStartEat))fail("week_invalid");
  if(!(originalCsv instanceof File)||originalCsv.size<1||originalCsv.size>MAX_ORIGINAL)fail("csv_invalid");
  if(!(receiptFile instanceof File)||receiptFile.size<1||receiptFile.size>MAX_RECEIPT)fail("receipt_invalid");
  let receipt,receiptText;
  try{receiptText=await receiptFile.text();receipt=JSON.parse(receiptText);}
  catch{fail("receipt_invalid");}
  if(!exact(receipt,KEYS)||receipt.schema_version!=="wk100-shazam-research-receipt-v1"||
    receipt.source_key!=="shazam_ke"||!URLs.has(receipt.source_url)||
    !validUTC(receipt.observed_at)||typeof receipt.operator_ref!=="string"||
    !ACTOR.test(receipt.operator_ref)||
    receipt.acquisition_mode!=="researcher_directed_public_csv"||
    !SHA.test(receipt.raw_sha256)||receipt.byte_length!==originalCsv.size||
    !Number.isInteger(receipt.observed_depth)||receipt.observed_depth<1||
    receipt.observed_depth>200||
    !exact(receipt.source_native_period,["authority","starts_at","ends_at"])||
    receipt.source_native_period.authority!=="unknown"||
    receipt.source_native_period.starts_at!==null||
    receipt.source_native_period.ends_at!==null||
    receipt.identity_state!=="unresolved"||receipt.can_publish!==false)fail("receipt_invalid");

  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",await originalCsv.arrayBuffer()));
  const sha=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
  if(sha!==receipt.raw_sha256)fail("original_bytes_mismatch");
  const form=new FormData();
  form.append("original_csv",originalCsv,"original.csv"); // Never transmit the local filename.
  form.append("receipt_json",receiptText);
  form.append("research_week_start_eat",weekStartEat);
  return {form,observedDepth:receipt.observed_depth};
}

export async function submitWk100ResearchEvidence({originalCsv,receiptFile,weekStartEat,invoke}){
  if(typeof invoke!=="function")fail("transport_unavailable");
  const {form,observedDepth}=await prepareWk100ResearchForm({originalCsv,receiptFile,weekStartEat});
  let response;
  try{response=await invoke("wk100-research-intake",{body:form});}
  catch{fail("server_unavailable");}
  if(response?.error||response?.data?.error){
    const known=new Set(["authentication_required","not_authorized","capability_unavailable",
      "intake_not_enabled","backend_unavailable","research_payload_invalid",
      "research_source_invalid","research_receipt_not_verified"]);
    let code=response?.data?.error;
    // supabase-js places non-2xx JSON responses in FunctionsHttpError.context,
    // not necessarily in data. Admit only known public error codes, never details.
    const context=response?.error?.context;
    if(!known.has(code)&&context instanceof Response){
      try{
        if(context.headers.get("content-type")?.toLowerCase().includes("application/json")){
          const text=await context.clone().text();
          if(text.length<=512){
            const parsed=JSON.parse(text);
            if(object(parsed)&&typeof parsed.error==="string")code=parsed.error;
          }
        }
      }catch{} // Body unavailable or invalid: retain the generic safe fallback.
    }
    fail(known.has(code)?code:"server_unavailable");
  }
  const data=response?.data;
  if(!object(data)||data.schema_version!=="wk100-admin-research-intake-ack-v1"||
    !UUID.test(data.reservation_id??"")||data.persisted!==true||
    data.original_bytes_privately_verified!==true||data.source!=="Shazam Kenya"||
    data.research_week_start_eat!==weekStartEat||data.observed_depth!==observedDepth||
    data.source_native_metric!=="discovery_rank"||
    data.native_period_authority!=="unknown"||data.status!=="research_only"||
    data.source_admitted!==false||data.can_score!==false||data.can_publish!==false)
    fail("unverified_ack");
  // Project only public-safe fields, even if a server accidentally returns more.
  return Object.freeze({weekStartEat,observedDepth,verified:true,status:"research_only",
    canScore:false,canPublish:false});
}
