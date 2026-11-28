import {test,expect} from "@playwright/test";
import {createHash,randomUUID} from "node:crypto";
import {createDeskAnthropicPassV1,createDurableDeskModelAuthorityV1,type DeskAnthropicOptionsV1,type DeskToolResultV1} from "../../scripts/registry/agents/mizizi/runtime/desk-anthropic-tool-loop-v1";
import {withDeskInteractiveBrowserV1,createDeskBrowserActionRouterV1,createDurableLocalDeskBrowserV1} from "../../scripts/registry/agents/mizizi/runtime/desk-browser-reader-v1.mjs";

// Real Chromium, fully synthetic public archive, no provider calls. The
// trusted acquisition fixture fulfills routes without external networking.
const sha=(value:Uint8Array|string)=>createHash("sha256").update(value).digest("hex");
const base="https://archive.org";
const start=base+"/catalogue";
const scope=()=>({jobId:"11111111-1111-4111-8111-111111111111",
 caseId:"22222222-2222-4222-8222-222222222222",workspaceId:"33333333-3333-4333-8333-333333333333",
 expectedRevision:1,workerId:"mizizi-browser-fixture",leaseExpiresAt:new Date(Date.now()+120000).toISOString()});
const catalogue="<html><head><title>Archive catalogue</title></head><body><main><h1>Music archive</h1>"+
 "<button aria-expanded='false' onclick=\"this.setAttribute('aria-expanded','true'); document.getElementById('credit').hidden=false\">Reveal credits</button>"+
 "<p id='credit' hidden>Recorded at the Nairobi studio, 1974.</p>"+
 "<details><summary>Programme notes</summary><p>Session personnel: archive ensemble.</p></details>"+
 "<a href='/recording'>Recording page</a><form method='get' action='/search'><input type='search' name='q' aria-label='Search catalogue'></form>"+
 "</main></body></html>";
type Binding={operation?:string;url?:string;target?:string;query?:string;resourceType?:string};
function fixture(){
 const actions:Binding[]=[],requests:Binding[]=[];
 const resource=async(binding:Binding,requestSha256:string)=>{
  requests.push(binding);
  let html:string;
  if(binding.url===start)html=catalogue;
  else if(binding.url===base+"/recording")html="<html><body><h1>Recording credits</h1><p>Archive ensemble, 1974.</p></body></html>";
  else if(binding.url===base+"/search?q=Nairobi+1974")html="<html><body><h1>Search results</h1><a href='/recording'>Archive ensemble</a></body></html>";
  else if(binding.url===base+"/redirect")return {requestSha256,status:302,location:"/recording"};
  else if(binding.url===base+"/blocked-redirect")return {requestSha256,status:302,location:"https://unapproved.org/private"};
  else return null;
  const body=new TextEncoder().encode(html);
  return {requestSha256,status:200,contentType:"text/html",body,sha256:sha(body)};
 };
 return {actions,requests,authorizeAction:async(binding:Binding)=>{actions.push(binding);return true;},
  authorizeRequest:async(binding:Binding)=>binding.url?.startsWith(base+"/")===true,readResource:resource};
}
test("MIZIZI real Chromium reveals dynamic evidence, searches, follows references, scrolls and captures a visual",async({browser})=>{
 const h=fixture();
 const result=await withDeskInteractiveBrowserV1({browser,scope:scope(),...h},async(session:any)=>{
  let observation=await session.navigate(start);
  expect(observation.visibleText).not.toContain("Nairobi studio");
  expect(observation.accessibility).toContain("Reveal credits");
  const expand=observation.elements.find((e:any)=>e.kind==="expand"&&e.label==="Reveal credits");
  expect(expand).toBeTruthy();
  const stale=observation;
  observation=await session.expand(expand.ref,observation.generation);
  expect(observation.visibleText).toContain("Recorded at the Nairobi studio, 1974.");
  await expect(session.expand(expand.ref,stale.generation)).rejects.toThrow("STALE_REFERENCE");
  const notes=observation.elements.find((e:any)=>e.kind==="expand"&&e.label==="Programme notes");
  observation=await session.expand(notes.ref,observation.generation);
  expect(observation.visibleText).toContain("Session personnel: archive ensemble.");
  observation=await session.scroll("down");
  const search=observation.elements.find((e:any)=>e.kind==="search");
  expect(search).toBeTruthy();
  observation=await session.search(search.ref,observation.generation,"Nairobi 1974");
  expect(observation.visibleText).toContain("Search results");
  const link=observation.elements.find((e:any)=>e.kind==="link");
  observation=await session.follow(link.ref,observation.generation);
  expect(observation.visibleText).toContain("Archive ensemble, 1974.");
  return session.capture({visual:true});
 });
 expect(result).toMatchObject({finalUrl:base+"/recording",identityVerified:false,sourceRetentionAuthorized:false,externalModelProcessingAuthorized:false});
 expect(result.sha256).toBe(sha(result.body));
 expect(result.visual.sha256).toBe(sha(result.visual.body));
 expect(result.resourceBindings.map((x:any)=>x.url)).toEqual([start,base+"/search?q=Nairobi+1974",base+"/recording"]);
 expect(h.actions.some(x=>x.operation==="search"&&x.query==="Nairobi 1974")).toBe(true);
 expect(h.requests.every(x=>x.url?.startsWith(base+"/"))).toBe(true);
});
test("MIZIZI authorizes redirect hops independently and blocks unauthorized acquisition before the fetch",async({browser})=>{
 const h=fixture();
 const capture=await withDeskInteractiveBrowserV1({browser,scope:scope(),...h},async(session:any)=>{
  const result=await session.navigate(base+"/redirect");
  expect(result.visibleText).toContain("Archive ensemble, 1974.");
  return session.capture();
 });
 expect(capture.resourceBindings.map((x:any)=>x.url)).toEqual([base+"/recording"]);
 expect(capture.redirectBindings).toMatchObject([{from:base+"/redirect",to:base+"/recording",status:302}]);
 expect(h.requests.map(x=>x.url)).toEqual([base+"/redirect",base+"/recording"]);
 expect(h.actions.filter(x=>x.operation==="navigate").map(x=>x.url)).toEqual([base+"/redirect",base+"/recording"]);
 const blocked=fixture();
 await withDeskInteractiveBrowserV1({browser,scope:scope(),...blocked},async(session:any)=>{
  await expect(session.navigate(base+"/blocked-redirect")).rejects.toThrow();
  await expect(session.observe()).rejects.toThrow("INTERACTIVE_NAVIGATION_UNCONFIRMED");
  await expect(session.capture()).rejects.toThrow("INTERACTIVE_CAPTURE_DENIED");
 });
 expect(blocked.requests.map(x=>x.url)).toEqual([base+"/blocked-redirect"]);
 const denied=fixture();
 await expect(withDeskInteractiveBrowserV1({browser,scope:scope(),...denied,
  authorizeAction:async(binding:Binding)=>binding.operation!=="navigate"},async(session:any)=>
  session.navigate(start))).rejects.toThrow("INTERACTIVE_ACTION_DENIED");
 expect(denied.requests).toEqual([]);
});
test("MIZIZI rejects tampered resource bytes and denies search disclosure without sending the query",async({browser})=>{
 const h=fixture();
 await expect(withDeskInteractiveBrowserV1({browser,scope:scope(),...h,readResource:async(b:Binding,d:string)=>{
  const result=await h.readResource(b,d);return {...result,sha256:"0".repeat(64)};
 }},async(session:any)=>session.navigate(start))).rejects.toThrow();
 const q=fixture();
 await withDeskInteractiveBrowserV1({browser,scope:scope(),...q,
  authorizeAction:async(binding:Binding)=>binding.operation!=="search"},async(session:any)=>{
  const obs=await session.navigate(start);
  const search=obs.elements.find((x:any)=>x.kind==="search");
  await expect(session.search(search.ref,obs.generation,"private information")).rejects.toThrow("INTERACTIVE_ACTION_DENIED");
 });
 expect(q.requests.map(x=>x.url)).toEqual([start]);
});


test("MIZIZI actual tool transcript controls a single Chromium session and receives admitted dynamic and visual evidence",async({browser})=>{
 const h=fixture(),s=scope(),leadId=randomUUID(),searchReceiptId=randomUUID();
 const identity={caseId:s.caseId,workspaceId:s.workspaceId,openingQuestion:"Which archive documents the original recording session?"};
 const stored=new Map<string,{receiptId:string;callSha256:string;resultSha256:string;resultText:string}>();
 const store=(callSha256:string,result:DeskToolResultV1)=>{
  const resultText=JSON.stringify({receiptId:result.receiptId,leads:result.leads,sources:result.sources,
   visual:result.visual?{sourceId:result.visual.sourceId,sha256:result.visual.sha256,contentType:result.visual.contentType}:null});
  stored.set(result.receiptId,{receiptId:result.receiptId,callSha256,resultSha256:sha(resultText),resultText});
  return result;
 };
 // This fixture exercises the real serialized-envelope reconstruction and
 // tool dispatcher interface with a disposable in-memory authority. It is
 // not a live Anthropic request or a durable database grant.
 const rpc=async(fn:string,args:Record<string,unknown>)=>{
  if(fn==="mizizi_read_desk_tool_receipt_v1")return {data:stored.get(String(args.p_receipt_id))??null,error:null};
  if(fn==="mizizi_authorize_desk_model_operation_v1")return {data:{operation:args.p_operation,
   bindingSha256:args.p_binding_sha256,policyRef:"fixture:independent-browser-authority",
   validUntil:s.leaseExpiresAt,allowed:true},error:null};
  throw Error("UNEXPECTED_FIXTURE_RPC");
 };
 const envelopes:string[]=[];
 const model="fixture-haiku";
 const payload=(name:string,input:Record<string,unknown>,n:number)=>({model,stop_reason:"tool_use",
  usage:{input_tokens:500,output_tokens:100},content:[{type:"tool_use",id:"tool_"+n,name,input}]});
 const response=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"content-type":"application/json"}});
 const lifecycle:string[]=[];const accountFingerprint=sha("fixture local allocation");
 let reserved:any=null,sessionId:string|null=null,opened=false;
 const router=createDurableLocalDeskBrowserV1({scope:s,...h,
  host:{accountFingerprint,
   authorizeHost:async(_:unknown,digest:string)=>({requestSha256:digest,policyRef:"fixture:local-host",
    validUntil:s.leaseExpiresAt,egressIsolationVerified:true,localCapacityVerified:true,zeroIncrementalSpendAllowed:true}),
   open:async(_:unknown,id:string)=>{expect(lifecycle).toEqual(["reserve","consume","open_pending"]);sessionId=id;lifecycle.push("host_open");return browser;},
   close:async(id:string)=>{expect(id).toBe(sessionId);expect(browser.contexts()).toHaveLength(0);lifecycle.push("host_close");return true;}},
  finance:{reserve:async(b:any,digest:string)=>{expect(sha(JSON.stringify(b))).toBe(digest);lifecycle.push("reserve");
    reserved={reservationId:randomUUID(),requestSha256:digest,provider:"local_chromium",seconds:120,maximumIncrementalCostMicrousd:0,validUntil:s.leaseExpiresAt};return reserved;},
   consume:async(r:any)=>{expect(r).toEqual(reserved);lifecycle.push("consume");return true;},
   recordLifecycle:async(e:any)=>{lifecycle.push(e.state);if(e.state==="opened")opened=true;if(e.state==="close_acknowledged")opened=false;},
   readSession:async()=>opened?{scope:s,resource:"local_chromium",accountFingerprint,reservationId:reserved.reservationId,
    requestSha256:reserved.requestSha256,sessionId,validUntil:s.leaseExpiresAt}:null},
  routerOptions:()=>({visualAllowed:true,
   resolveReference:async(candidate:any,id:string)=>candidate.caseId===s.caseId&&id===leadId&&stored.has(searchReceiptId)?
    {id,kind:"reference",receiptId:searchReceiptId,url:start}:null,
   authorizeCall:async(candidate:any,call:any,digest:string)=>candidate.caseId===s.caseId&&sha(JSON.stringify({scope:candidate,call}))===digest,
   authorizeQuery:async()=>false,
   admitObservation:async(binding:any)=>{
    const {receiptId,capture,observation,leads,callSha256,action}=binding;
    expect(sha(capture.body)).toBe(capture.sha256);
    // Synthetic fixture only: extract the known dynamically revealed text
    // from actual Chromium DOM, not from the mock model or supplied query.
    const html=new TextDecoder().decode(capture.body);
    const expanded=html.includes("aria-expanded=\"true\"");
    expect(sha(capture.visibleText)).toBe(capture.visibleTextSha256);
    if(expanded)expect(capture.visibleText).toContain("Nairobi studio");else expect(capture.visibleText).not.toContain("Nairobi studio");
    const excerpt=action==="visual"?"Visual derivative for examination; no textual claim is verified.":
     expanded&&html.includes("Recorded at the Nairobi studio, 1974.")?
     "Recorded at the Nairobi studio, 1974.":"Archive catalogue; credits not yet revealed.";
    expect(observation.url).toBe(capture.finalUrl);
    const source={sourceId:receiptId,caseId:s.caseId,workspaceId:s.workspaceId,
     originKey:"fixture:archive-origin",lineageKey:"fixture:archive-lineage",fingerprint:capture.sha256,
     authorityRef:"fixture:reviewed-source-use",useBasis:"documented_contract" as const,
     observedAt:new Date().toISOString(),expiresAt:s.leaseExpiresAt,revokedAt:null,
     privateResearchAllowed:true,externalModelProcessingAllowed:true,privateEvidenceRetentionAllowed:true};
    return store(callSha256,{receiptId,leads,sources:[{source,excerpt,citation:capture.finalUrl+"#rendered"}],
     ...(capture.visual?{visual:{sourceId:receiptId,body:capture.visual.body,sha256:capture.visual.sha256,
      contentType:"image/png" as const}}:{})});
   }})});
  const authorizeEnvelope:DeskAnthropicOptionsV1["authorizeEnvelope"]=async(b,body)=>{
   expect(sha(body)).toBe(b.bodySha256);return {requestSha256:b.requestSha256,policyRef:"fixture:host-disclosure",
    validUntil:s.leaseExpiresAt,modelDisclosureAllowed:true};
  };
  const modelAuthority=createDurableDeskModelAuthorityV1({scope:s,rpc,authorizeEnvelope,authorizeTool:async()=>true});
  const transport=async(_url:string,init?:RequestInit)=>{
   const raw=String(init?.body);envelopes.push(raw);
   const packet=JSON.parse(raw),n=envelopes.length;
   if(n===1)return response(payload("search_web",{query:"Nairobi archive catalogue"},n));
   const last=packet.messages.at(-1).content[0].content;
   const result=JSON.parse(last[0].text);
   if(n===2)return response(payload("browse_page",{lead_id:result.leads[0].id,query:""},n));
   if(n===3){
    expect(result.sources[0].excerpt).not.toContain("Nairobi studio");
    const expand=result.leads.find((x:any)=>x.kind==="browser_action"&&x.label==="Expand: Reveal credits");
    expect(expand).toBeTruthy();
    return response(payload("browse_page",{lead_id:expand.id,query:""},n));
   }
   if(n===4){
    expect(result.sources[0].excerpt).toContain("Recorded at the Nairobi studio, 1974.");
    const visual=result.leads.find((x:any)=>x.kind==="visual");
    expect(visual).toBeTruthy();
    return response(payload("inspect_visual",{lead_id:visual.id,page:1},n));
   }
   expect(n).toBe(5);expect(last[1].type).toBe("image");
   expect(sha(Buffer.from(last[1].source.data,"base64"))).toBe(result.visualSha256);
   return response({model,stop_reason:"end_turn",usage:{input_tokens:600,output_tokens:150},
    content:[{type:"text",text:JSON.stringify({hypotheses:[],leads:[],
     passFinding:"The archive has dynamically revealed session credits.",requestedDisposition:"pause"})}]});
  };
  const executeTool:DeskAnthropicOptionsV1["executeTool"]=async(candidate,call,digest)=>{
   if(call.name==="search_web"){expect(lifecycle).toEqual([]);return store(digest,{receiptId:searchReceiptId,leads:[{id:leadId,kind:"reference",label:"Archive catalogue"}],sources:[]});}
   return router.execute(candidate,call,digest);
  };
  let pass;
  try{pass=await createDeskAnthropicPassV1({scope:s,anthropic:{model,apiKey:"fixture-not-a-real-key",transport:transport as typeof fetch},
   enabledTools:["search_web","browse_page","inspect_visual"],...modelAuthority,
   quote:async b=>({requestSha256:b.requestSha256,pricingRef:"fixture:reviewed-rate",maxInputTokens:10000,maxOutputTokens:2500,maximumCostMicrousd:1000,validUntil:s.leaseExpiresAt}),
   reserve:async(b,q)=>({reservationId:randomUUID(),requestSha256:b.requestSha256,pricingRef:q.pricingRef,maximumCostMicrousd:q.maximumCostMicrousd,validUntil:s.leaseExpiresAt}),
   consume:async()=>true,recordModelEvent:async()=>{},executeTool,
   verifyToolReceipt:async(_scope,binding,result)=>stored.get(result.receiptId)?.callSha256===binding.callSha256&&
    stored.get(result.receiptId)?.resultSha256===binding.resultSha256,
   authorizeSource:async()=>true})(identity,identity.openingQuestion,[]);}
  finally{await router.close();}
 expect(lifecycle).toEqual(["reserve","consume","open_pending","host_open","opened","host_close","close_acknowledged"]);
 expect(pass.deskToolReceipts).toHaveLength(4);
 expect(pass.sources.some(x=>x.excerpt.includes("Nairobi studio"))).toBe(true);
 expect(pass.costUnits).toBe(5);
 expect(envelopes).toHaveLength(5);
 expect(h.requests.map(x=>x.url)).toEqual([start]);
 expect(h.actions.some(x=>x.operation==="expand")).toBe(true);
 expect(h.actions.some(x=>x.operation==="capture")).toBe(true);
 expect(envelopes.every(body=>!body.includes("fixture-not-a-real-key"))).toBe(true);
 expect(browser.contexts()).toHaveLength(0);
});
test("MIZIZI browser action router refuses invented/stale IDs and unapproved search before acquisition",async({browser})=>{
 const h=fixture(),s=scope(),leadId=randomUUID();
 await withDeskInteractiveBrowserV1({browser,scope:s,...h},async(session:any)=>{
  const router=createDeskBrowserActionRouterV1({scope:s,session,
   resolveReference:async(_:unknown,id:string)=>id===leadId?{id,kind:"reference",receiptId:randomUUID(),url:start}:null,
   authorizeCall:async()=>true,authorizeQuery:async()=>false,authorizeContentLabels:async()=>false,
   admitObservation:async(b:any)=>({receiptId:b.receiptId,leads:b.leads,sources:[]})});
  const execute=(id:string,query="")=>{
   const call={name:"browse_page",input:{lead_id:id,query}};
   return router.execute(s,call,sha(JSON.stringify({scope:s,call})));
  };
  await expect(execute(randomUUID())).rejects.toThrow("ACTION_ROUTER_LEAD_DENIED");
  const first=await execute(leadId);
  const search=first.leads.find((l:any)=>l.label==="Search public page");
  const expand=first.leads.find((l:any)=>l.label==="Expand public section");
  expect(search).toBeDefined();expect(expand).toBeDefined();
  expect(JSON.stringify(first)).not.toContain("Reveal credits");
  expect(first.sources).toEqual([]);
  await expect(execute(search.id,"private information")).rejects.toThrow("ACTION_ROUTER_QUERY_DENIED");
  await execute(expand.id);
  await expect(execute(search.id)).rejects.toThrow("ACTION_ROUTER_STALE_LEAD");
 });
 expect(h.requests.map(x=>x.url)).toEqual([start]);
});
