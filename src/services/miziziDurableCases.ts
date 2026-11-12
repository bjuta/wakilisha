/** Authenticated Headquarters case/hold interface. Never reads private SQL tables. */
import { supabase } from "@/lib/supabase";

const MAX_CASE_PAGES=50;
const CASE_PAGE_SIZE=100;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export type HeadquartersDurableCase = Readonly<{
  caseId: string;
  workspaceId: string;
  caseRevision: number;
  subjectType: string;
  subjectId: string;
  claimFamily: string;
  claimKey: string;
  state: string;
  stage: string;
  riskClass: string;
  reviewId: string | null;
  receiptCount: number;
  updatedAt: string;
  nextActionAt: string | null;
}>;
/** A deliberately bounded, read-only machine representation of the same
 * authorized case projection shown in Headquarters. This is NOT an API,
 * evidence adjudication, publication decision, or operation grant.
 */
export function projectHeadquartersCaseMachineReadV1(row: HeadquartersDurableCase) {
  return Object.freeze({
    schemaVersion: "wakilisha.mizizi.headquarters.case-read.v1",
    objectType: "investigation_case",
    caseId: row.caseId,
    revision: row.caseRevision,
    subject: Object.freeze({type: row.subjectType, id: row.subjectId}),
    claim: Object.freeze({family: row.claimFamily, key: row.claimKey}),
    lifecycle: Object.freeze({state: row.state, stage: row.stage}),
    evidenceReferences: Object.freeze({
      linkedRegistryReviewId: row.reviewId,
      linkedReceiptCount: row.receiptCount,
    }),
    updatedAt: row.updatedAt,
    actionAuthority: "not_included_in_read_only_projection",
    publicationAuthority: "not_included_in_read_only_projection",
  });
}

export type HeadquartersHold = Readonly<{
  holdId: string;
  holdKey: string;
  scopeKind: "global" | "workspace" | "operation";
  status: "active" | "released";
  revision: number;
  reason: string;
  heldAt: string;
  releasedAt: string | null;
}>;

export type HeadquartersCaseEvent = Readonly<{
  eventId: string;
  revision: number;
  type: "case_created" | "case_state_changed";
  previousState: string | null;
  state: string;
  previousStage: string | null;
  stage: string;
  reason: string;
  actorKey: string;
  recordedAt: string;
}>;
export type HeadquartersRpcResult = Readonly<{ data: unknown; error: { message: string; code?: string | null } | null }>;
/** Only an explicit database authorization denial may offer first-owner setup. */
export class HeadquartersAuthorizationDeniedError extends Error {
  constructor() {
    super("Headquarters authorization denied (42501)");
    this.name="HeadquartersAuthorizationDeniedError";
  }
}
export type HeadquartersRpc = (functionName: string, args: Record<string, unknown>) => Promise<HeadquartersRpcResult>;
const directRpc: HeadquartersRpc = async (functionName,args) => {
  const result = await supabase.rpc(functionName,args);
  return {data:result.data,error:result.error};
};
function obj(value: unknown): Record<string,unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid recorded Headquarters result");
  return value as Record<string,unknown>;
}
function str(v:unknown):string {if(typeof v!=="string"||!v.trim())throw new TypeError("Invalid Headquarters field");return v;}
function uuid(v:unknown):string {const s=str(v);if(!UUID.test(s))throw new TypeError("Invalid Headquarters identity");return s.toLowerCase();}
function revision(v:unknown):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1)throw new TypeError("Invalid Headquarters revision");return Number(v);}
function date(v:unknown):string{const s=str(v);if(!Number.isFinite(Date.parse(s)))throw new TypeError("Invalid Headquarters time");return s;}
function maybeDate(v:unknown):string|null{return v===null?null:date(v);}
async function call(rpc:HeadquartersRpc,name:string,args:Record<string,unknown>):Promise<unknown>{
  const r=await rpc(name,args);
  if(r.error?.code==="42501")throw new HeadquartersAuthorizationDeniedError();
  if(r.error)throw new Error(`Headquarters command unavailable: ${r.error.message}`);
  return r.data;
}
function list(v:unknown):unknown[]{if(!Array.isArray(v))throw new TypeError("Invalid Headquarters collection");return v;}
export function projectDurableCasesV1(raw:unknown):readonly HeadquartersDurableCase[]{
  const seen=new Set<string>();
  return list(raw).map(v=>{
    const r=obj(v),caseId=uuid(r.caseId),workspaceId=uuid(r.workspaceId),subjectId=uuid(r.subjectId);
    if(seen.has(caseId))throw new TypeError("Duplicate Headquarters case in page");seen.add(caseId);
    if(typeof r.receiptCount!=="number"||!Number.isSafeInteger(r.receiptCount)||r.receiptCount<0)throw new TypeError("Invalid case receipt count");
    const result:HeadquartersDurableCase={
      caseId,workspaceId,subjectId,caseRevision:revision(r.caseRevision),
      subjectType:str(r.subjectType),claimFamily:str(r.claimFamily),claimKey:str(r.claimKey),
      state:str(r.state),stage:str(r.stage),riskClass:str(r.riskClass),
      reviewId:r.reviewId===null?null:uuid(r.reviewId),receiptCount:Number(r.receiptCount),
      updatedAt:date(r.updatedAt),nextActionAt:maybeDate(r.nextActionAt),
    };
    return Object.freeze(result);
  });
}
export async function loadDurableHeadquartersCasesV1(rpc:HeadquartersRpc=directRpc):Promise<readonly HeadquartersDurableCase[]>{
  const cases: HeadquartersDurableCase[] = [];
  const seen=new Set<string>();
  let beforeTimestamp:string|null=null, beforeId:string|null=null;
  for(let page=0;page<MAX_CASE_PAGES;page++){
    const batch=projectDurableCasesV1(await call(rpc,"admin_mizizi_cases_v1",{
      p_limit:CASE_PAGE_SIZE,p_before_updated_at:beforeTimestamp,p_before_case_id:beforeId,
    }));
    for(const item of batch){
      if(seen.has(item.caseId))throw new TypeError("Repeated Headquarters case across pages");
      if(beforeTimestamp !== null && (
        item.updatedAt > beforeTimestamp ||
        (item.updatedAt === beforeTimestamp && item.caseId >= beforeId!)
      ))throw new TypeError("Headquarters pagination lost recorded ordering");
      seen.add(item.caseId);cases.push(item);
      beforeTimestamp=item.updatedAt;beforeId=item.caseId;
    }
    if(batch.length<CASE_PAGE_SIZE)return Object.freeze(cases);
  }
  throw new RangeError("Headquarters case snapshot exceeds safe page limit");
}
export function projectHeadquartersCaseEventsV1(raw:unknown):readonly HeadquartersCaseEvent[]{
  let lastRevision=Number.POSITIVE_INFINITY;
  const seen=new Set<string>();
  return Object.freeze(list(raw).map(value=>{
    const r=obj(value),eventId=uuid(r.eventId),currentRevision=revision(r.revision);
    const eventType=r.type;
    if(seen.has(eventId)||currentRevision>=lastRevision ||
      (eventType!=="case_created"&&eventType!=="case_state_changed"))
      throw new TypeError("Invalid immutable Headquarters case timeline");
    seen.add(eventId);lastRevision=currentRevision;
    const state=str(r.state),stage=str(r.stage);
    const previousState=r.previousState===null?null:str(r.previousState);
    const previousStage=r.previousStage===null?null:str(r.previousStage);
    if((eventType==="case_created") !== (previousState===null && previousStage===null))
      throw new TypeError("Headquarters journal creation state disagrees");
    return Object.freeze({eventId,revision:currentRevision,type:eventType,
      previousState,state,previousStage,stage,reason:str(r.reason),
      actorKey:str(r.actorKey),recordedAt:date(r.recordedAt)} as HeadquartersCaseEvent);
  }));
}
export async function loadHeadquartersCaseEventsV1(caseId:string,rpc:HeadquartersRpc=directRpc):Promise<readonly HeadquartersCaseEvent[]>{
  return projectHeadquartersCaseEventsV1(await call(rpc,"admin_mizizi_case_events_v1",{
    p_case_id:uuid(caseId),p_limit:100,
  }));
}
export async function beginMiziziCaseResearchV1(
  input:Readonly<{caseId:string;expectedRevision:number;reason:string}>,rpc:HeadquartersRpc=directRpc,
):Promise<Readonly<{caseId:string;revision:number;stage:"research"}>>{
  const caseId=uuid(input.caseId),expectedRevision=revision(input.expectedRevision);
  const reason=input.reason?.trim();
  if(typeof reason!=="string"||reason.length<12||reason.length>1000)throw new TypeError("Provide a specific research reason");
  const r=obj(await call(rpc,"admin_mizizi_begin_case_research_v1",{
    p_case_id:caseId,p_expected_revision:expectedRevision,p_reason:reason,
  }));
  if(uuid(r.caseId)!==caseId||revision(r.revision)!==expectedRevision+1||
    r.stage!=="research"||r.state!=="in_progress"||!UUID.test(str(r.workspaceId)))
    throw new TypeError("Headquarters transition receipt does not match the requested case");
  return Object.freeze({caseId,revision:expectedRevision+1,stage:"research" as const});
}
export function projectWorkspaceHoldsV1(raw:unknown):readonly HeadquartersHold[]{
  const seen=new Set<string>();
  return list(raw).map(value=>{
    const r=obj(value),holdId=uuid(r.holdId),status=r.status,scopeKind=r.scopeKind;
    if(seen.has(holdId)||!(["active","released"].includes(String(status)))||
      !(["global","workspace","operation"].includes(String(scopeKind))))throw new TypeError("Invalid Headquarters hold");
    seen.add(holdId);
    return Object.freeze({holdId,holdKey:str(r.holdKey),scopeKind:scopeKind as HeadquartersHold["scopeKind"],
      status:status as HeadquartersHold["status"],revision:revision(r.revision),reason:str(r.reason),
      heldAt:date(r.heldAt),releasedAt:maybeDate(r.releasedAt)});
  });
}
export async function loadHeadquartersHoldsV1(rpc:HeadquartersRpc=directRpc):Promise<readonly HeadquartersHold[]>{
  return projectWorkspaceHoldsV1(await call(rpc,"admin_mizizi_list_workspace_holds_v1",{p_limit:100}));
}
/** Do not mistake malformed data, network failure or a conflicting HTTP result
 * for permission denial: ambiguous transport must NEVER offer bootstrap. */
export type HeadquartersDashboardLoadV1 =
  | Readonly<{kind:"ready"; cases:readonly HeadquartersDurableCase[]; holds:readonly HeadquartersHold[]}>
  | Readonly<{kind:"denied"|"unavailable"}>;

export async function loadHeadquartersDashboardV1(
  rpc:HeadquartersRpc=directRpc,
):Promise<HeadquartersDashboardLoadV1>{
  const [cases,holds]=await Promise.allSettled([
    loadDurableHeadquartersCasesV1(rpc),loadHeadquartersHoldsV1(rpc),
  ]);
  if(cases.status==="fulfilled"&&holds.status==="fulfilled")
    return Object.freeze({kind:"ready" as const,cases:cases.value,holds:holds.value});
  const failures=[cases,holds].filter(
    (item):item is PromiseRejectedResult=>item.status==="rejected",
  );
  if(failures.every(item=>item.reason instanceof HeadquartersAuthorizationDeniedError))
    return Object.freeze({kind:"denied" as const});
  return Object.freeze({kind:"unavailable" as const});
}

/** Display eligibility is advisory; the database remains the authorization authority. */
export function canOfferInternalWorkspaceSetupV1(
  loading:boolean,canManageRegistry:boolean,canManageUsers:boolean,
):boolean {
  return !loading && canManageRegistry && canManageUsers;
}

export async function bootstrapHeadquartersOwnerV1(reason:string,rpc:HeadquartersRpc=directRpc):Promise<string>{
  if(typeof reason!=="string"||reason.trim().length<12||reason.trim().length>1000)throw new TypeError("Specify why you are setting up Headquarters");
  return uuid(await call(rpc,"admin_mizizi_bootstrap_internal_owner_v1",{p_reason:reason.trim()}));
}
export async function startWorkspaceHoldV1(reason:string,key:string,rpc:HeadquartersRpc=directRpc):Promise<string>{
  if(typeof reason!=="string"||reason.trim().length<12||reason.trim().length>2000)
    throw new TypeError("Specify a meaningful reason for Hold Writes");
  if(!/^[A-Za-z0-9][A-Za-z0-9:_./-]{7,159}$/.test(key))throw new TypeError("Invalid Hold Writes key");
  const result=obj(await call(rpc,"admin_mizizi_hold_workspace_writes_v1",{
    p_hold_key:key,p_reason:reason.trim(),p_review_after:null,
  }));
  if(result.status!=="active"||result.holdKey!==key||revision(result.revision)!==1)
    throw new TypeError("Hold Writes receipt does not match the requested hold");
  return uuid(result.holdId);
}
export async function releaseWorkspaceHoldV1(
  hold:HeadquartersHold,reason:string,rpc:HeadquartersRpc=directRpc,
):Promise<void>{
  if(hold.status!=="active"||typeof reason!=="string"||reason.trim().length<12||reason.trim().length>1000)
    throw new TypeError("Cannot release an inactive hold without a reason");
  const result=obj(await call(rpc,"admin_mizizi_release_workspace_hold_v1",{
    p_hold_id:uuid(hold.holdId),p_expected_revision:revision(hold.revision),p_reason:reason.trim(),
  }));
  if(result.status!=="released"||uuid(result.holdId)!==hold.holdId||
    revision(result.revision)!==hold.revision+1)throw new TypeError("Hold release receipt mismatch");
}
