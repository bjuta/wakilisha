/**
 * Strict browser transport for the *two sealed October 2026 HTML originals*.
 * No browser Storage, Registry authority, publisher method or generic URL.
 */
import {getWk100ArchivedResearchPortfolio} from './wk100ResearchPortfolio.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN=new Set(['authentication_required','not_authorized','capability_unavailable',
  'intake_not_enabled','backend_unavailable','research_payload_invalid',
  'research_source_invalid','research_receipt_not_verified']);
const fail=code=>{throw Error('wk100_html_ui_'+code);};

export async function prepareWk100HtmlResearchForm({sourceKey,originalHtml,weekStartEat}){
  const record=getWk100ArchivedResearchPortfolio(weekStartEat)
    .find(x=>x.sourceKey===sourceKey&&x.rankStructure==='verified'&&
      ['mdundo_ke','apple_ke_public_playlist'].includes(x.sourceKey));
  if(!record)fail('source_not_supported');
  if(!(originalHtml instanceof File)||originalHtml.size!==record.byteLength)
    fail('original_bytes_mismatch');
  let bytes;
  try{bytes=new Uint8Array(await originalHtml.arrayBuffer());}
  catch{fail('original_bytes_mismatch');}
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const actual=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(actual!==record.rawSha256)fail('original_bytes_mismatch');
  const form=new FormData();
  form.append('original_html',originalHtml,'original.html');
  form.append('source_key',sourceKey);
  form.append('research_week_start_eat',weekStartEat);
  return form;
}

export async function submitWk100HtmlResearchEvidence({
  sourceKey,originalHtml,weekStartEat,invoke,
}){
  if(typeof invoke!=='function')fail('transport_unavailable');
  const form=await prepareWk100HtmlResearchForm({sourceKey,originalHtml,weekStartEat});
  let response;
  try{response=await invoke('wk100-research-html-intake',{body:form});}
  catch{fail('server_unavailable');}
  if(response?.error||response?.data?.error){
    let code=response?.data?.error;
    const context=response?.error?.context;
    if(!KNOWN.has(code)&&context instanceof Response){
      try{
        if(context.headers.get('content-type')?.toLowerCase().includes('application/json')){
          const raw=await context.clone().text();
          if(raw.length<=512){
            const parsed=JSON.parse(raw);
            if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&
               typeof parsed.error==='string')code=parsed.error;
          }
        }
      }catch{}
    }
    fail(KNOWN.has(code)?code:'server_unavailable');
  }
  const data=response?.data;
  if(!data||typeof data!=='object'||Array.isArray(data)||
     data.schema_version!=='wk100-admin-html-research-ack-v1'||
     !UUID.test(data.reservation_id??'')||
     data.persisted!==true||data.original_bytes_privately_verified!==true||
     data.research_week_start_eat!==weekStartEat||
     data.source_key!==sourceKey||data.observed_depth!==100||
     data.native_period_authority!=='unknown'||
     data.source_admitted!==false||data.can_score!==false||
     data.can_publish!==false||data.status!=='research_only')
    fail('unverified_ack');
  return Object.freeze({
    sourceKey,weekStartEat,observedDepth:100,verified:true,
    status:'research_only',canScore:false,canPublish:false,
  });
}
