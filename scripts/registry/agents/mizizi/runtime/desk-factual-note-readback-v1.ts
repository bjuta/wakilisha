import {createHash} from "node:crypto";
import type {DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";
import type {WorkerRpc} from "./research-worker-cycle-v1.ts";
const UUID=/^[a-f0-9]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SHA=/^[a-f0-9]{64}$/;
const scopeKeys=["jobId","caseId","workspaceId","expectedRevision","workerId","leaseExpiresAt"] as const;
const hash=(s:string)=>createHash("sha256").update(s,"utf8").digest("hex");
const fail=(code:string):never=>{throw Error("MIZIZI_DESK_DISPATCH_"+code);};
function text(v:unknown,max:number,min=1):v is string{
 return typeof v==="string"&&v.trim()===v&&v.length>=min&&v.length<=max&&!/[\p{Cc}\p{Cf}]/u.test(v);
}
/** Separate original-note projection. Never relabel a note as a source excerpt
 * or treat readback as permission to transmit it to an external model. */
export type DeskFactualNoteV1=Readonly<{
 noteId:string;noteSha256:string;reviewRevision:number;caseId:string;workspaceId:string;
 expectedRevision:number;membershipSha256:string;observationSha256:string;authorId:string|null;reviewerId:string|null;
 authorJobId?:string;authorWorkerId?:string;originPassFingerprint?:string;originClaimIndex?:number;
 sourceReceiptIds?:readonly string[];sourceLocators?:readonly string[];modelUseRef?:string;
 fieldKey:string;noteKind:string;consultationMethod:string;sourceLocator:string;noteText:string;
 noteTextSha256:string;locatorSha256:string;observedAt:string;reviewRef:string|null;validUntil:string;
 representation:"original_factual_note";verified:false;modelUseEligible:true;
}>;
export async function readDeskFactualNotesV1(rpc:WorkerRpc,scope:DeskSearchScopeV1,
 subject:Readonly<{membershipSha256:string;observationSha256:string}>,now=Date.now,noteIds?:readonly string[]){
 const failNote=()=>fail("FACTUAL_NOTE_READBACK_DENIED");
 const shape=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&
  Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const live=()=>Number.isFinite(Date.parse(scope.leaseExpiresAt))&&Date.parse(scope.leaseExpiresAt)>now();
 if(!shape(scope,scopeKeys)||![scope.jobId,scope.caseId,scope.workspaceId].every(x=>UUID.test(x))||
  !/^mizizi-chart:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(scope.workerId)||
  !Number.isSafeInteger(scope.expectedRevision)||scope.expectedRevision<1||!live()||
  !subject||!SHA.test(subject.membershipSha256)||!SHA.test(subject.observationSha256))failNote();
 if(noteIds!==undefined&&(!Array.isArray(noteIds)||noteIds.length<1||noteIds.length>12||new Set(noteIds).size!==noteIds.length||noteIds.some(id=>!UUID.test(id))))return failNote();
 const r=await rpc("mizizi_read_desk_factual_notes_v1",{p_scope:scope,...(noteIds?{p_note_ids:noteIds}: {})});
 if(!live()||r.error||!shape(r.data,["bodyText","bodySha256"]))return failNote();
 const packet=r.data;
 if(typeof packet.bodyText!=="string"||Buffer.byteLength(packet.bodyText)>128000||
  typeof packet.bodySha256!=="string"||hash(packet.bodyText)!==packet.bodySha256)return failNote();
 let b:unknown;try{b=JSON.parse(packet.bodyText);}catch{return failNote();}
 if(!shape(b,["contract","scope","membershipSha256","observationSha256","notes"])||
  b.contract!=="mizizi.desk_factual_note_readback.v1"||!shape(b.scope,scopeKeys)||
  scopeKeys.some(k=>(b.scope as Record<string,unknown>)[k]!==scope[k])||
  b.membershipSha256!==subject.membershipSha256||b.observationSha256!==subject.observationSha256||
  !Array.isArray(b.notes)||b.notes.length>12)return failNote();
 const seen=new Set<string>(),notes:DeskFactualNoteV1[]=[];
 for(const n of b.notes){
  const agent=n?.consultationMethod==="autonomous_authorized_consultation";
  if(!shape(n,["noteId","noteSha256","reviewRevision","caseId","workspaceId","expectedRevision","membershipSha256",
   "observationSha256","authorId","reviewerId","fieldKey","noteKind","consultationMethod","sourceLocator","noteText",
   "noteTextSha256","locatorSha256","observedAt","reviewRef","validUntil","representation","verified","modelUseEligible",
   ...(agent?["authorJobId","authorWorkerId","originPassFingerprint","originClaimIndex","sourceReceiptIds","sourceLocators","modelUseRef"]:[])]))
   return failNote();
  const x=n as unknown as DeskFactualNoteV1;
  const validLocator=(v:unknown)=>{
   if(!text(v,1000,12))return false;
   try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!!u.hostname;}
   catch{return false;}
  };
  const authorValid=agent?
   x.authorId===null&&typeof x.authorJobId==="string"&&UUID.test(x.authorJobId)&&
    typeof x.authorWorkerId==="string"&&/^mizizi-chart:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(x.authorWorkerId)&&
    typeof x.originPassFingerprint==="string"&&SHA.test(x.originPassFingerprint)&&
    Number.isSafeInteger(x.originClaimIndex)&&x.originClaimIndex!>=0&&x.originClaimIndex!<20&&
    Array.isArray(x.sourceReceiptIds)&&x.sourceReceiptIds.length>=1&&x.sourceReceiptIds.length<=12&&
    new Set(x.sourceReceiptIds).size===x.sourceReceiptIds.length&&x.sourceReceiptIds.every(id=>typeof id==="string"&&UUID.test(id))&&
    Array.isArray(x.sourceLocators)&&x.sourceLocators.length===x.sourceReceiptIds.length&&x.sourceLocators[0]===x.sourceLocator&&
    x.sourceLocators.every(validLocator)&&text(x.modelUseRef,500,8)&&
    (x.reviewRevision===0?x.reviewerId===null&&x.reviewRef===null:
     typeof x.reviewerId==="string"&&UUID.test(x.reviewerId)&&text(x.reviewRef,500,8)):
   typeof x.authorId==="string"&&UUID.test(x.authorId)&&typeof x.reviewerId==="string"&&UUID.test(x.reviewerId)&&
    x.authorId!==x.reviewerId&&x.reviewRevision>=1&&text(x.reviewRef,500,8);
  if(!authorValid||typeof x.noteId!=="string"||!UUID.test(x.noteId)||seen.has(x.noteId)||
   (noteIds!==undefined&&!noteIds.includes(x.noteId))||typeof x.noteSha256!=="string"||!SHA.test(x.noteSha256)||
   !Number.isSafeInteger(x.reviewRevision)||x.reviewRevision<0||x.caseId!==scope.caseId||x.workspaceId!==scope.workspaceId||
   x.expectedRevision!==scope.expectedRevision||x.membershipSha256!==subject.membershipSha256||
   x.observationSha256!==subject.observationSha256||
   !["subject_version","release_date","performer","composition_credits","recording_production","label_distribution"].includes(x.fieldKey)||
   !["direct_observation","attributed_claim","inference"].includes(x.noteKind)||
   (!agent&&!["manual_public_consultation","manual_first_party_consultation"].includes(x.consultationMethod))||
   !text(x.noteText,1200,8)||!validLocator(x.sourceLocator)||
   (!agent&&(!/^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9_./~%-]+$/.test(x.sourceLocator)||
    /\/[.]{1,2}(\/|$)|%(2e|2f|5c|25|00)/i.test(x.sourceLocator)))||
   hash(x.noteText)!==x.noteTextSha256||hash(x.sourceLocator)!==x.locatorSha256||
   typeof x.observedAt!=="string"||!Number.isFinite(Date.parse(x.observedAt))||
   Date.parse(x.observedAt)>now()||typeof x.validUntil!=="string"||!Number.isFinite(Date.parse(x.validUntil))||
   Date.parse(x.validUntil)<=now()||Date.parse(x.validUntil)>Date.parse(scope.leaseExpiresAt)||
   x.representation!=="original_factual_note"||x.verified!==false||x.modelUseEligible!==true)return failNote();
  seen.add(x.noteId);notes.push(Object.freeze({...x}));
 }
 return Object.freeze({bodySha256:packet.bodySha256,notes:Object.freeze(notes)});
}

export type DeskFactualNoteSubjectV1=Readonly<{membershipSha256:string;observationSha256:string}>;
export type DeskFactualNoteReadbackV1=Awaited<ReturnType<typeof readDeskFactualNotesV1>>;
export type DeskFactualNoteReferenceV1=Readonly<{noteId:string;noteSha256:string;reviewRevision:number}>;
export function factualNoteReferencesV1(packet:DeskFactualNoteReadbackV1):readonly DeskFactualNoteReferenceV1[]{
 return Object.freeze(packet.notes.map(n=>Object.freeze({noteId:n.noteId,noteSha256:n.noteSha256,reviewRevision:n.reviewRevision})));
}
export function factualNoteContextV1(packet:DeskFactualNoteReadbackV1){
 return packet.notes.map(n=>({noteId:n.noteId,fieldKey:n.fieldKey,noteKind:n.noteKind,sourceLocator:n.sourceLocator,
  noteText:n.noteText,observedAt:n.observedAt,representation:n.representation,verified:false,
  ...(n.authorJobId?{authorship:"mizizi",sourceLocators:n.sourceLocators}: {})}));
}
export function validFactualNoteReferencesV1(refs:unknown):refs is readonly DeskFactualNoteReferenceV1[]{
 if(!Array.isArray(refs)||refs.length<1||refs.length>12)return false;
 const seen=new Set<string>();
 for(const r of refs){
  if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join(",")!=="noteId,noteSha256,reviewRevision"||
   typeof r.noteId!=="string"||!UUID.test(r.noteId)||seen.has(r.noteId)||typeof r.noteSha256!=="string"||!SHA.test(r.noteSha256)||
   !Number.isSafeInteger(r.reviewRevision)||r.reviewRevision<0)return false;
  seen.add(r.noteId);
 }
 return true;
}
export function factualNoteReferencesCurrentV1(refs:unknown,packet:DeskFactualNoteReadbackV1){
 return validFactualNoteReferencesV1(refs)&&refs.every(r=>packet.notes.some(n=>n.noteId===r.noteId&&n.noteSha256===r.noteSha256&&n.reviewRevision===r.reviewRevision));
}
