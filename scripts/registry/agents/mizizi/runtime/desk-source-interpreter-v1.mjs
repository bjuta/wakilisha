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
async function parseHtml(body,url){
 const [{JSDOM},{Readability}]=await Promise.all([import("jsdom"),import("@mozilla/readability")]);
 // Never enable runScripts or resources. No browsing context with network
 // access, no remote base URL resolution, no HTML returned to the caller.
 const html=new TextDecoder("utf-8",{fatal:true}).decode(body);
 const dom=new JSDOM(html,{url,contentType:"text/html"});
 try{
  const doc=dom.window.document;
  if(doc.querySelectorAll("*").length>MAX_DOM_NODES)fail("DOM_BUDGET");
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
   return {kind:"html",title:fallbackTitle,author:null,publishedLabel:null,publisher:null,
    segments:[],links,linksTruncated,documentPages:null,needsVisualReview:true,partial:true,
    extractionMethod:"readability_no_article",sourceTextAbsent:false};
  }
  const passage=bounded(article.textContent,MAX_TEXT);
  return {kind:"html",title:label(article.title)||fallbackTitle,author:label(article.byline),
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
async function interpret({body,contentType,finalUrl,pageStart,pageEnd}){
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
  if(!receipt||receipt.contract!=="mizizi.desk_native_read.v1"||
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
   contentType:receipt.contentType,retrievedAt:receipt.retrievedAt,pageStart,pageEnd});
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
