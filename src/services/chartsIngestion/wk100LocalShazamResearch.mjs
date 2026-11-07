/**
 * Researcher-directed, offline inspection of a user-selected Shazam CSV.
 * Pure data transformation. Never fetch, upload, persist or publish.
 * This is NOT a hosted receipt or proof of when the provider served the file.
 */
import {parseShazamKenya} from '../../../supabase/functions/_shared/chart-public-source-observations.mjs';

const MAX_BYTES=4*1024*1024;
const PUBLIC_CHART='https://www.shazam.com/charts/top-200/kenya';
function fail(){throw new Error('wk100_local_shazam_research_invalid');}
export async function prepareWk100LocalShazamResearch({
  originalBytes,checkedAtUtc,subtle=globalThis.crypto?.subtle,
}={}){
  if(!(originalBytes instanceof Uint8Array)||
    originalBytes.byteLength===0||originalBytes.byteLength>MAX_BYTES||
    typeof checkedAtUtc!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(checkedAtUtc)||
    !Number.isFinite(Date.parse(checkedAtUtc))||
    new Date(checkedAtUtc).toISOString()!==checkedAtUtc||
    !subtle||typeof subtle.digest!=='function')fail();
  let parsed;
  try{
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(originalBytes);
    parsed=parseShazamKenya(raw);
  }catch{fail();}
  if(parsed?.source_key!=='shazam_ke'||parsed.market!=='KE'||
    parsed.metric!=='rank'||parsed.behavior!=='discovery'||
    !Number.isInteger(parsed.observed_depth)||parsed.observed_depth<1||
    parsed.observed_depth>200||parsed.rows?.length!==parsed.observed_depth||
    parsed.eligible_for_scoring!==false||parsed.native_period!=='unknown')fail();
  let digest;
  try{digest=new Uint8Array(await subtle.digest('SHA-256',originalBytes));}
  catch{fail();}
  if(digest.byteLength!==32)fail();
  const sha256=Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
  return Object.freeze({
    schema_version:'wk100-local-public-research-receipt/v1',
    source_key:'shazam_ke',market:'KE',source_page_url:PUBLIC_CHART,
    original_byte_length:originalBytes.byteLength,original_sha256:sha256,
    checked_at_utc:checkedAtUtc,
    source_retrieved_at_utc:null,source_fetch_verified:false,
    observed_rank_count:parsed.observed_depth,
    advertised_chart_depth:200,complete_chart:parsed.observed_depth===200,
    behavior:'discovery',native_metric:'rank',
    provider_period_label:parsed.provider_period_label??null,
    provider_snapshot_date:parsed.provider_snapshot_date??null,
    provider_rolling_window_days:parsed.provider_rolling_window_days??null,
    native_period_start:null,native_period_end:null,
    native_period_authority:'unknown',source_admitted:false,
    original_bytes_in_receipt:false,hosted_receipt_verified:false,
    can_score:false,can_publish:false,
  });
}
