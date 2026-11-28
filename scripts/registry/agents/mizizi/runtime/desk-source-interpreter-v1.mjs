/** Local-only, bounded source interpretation. No network, model, source
 * retention or identity authority. A worker thread bounds execution/heap;
 * production still requires a separately isolated process and egress ACL.
 * All extracted text, links and metadata are untrusted source content.
 */
import {createHash} from "node:crypto";
import {Worker,parentPort,workerData} from "node:worker_threads";
import {isIP} from "node:net";

const CONTRACT="mizizi.desk_source_interpretation.v1";
const WORK="mizizi.desk_parser_worker.v1";
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const MAX_BYTES=2_000_000,MAX_TEXT=16000,MAX_LINKS=30,MAX_PAGES=10;
const MAX_DOM_NODES=50000,MAX_MS=15000;
const MIME=new Set(["text/html","application/xhtml+xml","text/plain","application/pdf"]);
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
const fail=code=>{throw Error("MIZIZI_DESK_PARSE_"+code);};
const clean=value=>String(value??"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g," ")
 .replace(/\r\n?/g,"\n").replace(/[^\S\n]+/g," ").replace(/ *\n */g,"\n").replace(/\n{3,}/g,"\n\n").trim();
const label=(value,limit=500)=>clean(value).slice(0,limit)||null;
const bounded=(value,limit)=>{const text=clean(value);return {text:text.slice(0,limit),truncated:text.length>limit};};
function safeLead(raw,base){
 if(typeof raw!=="string"||raw.length>2048||/[\p{Cc}\p{Cf}\\]/u.test(raw))return null;
 try{
  const u=new URL(raw,base);
  if(u.protocol!=="https:"||u.username||u.password||u.port||isIP(u.hostname)||
    !u.hostname.includes(".")||u.hostname.endsWith(".")||
    /(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/i.test(u.hostname))return null;
  for(const k of u.searchParams.keys())if(/token|signature|password|passwd|secret|credential|session|api[-_]?key|authorization|^sig$|^auth$|^key$|^x-amz-|^x-goog-/i.test(k))return null;
  u.hash="";return u.href.length<=2048?u.href:null;
 }catch{return null;}
}
// Read only explicit negative machine-readable restrictions. Their absence
// is not a licence, permission, or evidence about all applicable terms.
function documentProcessingRestricted(doc){
 const restricted=value=>/(?:^|[\s,:;])(?:noai|noimageai|notrain|noarchive|nosnippet|none)(?:$|[\s,:;])/i.test(value)||
  /(?:^|[\s,;])max-snippet\s*:\s*0(?:$|[\s,;])/i.test(value);
 return [...doc.querySelectorAll("meta[name]")].some(n=>{
  const name=(n.getAttribute("name")??"").toLowerCase();
  return ["robots","wakilisha-mizizi","googlebot","bingbot","gptbot","claudebot"].includes(name)&&restricted(n.getAttribute("content")??"");
 });
}
// Browser observation bytes remain local; use the same negative-signal check.
export async function deskRenderedProcessingRestrictedV1(body,url){
 if(!(body instanceof Uint8Array)||body.length<1||body.length>MAX_BYTES)return true;
 const {JSDOM}=await import("jsdom");
 const dom=new JSDOM(new TextDecoder("utf-8",{fatal:true}).decode(body),{url,contentType:"text/html"});
 try{return dom.window.document.querySelectorAll("*").length>MAX_DOM_NODES||documentProcessingRestricted(dom.window.document);}
 finally{dom.window.close();}
}
async function parseHtml(body,url){
 const [{JSDOM},{Readability}]=await Promise.all([import("jsdom"),import("@mozilla/readability")]);
 // Never enable runScripts or resources. No browsing context with network
 // access, no remote base URL resolution, no HTML returned to the caller.
 const html=new TextDecoder("utf-8",{fatal:true}).decode(body);
 const dom=new JSDOM(html,{url,contentType:"text/html"});
 try{
  const doc=dom.window.document;
  if(doc.querySelectorAll("*").length>MAX_DOM_NODES)fail("DOM_BUDGET");
  const processingRestricted=documentProcessingRestricted(doc);
  doc.querySelectorAll("script,style,template,noscript,iframe,object,embed,form,base,link,[hidden],[aria-hidden='true']").forEach(n=>n.remove());
  const links=[],seen=new Set();let linksTruncated=false;
  for(const a of doc.querySelectorAll("a[href]")){
   const href=safeLead(a.getAttribute("href"),url);
   if(!href||seen.has(href))continue;
   seen.add(href);
   if(links.length>=MAX_LINKS){linksTruncated=true;break;}
   links.push({url:href,label:label(a.textContent,240),kind:"unverified_reference_lead"});
  }
  const fallbackTitle=label(doc.title);
  const article=new Readability(doc,{maxElemsToParse:MAX_DOM_NODES,charThreshold:120,keepClasses:false}).parse();
  if(!article||!clean(article.textContent)){
   return {kind:"html",...(processingRestricted?{processingRestricted:true}:{}),title:fallbackTitle,author:null,publishedLabel:null,publisher:null,
    segments:[],links,linksTruncated,documentPages:null,needsVisualReview:true,partial:true,
    extractionMethod:"readability_no_article",sourceTextAbsent:false};
  }
  const passage=bounded(article.textContent,MAX_TEXT);
  return {kind:"html",...(processingRestricted?{processingRestricted:true}:{}),title:label(article.title)||fallbackTitle,author:label(article.byline),
   publishedLabel:label(article.publishedTime,120),publisher:label(article.siteName),
   segments:[{locator:"article_text",page:null,...passage}],links,linksTruncated,
   documentPages:null,needsVisualReview:false,partial:passage.truncated||linksTruncated,
   extractionMethod:"mozilla_readability_0.6.0",sourceTextAbsent:false};
 }finally{dom.window.close();}
}
async function parsePdf(body,pageStart,pageEnd){
 const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
 // Supply bytes, not URL. No external fonts, XFA, annotation action, links
 // or rendering/JS evaluation. Never load attachments or execute actions.
 const task=getDocument({data:Uint8Array.from(body),stopAtErrors:true,
  disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,enableXfa:false,
  disableAutoFetch:true,disableStream:true,disableRange:true,isEvalSupported:false,
  isOffscreenCanvasSupported:false,isImageDecoderSupported:false});
 try{
  const pdf=await task.promise;
  if(!Number.isSafeInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>10000||pageStart>pdf.numPages)fail("PDF_PAGE_BOUND");
  const end=Math.min(pageEnd,pdf.numPages);
  const segments=[];let remaining=MAX_TEXT,partial=pageStart>1||end<pdf.numPages,needsVisualReview=false;
  for(let pageNo=pageStart;pageNo<=end;pageNo++){
   if(remaining<=0){partial=true;break;}
   const page=await pdf.getPage(pageNo);
   const reader=page.streamTextContent().getReader();
   let raw="",truncated=false;
   try{
    while(true){
     const next=await reader.read();
     if(next.done)break;
     if(!Array.isArray(next.value?.items))fail("PDF_TEXT_INVALID");
     for(const item of next.value.items){
      if(typeof item?.str!=="string")continue;
      const piece=item.str+(item.hasEOL?"\n":" ");
      if(raw.length+piece.length>remaining){
       raw+=piece.slice(0,Math.max(0,remaining-raw.length));truncated=true;break;
      }
      raw+=piece;
     }
     if(truncated){await reader.cancel();break;}
    }
   }finally{reader.releaseLock();page.cleanup();}
   const text=clean(raw);remaining-=raw.length;
   if(!text)needsVisualReview=true;
   if(truncated)partial=true;
   segments.push({locator:"pdf_page:"+pageNo,page:pageNo,text,truncated});
  }
  return {kind:"pdf",title:null,author:null,publishedLabel:null,publisher:null,
   segments,links:[],linksTruncated:false,documentPages:pdf.numPages,
   needsVisualReview,partial:partial||needsVisualReview,extractionMethod:"pdfjs_text_6.1.200",
   sourceTextAbsent:false};
 }finally{await task.destroy();}
}
async function renderPdfPage(body,pageNumber){
 const [{getDocument},{createCanvas}]=await Promise.all([
  import("pdfjs-dist/legacy/build/pdf.mjs"),import("@napi-rs/canvas")]);
 const task=getDocument({data:Uint8Array.from(body),stopAtErrors:true,
  disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,enableXfa:false,
  disableAutoFetch:true,disableStream:true,disableRange:true,isEvalSupported:false,
  isOffscreenCanvasSupported:false,isImageDecoderSupported:false,maxImageSize:1_500_000});
 try{
  const pdf=await task.promise;
  if(!Number.isSafeInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>10000||pageNumber>pdf.numPages)fail("PDF_PAGE_BOUND");
  const page=await pdf.getPage(pageNumber);
  try{
   const natural=page.getViewport({scale:1});
   if(!Number.isFinite(natural.width)||!Number.isFinite(natural.height)||natural.width<1||natural.height<1||
     natural.width>100000||natural.height>100000)fail("PDF_VISUAL_DIMENSION_BOUND");
   const scale=Math.min(2,1400/natural.width,1400/natural.height,Math.sqrt(1_500_000/(natural.width*natural.height)));
   const viewport=page.getViewport({scale});
   const width=Math.max(1,Math.floor(viewport.width)),height=Math.max(1,Math.floor(viewport.height));
   if(width>1400||height>1400||width*height>1_500_000)fail("PDF_VISUAL_DIMENSION_BOUND");
   const canvas=createCanvas(width,height),canvasContext=canvas.getContext("2d");
   await page.render({canvas,canvasContext,viewport,annotationMode:0,background:"#ffffff"}).promise;
   const png=canvas.toBuffer("image/png");
   if(png.length<33||png.length>2_000_000)fail("PDF_VISUAL_BYTE_BOUND");
   return {pageNumber,documentPages:pdf.numPages,width,height,body:Uint8Array.from(png)};
  }finally{page.cleanup();}
 }finally{await task.destroy();}
}
async function interpret({body,contentType,finalUrl,pageStart,pageEnd,mode}){
 if(mode==="pdf_visual")return renderPdfPage(body,pageStart);
 if(contentType==="application/pdf")return parsePdf(body,pageStart,pageEnd);
 if(contentType==="text/html"||contentType==="application/xhtml+xml")return parseHtml(body,finalUrl);
 const value=bounded(new TextDecoder("utf-8",{fatal:true}).decode(body),MAX_TEXT);
 return {kind:"text",title:null,author:null,publishedLabel:null,publisher:null,
  segments:[{locator:"plain_text",page:null,...value}],links:[],linksTruncated:false,
  documentPages:null,needsVisualReview:!value.text,partial:value.truncated||!value.text,
  extractionMethod:"utf8_plain_text",sourceTextAbsent:false};
}
// No parser executes in the main thread, including during tests. Explicit
// marker prevents this entrypoint from running inside unrelated worker hosts.
if(workerData?.contract===WORK&&parentPort){
 try{const value=await interpret(workerData.input);parentPort.postMessage({ok:true,value});}
 catch{parentPort.postMessage({ok:false,code:"INTERPRETATION_UNCONFIRMED"});}
}
function runWorker(input,ms){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL(import.meta.url),{workerData:{contract:WORK,input},
   execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32,stackSizeMb:4}});
  let settled=false;
  const finish=(err,value)=>{
   if(settled)return;settled=true;clearTimeout(timer);
   worker.terminate().then(()=>err?reject(err):resolve(value),
    ()=>reject(Error("MIZIZI_DESK_PARSE_WORKER_TERMINATION_UNCONFIRMED")));
  };
  const timer=setTimeout(()=>finish(Error("MIZIZI_DESK_PARSE_DEADLINE")),ms);
  worker.once("message",message=>message?.ok===true&&message.value
   ?finish(null,message.value):finish(Error("MIZIZI_DESK_PARSE_INTERPRETATION_UNCONFIRMED")));
  worker.once("error",()=>finish(Error("MIZIZI_DESK_PARSE_WORKER_FAILED")));
  worker.once("exit",()=>finish(Error("MIZIZI_DESK_PARSE_WORKER_EXITED")));
 });
}
const scopeKeys=["jobId","caseId","workspaceId","expectedRevision","workerId","leaseExpiresAt"];
function boundScope(s,now){
 if(!s||![s.jobId,s.caseId,s.workspaceId].every(id=>typeof id==="string"&&UUID.test(id))||
  !Number.isSafeInteger(s.expectedRevision)||s.expectedRevision<1||
  typeof s.workerId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(s.workerId)||
  typeof s.leaseExpiresAt!=="string"||!Number.isFinite(Date.parse(s.leaseExpiresAt))||Date.parse(s.leaseExpiresAt)<=now)
  fail("SCOPE_DENIED");
 return Object.freeze(Object.fromEntries(scopeKeys.map(k=>[k,s[k]])));
}
/** Trusted policy authorizes exact local examination before and after parse.
 * Neither acquisition nor successful parsing implies persistence or external
 * model permission. Caller receives an untrusted bounded text projection. */
export function createDeskSourceInterpreterV1({authorize,now=Date.now}={}){
 if(typeof authorize!=="function")fail("TRUSTED_AUTHORITY_REQUIRED");
 return async({scope,receipt,pageStart=1,pageEnd=MAX_PAGES})=>{
  const started=now(),s=boundScope(scope,started);
  const lease=Date.parse(s.leaseExpiresAt);
  if(!receipt||!["mizizi.desk_native_read.v1","mizizi.desk_browser_read.v1"].includes(receipt.contract)||
    (receipt.contract==="mizizi.desk_browser_read.v1"&&
      (receipt.representation!=="rendered_dom_not_original_response"||receipt.contentType!=="text/html"||
       !SHA.test(receipt.nativeSourceSha256)||!SHA.test(receipt.nativeProjectionSha256)))||
    scopeKeys.some(k=>receipt.scope?.[k]!==s[k])||
    !MIME.has(receipt.contentType)||!(receipt.body instanceof Uint8Array)||
    !Number.isSafeInteger(receipt.byteLength)||receipt.byteLength!==receipt.body.byteLength||
    receipt.byteLength<1||receipt.byteLength>MAX_BYTES||!SHA.test(receipt.sha256)||
    receipt.sourceRetentionAuthorized!==false||receipt.externalModelProcessingAuthorized!==false||
    receipt.identityVerified!==false||typeof receipt.retrievedAt!=="string"||
    !Number.isFinite(Date.parse(receipt.retrievedAt))||Date.parse(receipt.retrievedAt)>started||
    typeof receipt.finalUrl!=="string"||safeLead(receipt.finalUrl,receipt.finalUrl)!==receipt.finalUrl)
   fail("ACQUISITION_RECEIPT_DENIED");
  const body=Uint8Array.from(receipt.body);
  if(digest(body)!==receipt.sha256)fail("ACQUISITION_DIGEST_MISMATCH");
  if(!Number.isSafeInteger(pageStart)||!Number.isSafeInteger(pageEnd)||pageStart<1||pageEnd<pageStart||pageEnd-pageStart>=MAX_PAGES||
    (receipt.contentType!=="application/pdf"&&(pageStart!==1||pageEnd!==MAX_PAGES)))fail("PAGE_BOUND");
  if(receipt.contentType==="application/pdf"&&new TextDecoder().decode(body.subarray(0,5))!=="%PDF-")fail("ACQUISITION_RECEIPT_DENIED");
  const binding=Object.freeze({finalUrl:receipt.finalUrl,sha256:receipt.sha256,byteLength:body.length,
   contentType:receipt.contentType,retrievedAt:receipt.retrievedAt,pageStart,pageEnd,
   representation:receipt.contract==="mizizi.desk_browser_read.v1"?"rendered_dom_not_original_response":"native_response_bytes",
   ...(receipt.contract==="mizizi.desk_browser_read.v1"?{nativeSourceSha256:receipt.nativeSourceSha256,
    nativeProjectionSha256:receipt.nativeProjectionSha256}:{})});
  const deadline=Math.min(lease,started+MAX_MS);
  const live=()=>{if(now()>=deadline)fail("DEADLINE");};
  if(await authorize(s,binding)!==true)fail("EXAMINATION_DENIED");
  live();
  const projection=await runWorker({body,contentType:binding.contentType,finalUrl:binding.finalUrl,pageStart,pageEnd},
   Math.max(1,deadline-now()));
  live();
  if(await authorize(s,binding)!==true)fail("EXAMINATION_REVOKED");
  live();
  const projectionText=JSON.stringify(projection);
  if(Buffer.byteLength(projectionText,"utf8")>200000)fail("PROJECTION_BOUND");
  return Object.freeze({contract:CONTRACT,scope:s,source:binding,projection,
   projectionSha256:digest(projectionText),interpretedAt:new Date(now()).toISOString(),
   identityVerified:false,sourceRetentionAuthorized:false,externalModelProcessingAuthorized:false,
   sourceContentIsUntrusted:true});
 };
}


/** Rasterize exactly one authorized local PDF page. This is a derivative
 * image, not OCR, not model analysis and never a source or disclosure grant.
 * No remote URLs or page actions. Use the same bounded parser worker.
 */
export function createDeskPdfVisualReaderV1({authorize,now=Date.now}={}){
 if(typeof authorize!=="function")fail("TRUSTED_AUTHORITY_REQUIRED");
 return async({scope,receipt,pageNumber})=>{
  const started=now(),s=boundScope(scope,started),lease=Date.parse(s.leaseExpiresAt);
  if(!receipt||receipt.contract!=="mizizi.desk_native_read.v1"||
   scopeKeys.some(k=>receipt.scope?.[k]!==s[k])||receipt.contentType!=="application/pdf"||
   !(receipt.body instanceof Uint8Array)||receipt.byteLength!==receipt.body.byteLength||
   receipt.byteLength<5||receipt.byteLength>MAX_BYTES||!SHA.test(receipt.sha256)||
   receipt.identityVerified!==false||receipt.sourceRetentionAuthorized!==false||
   receipt.externalModelProcessingAuthorized!==false||typeof receipt.retrievedAt!=="string"||
   !Number.isFinite(Date.parse(receipt.retrievedAt))||Date.parse(receipt.retrievedAt)>started||
   safeLead(receipt.finalUrl,receipt.finalUrl)!==receipt.finalUrl||
   !Number.isSafeInteger(pageNumber)||pageNumber<1||pageNumber>10000)
   fail("VISUAL_RECEIPT_DENIED");
  const body=Uint8Array.from(receipt.body);
  if(digest(body)!==receipt.sha256||new TextDecoder().decode(body.subarray(0,5))!=="%PDF-")fail("ACQUISITION_DIGEST_MISMATCH");
  const binding=Object.freeze({mode:"pdf_visual",finalUrl:receipt.finalUrl,sha256:receipt.sha256,
   byteLength:body.length,contentType:receipt.contentType,retrievedAt:receipt.retrievedAt,pageNumber});
  const deadline=Math.min(lease,started+MAX_MS);
  const live=()=>{if(now()>=deadline)fail("DEADLINE");};
  if(await authorize(s,binding)!==true)fail("VISUAL_EXAMINATION_DENIED");
  live();
  const result=await runWorker({mode:"pdf_visual",body,contentType:receipt.contentType,
   finalUrl:receipt.finalUrl,pageStart:pageNumber,pageEnd:pageNumber},Math.max(1,deadline-now()));
  live();
  if(result?.pageNumber!==pageNumber||!Number.isSafeInteger(result.documentPages)||result.documentPages<pageNumber||
    !Number.isSafeInteger(result.width)||!Number.isSafeInteger(result.height)||result.width<1||result.height<1||
    result.width>1400||result.height>1400||result.width*result.height>1_500_000||
    !(result.body instanceof Uint8Array)||result.body.length<33||result.body.length>2_000_000)
   fail("VISUAL_PROJECTION_DENIED");
  const png=Buffer.from(result.body);
  if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||
    png.subarray(12,16).toString("ascii")!=="IHDR"||
    png.readUInt32BE(16)!==result.width||png.readUInt32BE(20)!==result.height)
   fail("VISUAL_PROJECTION_DENIED");
  if(await authorize(s,binding)!==true)fail("VISUAL_EXAMINATION_REVOKED");
  live();
  return Object.freeze({contract:"mizizi.desk_pdf_visual.v1",scope:s,source:binding,
   locator:"pdf_page:"+pageNumber,pageNumber,documentPages:result.documentPages,
   contentType:"image/png",width:result.width,height:result.height,
   byteLength:png.length,sha256:digest(png),body:Uint8Array.from(png),
   interpretedAt:new Date(now()).toISOString(),identityVerified:false,
   sourceRetentionAuthorized:false,externalModelProcessingAuthorized:false,sourceContentIsUntrusted:true});
 };
}
