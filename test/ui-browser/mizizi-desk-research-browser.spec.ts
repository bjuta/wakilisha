import {test,expect} from "@playwright/test";
import {createHash} from "node:crypto";
import {withDeskInteractiveBrowserV1} from "../../scripts/registry/agents/mizizi/runtime/desk-browser-reader-v1.mjs";

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
 await withDeskInteractiveBrowserV1({browser,scope:scope(),...h},async(session:any)=>{
  const result=await session.navigate(base+"/redirect");
  expect(result.visibleText).toContain("Archive ensemble, 1974.");
 });
 expect(h.requests.map(x=>x.url)).toEqual([base+"/redirect",base+"/recording"]);
 expect(h.actions.filter(x=>x.operation==="navigate").map(x=>x.url)).toEqual([base+"/redirect",base+"/recording"]);
 const blocked=fixture();
 await expect(withDeskInteractiveBrowserV1({browser,scope:scope(),...blocked},async(session:any)=>
  session.navigate(base+"/blocked-redirect"))).rejects.toThrow();
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
