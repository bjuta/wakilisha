/**
 * Full browser acceptance against the same real local GoTrue and PostgREST
 * instance verified by the sibling operator RPC test. No fake session state,
 * network mocking, service key in browser, or hosted Supabase connection.
 */
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { readFileSync } from "node:fs";

const assert=(ok,code)=>{if(!ok)throw new Error(code);};
async function signedIn(page,base,identity){
 await page.goto(base+"/admin/login?next=%2Fadmin%2Freview%2Fmizizi",{
  waitUntil:"domcontentloaded",timeout:45000,
 });
 await page.getByRole("textbox",{name:"Admin email"}).fill(identity.email,{timeout:30000});
 await page.getByRole("textbox",{name:"Password"}).fill(identity.password,{timeout:30000});
 await page.getByRole("button",{name:"Enter Admin Studio"}).click();
 await page.locator("[data-wk-mizizi-durable-cases]").waitFor({
  state:"visible",timeout:45000,
 });
 await page.getByRole("button",{name:"Export Redacted Audit"}).waitFor({
  state:"visible",timeout:30000,
 });
 const text=await page.locator("[data-wk-mizizi-durable-cases]").innerText();
 assert(!text.includes("No authorized internal Headquarters case view"),
  "STOP_BROWSER_OPERATOR_ACCESS_DENIED");
 assert(text.includes("Recorded Cases"),"STOP_BROWSER_CASES_PANEL_NOT_RENDERED");
}
async function assertDownload(page,caseId,personId){
 const [download]=await Promise.all([
  page.waitForEvent("download",{timeout:45000}),
  page.getByRole("button",{name:"Export Redacted Audit"}).click(),
 ]);
 assert(/^wakilisha-mizizi-audit-redacted-\d{4}-\d{2}-\d{2}\.json$/.test(
  download.suggestedFilename()),"STOP_BROWSER_AUDIT_FILENAME_DRIFT");
 const file=await download.path();
 assert(typeof file==="string"&&file.length>0,"STOP_BROWSER_AUDIT_BYTES_UNAVAILABLE");
 const payload=readFileSync(file,"utf8");
 const report=JSON.parse(payload);
 assert(report.format==="wakilisha.mizizi.headquarters.redacted-audit.v1"&&
  report.caseCount===1&&report.cases?.[0]?.caseId===caseId&&
  report.cases[0].caseRevision===2&&
  report.cases[0].events?.length===2&&
  report.cases[0].events?.[0]?.actorClass==="operator"&&
  report.cases[0].linkedReceiptCount>=1,
  "STOP_BROWSER_AUDIT_DOES_NOT_MATCH_ACTUAL_DB02_JOURNAL");
 assert(report.consistency.includes("not_a_database_transaction_snapshot")&&
  report.receipts.includes("linked_counts_only"),
  "STOP_BROWSER_AUDIT_OVERSTATES_RECEIPT_OR_SNAPSHOT_AUTHORITY");
 assert(!payload.includes(personId)&&
  !payload.includes("Review verified disposable evidence")&&
  !payload.includes("Genuine signed-in operator")&&
  !payload.includes("wk-ci-research:"),
  "STOP_BROWSER_AUDIT_PII_OR_REASON_LEAK");
 return report;
}
async function mobileOverflow(page){
 const metrics=await page.evaluate(()=>({
  width:document.documentElement.clientWidth,
  full:document.documentElement.scrollWidth,
  panel:document.querySelector("[data-wk-mizizi-durable-cases]")?.getBoundingClientRect().width,
 }));
 assert(metrics.full<=metrics.width+3&&metrics.panel>0,
  "STOP_BROWSER_MOBILE_HEADQUARTERS_HORIZONTAL_OVERFLOW");
}
export async function verifyLocalHeadquartersBrowsersV1({
 api,anonKey,first,second,caseId,
}){
 assert(process.env.GITHUB_ACTIONS==="true"&&
  process.env.GITHUB_EVENT_NAME==="pull_request"&&
  api==="http://127.0.0.1:54321"&&anonKey&&
  first?.email&&first?.password&&second?.email&&second?.password&&caseId,
  "STOP_BROWSER_DISPOSABLE_AUTH_CONTEXT_UNVERIFIED");
 process.env.VITE_PUBLIC_SUPABASE_URL=api;
 process.env.VITE_PUBLIC_SUPABASE_ANON_KEY=anonKey;
 const server=await createServer({
  server:{host:"127.0.0.1",port:0,strictPort:false},
  logLevel:"error",
 });
 let browser;
 try{
  await server.listen();
  const address=server.httpServer?.address();
  assert(address&&typeof address!=="string"&&address.port>0,
   "STOP_BROWSER_VITE_NOT_BOUND_TO_LOOPBACK");
  const base="http://127.0.0.1:"+address.port;
  browser=await chromium.launch({headless:true});
  const desktop=await browser.newContext({acceptDownloads:true,
   viewport:{width:1440,height:900}});
  const mobile=await browser.newContext({acceptDownloads:true,
   viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  try{
   const desk=await desktop.newPage(),phone=await mobile.newPage();
   await signedIn(desk,base,first);
   await signedIn(phone,base,second);
   await desk.getByRole("button",{name:"View Recorded Case Journal"}).click();
   const journal=desk.getByRole("region",{name:"Immutable case event timeline"});
   // Component is a section with aria-label, not necessarily a region under all browsers.
   const actual=desk.locator('section[aria-label="Immutable case event timeline"]');
   await actual.getByText("Revision 2").waitFor({timeout:30000});
   await actual.getByText("Revision 1").waitFor({timeout:30000});
   await phone.locator("[data-wk-mizizi-durable-cases]").getByText(
    "Revision 2",{exact:false}).first().waitFor({timeout:30000});
   console.log("WK_BROWSER_TWO_REAL_LOGIN_DESKTOP_MOBILE_DB02_JOURNAL=PASS");
   await mobileOverflow(phone);
   console.log("WK_BROWSER_MOBILE_390PX_NO_DOCUMENT_OVERFLOW=PASS");
   const before=await assertDownload(desk,caseId,first.id);
   assert(before.holdCount>=1,
    "STOP_BROWSER_REDACTED_AUDIT_MISSING_PREVIOUS_HOLD");
   console.log("WK_BROWSER_DESKTOP_AUTHENTICATED_REDACTED_AUDIT_DOWNLOAD=PASS");

   const holdText="Browser-confirmed temporary local-only review hold for Headquarters.";
   await desk.getByRole("textbox",{name:"Hold Writes Reason"}).fill(holdText);
   await desk.getByRole("button",{name:"Start Workspace Hold Writes"}).click();
   await desk.getByText("Workspace Hold Writes is active.").waitFor({timeout:30000});
   await phone.getByRole("button",{name:"Refresh Records"}).click();
   await phone.locator("[data-wk-mizizi-durable-cases]").getByText(
    "Active: mizizi:workspace:hold:",{exact:false}).waitFor({timeout:30000});
   await phone.getByRole("textbox",{name:"Hold Writes Reason"}).fill(
    "Competing signed-in mobile operator reviewed the bounded release.");
   await phone.getByRole("button",{name:"Release This Hold"}).click();
   await phone.getByText("The selected workspace hold was released.").waitFor({
    timeout:30000,
   });
   await desk.getByRole("button",{name:"Refresh Records"}).click();
   const after=await assertDownload(phone,caseId,second.id);
   assert(after.holdCount===before.holdCount+1&&
    after.holds.filter(h=>h.status==="released").length===after.holdCount,
    "STOP_BROWSER_HOLD_WRITE_RELEASE_AUDIT_NOT_CONSISTENT");
   assert(!JSON.stringify(after).includes(holdText),
    "STOP_BROWSER_HOLD_REASON_LEAKED_IN_AUDIT");
   console.log("WK_BROWSER_REAL_UI_DESKTOP_HOLD_MOBILE_RELEASE=PASS");
   console.log("WK_BROWSER_MOBILE_AUTHENTICATED_REDACTED_AUDIT_DOWNLOAD=PASS");
  }finally{
   await Promise.allSettled([desktop.close(),mobile.close()]);
  }
 }finally{
  if(browser)await browser.close();
  await server.close();
 }
}
