import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminChartsPageHeader } from '../components/AdminChartsPageHeader';
import { WkSurface } from '@/components/design-system/primitives/Surface';
import { WkWorkflowRail } from '@/components/design-system/primitives/WorkflowRail';
import { WkInspector } from '@/components/design-system/primitives/Inspector';
import { Modal } from '@/components/design-system/primitives/Modal';
import { WkSearchField } from '@/components/design-system/primitives/Field';
import { WkSelect } from '@/components/design-system/primitives/Select';
import { WkStateBadge } from '@/components/design-system/primitives/StateBadge';
import { WkDataTable, type WkDataColumn } from '@/components/design-system/primitives/DataTable';
import { WkDetailList } from '@/components/design-system/primitives/DetailList';
import { WkTabs } from '@/components/design-system/primitives/Tabs';
import { wk100CurrentWeekStartEat, isWk100WeekStartEat } from '../ingest/wk100EatWeek.mjs';
import { WK100_ARCHIVED_EAT_WEEK, getWk100ArchivedResearchPortfolio } from '@/services/chartsIngestion/wk100ResearchPortfolio.mjs';
import { WK100_SPOTIFY_EDITORIAL_SOURCES, spotifyEditorialSourceUrl } from '@/services/chartsIngestion/wk100SpotifyEditorialSources';
import { WkOperationsHero, WkNextAction, WkReadinessList } from '@/components/design-system/primitives/OperationsWorkspace';
import { WkAuditTimeline } from '@/components/design-system/primitives/AuditTimeline';
import { SourceProposalForm, type Wk100ProposalRecord } from './SourceProposalForm';
import { SourceMethodReviewForm, type Wk100MethodDecision } from './SourceMethodReviewForm';
import { SourceRecoveryDialog, type Wk100RecoveryKind } from './SourceRecoveryDialog';

type Source = {
  id:string;sourceKey:string;provider:string;surface:string;market:string;
  metric:string;behavior:string;expectedDepth:number;cadence:string;version:string;
  intervalHours:number|null;eatHour:number|null;eatMinute:number|null;
  weekdayEat:number|null;minimumHealthyCheckpoints:number;adapterVersion:string;
  admissionState:string;captureState:string;attemptCount:number;lastAttemptAt:string|null;
  lastSuccessfulAt:string|null;observedDepth:number;nativePeriodAuthority:string;
  nativePeriodStart:string|null;nativePeriodEnd:string|null;receiptSha256:string|null;
  failureCode:string|null;canScore:false;canPublish:false;
  lastScheduledAt:string|null;lastAttemptNumber:number|null;
  recentAttempts:{id:string;status:string;attemptedAt:string|null;scheduledAt:string|null;attemptNumber:number|null;fetchedAt:string|null;failureCode:string|null;observedDepth:number}[];
};
type Report = {schemaVersion:string;weekStartEat:string;sourceCount:number;
  successfulSources:number;failedSources:number;qualifiedSources:number;
  canScore:false;canPublish:false;sources:Source[]};
type View = 'overview'|'sources'|'collection';
type RecoveryAction = {
  actionId:string;sourceKey:string;contractId:string;weekStartEat:string;
  actionKind:'retry_requested'|'coverage_requested'|'coverage_accepted'|'coverage_rejected';
  revision:number;scheduledAt:string|null;attemptNumber:number|null;
  reason:string;createdAt:string;canCollect:false;canScore:false;canPublish:false;
};
const CORE_PROVIDERS=[
  // Founder-approved five-core priority order, issue #1338.
  {key:'apple_ke',label:'Apple Music Kenya'},
  {key:'shazam_ke',label:'Shazam Kenya'},
  {key:'mdundo_ke',label:'Mdundo Kenya'},
  {key:'youtube_ke',label:'YouTube Kenya'},
  {key:'audiomack_ke',label:'Audiomack Kenya'},
] as const;
type ProviderReadiness={
  key:string;label:string;proposalCount:number;decisionCount:number;
  state:string;next:string;focus:Wk100ProposalRecord|null;
};
type RegistrySource={
  id:string;sourceKey:string;provider:string;surface:string;
  contract:Source|null;proposal:Wk100ProposalRecord|null;method:Wk100MethodDecision|null;
};
function registryReviewLabel(row:RegistrySource,reviewAvailable:boolean,reviewedContract:boolean){
  if(!reviewAvailable)return 'Review unavailable';
  if(reviewedContract)return 'Reviewed candidate';
  if(!row.proposal)return 'Proposal missing';
  if(!row.method)return 'Method review needed';
  if(row.method.proposalRevision!==row.proposal.revision)return 'Review outdated';
  if(row.method.decisionState==='held')return 'Evidence held';
  if(row.method.decisionState==='paused')return 'Paused';
  if(row.method.decisionState==='retired')return 'Retired';
  return row.contract?'Contract review mismatch':'Method admitted · not enrolled';
}


function nextWeek(v:string,n:number) {
  const d=new Date(v+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n*7);
  return d.toISOString().slice(0,10);
}
// An immutable candidate contract describes intended timing, not an active scheduler.
function candidateCadence(s:Pick<Source,'eatHour'|'eatMinute'|'cadence'|'intervalHours'|'weekdayEat'>) {
  if(s.eatHour===null||s.eatMinute===null)return 'Timing not recorded';
  const time=String(s.eatHour).padStart(2,'0')+':'+String(s.eatMinute).padStart(2,'0')+' EAT';
  if(s.cadence==='daily')return 'Daily at '+time;
  if(s.cadence==='interval_hours'&&s.intervalHours!==null)
    return 'Every '+s.intervalHours+' hours, starting '+time;
  if(s.cadence==='weekly'&&s.weekdayEat!==null)
    return ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][s.weekdayEat]+' at '+time;
  return 'Timing definition unavailable';
}
function when(v:string|null) {
  if(!v)return 'Not recorded';
  const d=new Date(v);
  return Number.isFinite(d.getTime())?
    new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(d)+' EAT':
    'Unknown';
}
function Card({title,children}:{title:string;children:ReactNode}) {
  return <WkSurface className="rounded-xl p-4 sm:p-5"><h2 className="text-base font-bold text-wk-text">{title}</h2><div className="mt-3">{children}</div></WkSurface>;
}
export default function Wk100OperationsPage({view}:{view:View}) {
  const navigate=useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const requestedWeek=searchParams.get('week');
  const week=requestedWeek&&isWk100WeekStartEat(requestedWeek)?requestedWeek:wk100CurrentWeekStartEat();
  const setWeek=(next:(week:string)=>string)=>setSearchParams(p=>{const q=new URLSearchParams(p);q.set('week',next(week));return q;});
  const readSequence=useRef(0);
  const [report,setReport]=useState<Report|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const editionReadSequence=useRef(0);
  const [editionPhase,setEditionPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [editionConfig,setEditionConfig]=useState<{revision:number;updatedAt:string}|null>(null);
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [providerFilter,setProviderFilter]=useState('all');
  const [metricFilter,setMetricFilter]=useState('all');
  const [reviewFilter,setReviewFilter]=useState('all');
  const [constitutionFilter,setConstitutionFilter]=useState('all');
  const [selectedSourceKey,setSelectedSourceKey]=useState<string|null>(null);
  const [detail,setDetail]=useState<Source|null>(null);
  const [desktopIncident,setDesktopIncident]=useState(false);
  useEffect(()=>{
    const match=window.matchMedia('(min-width: 1280px)');
    const sync=()=>setDesktopIncident(match.matches);
    sync();
    match.addEventListener('change',sync);
    return ()=>match.removeEventListener('change',sync);
  },[]);
  const [detailTab,setDetailTab]=useState<'configuration'|'qualification'|'history'>('configuration');
  const [add,setAdd]=useState(false);
  const [editing,setEditing]=useState<Wk100ProposalRecord|null>(null);
  const [proposals,setProposals]=useState<Wk100ProposalRecord[]>([]);
  const [proposalPhase,setProposalPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [reviewing,setReviewing]=useState<Wk100ProposalRecord|null>(null);
  const [incidentPause,setIncidentPause]=useState(false);
  const [methodDecisions,setMethodDecisions]=useState<Wk100MethodDecision[]>([]);
  const [methodPhase,setMethodPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const recoverySequence=useRef(0);
  const [recoveryPhase,setRecoveryPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [recoveryActions,setRecoveryActions]=useState<RecoveryAction[]>([]);
  const [recoveryTarget,setRecoveryTarget]=useState<{kind:Wk100RecoveryKind;source:Source;revision:number}|null>(null);
  // A signed-in request is not a captured receipt. The separately enabled
  // service scheduler alone may dispatch the governed collector.
  const collectNowOperations=useRef(new Map<string,string>());
  const [collectNow,setCollectNow]=useState<{
    contractId:string;week:string;phase:'requesting'|'requested'|'failed';
    scheduledAt?:string;error?:string;
  }|null>(null);
  useEffect(()=>{setCollectNow(null)},[week]);
  const originalSequence=useRef(0);
  const [originalReadback,setOriginalReadback]=useState<{
    contractId:string;attemptId:string;phase:'loading'|'verified'|'unavailable';
    digest?:string;byteLength?:number;
  }|null>(null);
  useEffect(()=>{originalSequence.current+=1;setOriginalReadback(null)},[week,detail?.id]);
  const loadRecovery=useCallback(async()=>{
    const seq=++recoverySequence.current;
    setRecoveryPhase('loading');setRecoveryActions([]);
    try{
      const {data,error}=await supabase.rpc('wk100_list_collection_actions_v1',{p_week:week});
      if(error||!Array.isArray(data)||data.length>1000||
        data.some((a:RecoveryAction)=>!a||a.weekStartEat!==week||
          !['retry_requested','coverage_requested','coverage_accepted','coverage_rejected'].includes(a.actionKind)||
          typeof a.actionId!=='string'||typeof a.contractId!=='string'||
          !Number.isInteger(a.revision)||a.canCollect!==false||a.canScore!==false||a.canPublish!==false))
        throw Error('recovery_read_invalid');
      if(seq!==recoverySequence.current)return;
      setRecoveryActions(data as RecoveryAction[]);setRecoveryPhase('ready');
    }catch{if(seq===recoverySequence.current){setRecoveryActions([]);setRecoveryPhase('unavailable');}}
  },[week]);
  useEffect(()=>{
    if(view==='collection')void loadRecovery();
    return ()=>{recoverySequence.current+=1;};
  },[loadRecovery,view]);
  useEffect(()=>{setRecoveryTarget(null)},[week]);
  const loadMethods=useCallback(async()=>{
    setMethodPhase('loading');
    try {
      const {data,error}=await supabase.functions.invoke('wk100-source-admin-methods',{
        body:{action:'list_method_decisions'},
      });
      if(error||!data||data.schemaVersion!=='wk100-source-method-decisions-v1'||
        !Array.isArray(data.decisions)||data.decisions.length>500||
        data.canCollect!==false||data.canScore!==false||data.canPublish!==false||
        data.decisions.some((d:Wk100MethodDecision)=>d.canScore!==false||
          d.canPublish!==false||typeof d.sourceKey!=='string'||
          !['held','collector_admitted','paused','retired'].includes(d.decisionState)))throw Error();
      setMethodDecisions(data.decisions as Wk100MethodDecision[]);setMethodPhase('ready');
    }catch{setMethodDecisions([]);setMethodPhase('unavailable');}
  },[]);
  const loadProposals=useCallback(async()=>{
    setProposalPhase('loading');
    try{
      const {data,error}=await supabase.functions.invoke('wk100-source-admin-proposals',{
        body:{action:'list_source_proposals'},
      });
      if(error||!data||data.schemaVersion!=='wk100-source-proposals-v1'||
        !Array.isArray(data.proposals)||data.proposals.length>500||
        data.canCollect!==false||data.canScore!==false||data.canPublish!==false||
        data.proposals.some((p:Wk100ProposalRecord)=>p.state!=='proposed'||
          p.canCollect!==false||p.canScore!==false||p.canPublish!==false))throw Error();
      setProposals(data.proposals as Wk100ProposalRecord[]);setProposalPhase('ready');
    }catch{setProposals([]);setProposalPhase('unavailable');}
  },[]);
  useEffect(()=>{
    void loadProposals();void loadMethods();
  },[loadProposals,loadMethods,view]);
  const load=useCallback(async()=>{
    const seq=++readSequence.current;
    setPhase('loading');setReport(null);setDetail(null);
    try {
      const {data,error}=await supabase.functions.invoke('wk100-source-admin-read',{body:{action:'read_source_health',weekStartEat:week}});
      if(error||!data||data.schemaVersion!=='wk100-admin-source-health-v1'||data.weekStartEat!==week||
        !Array.isArray(data.sources)||data.canScore!==false||data.canPublish!==false)throw Error();
      if(seq!==readSequence.current)return;
      setReport(data as Report);setPhase('ready');
    } catch {if(seq===readSequence.current)setPhase('unavailable');}
  },[week]);
  useEffect(()=>{void load()},[load]);
  // Existing governed weekly draft authority is the only source for a saved
  // Edition configuration revision. It is not a collection ledger revision,
  // evidence admission, or permission to publish.
  const loadEdition=useCallback(async()=>{
    const seq=++editionReadSequence.current;
    setEditionPhase('loading');setEditionConfig(null);
    try{
      const {data,error}=await supabase.rpc('wk100_get_admin_draft_v1',{p_week:week});
      if(error)throw Error('edition_read_failed');
      let revision:{revision:number;updatedAt:string}|null=null;
      if(data!==null){
        if(!data||typeof data!=='object'||Array.isArray(data)||
          data.weekStartEat!==week||
          !Number.isSafeInteger(data.revision)||data.revision<1||
          typeof data.updatedAt!=='string'||!Number.isFinite(Date.parse(data.updatedAt))||
          typeof data.configSha256!=='string'||!/^[a-f0-9]{64}$/.test(data.configSha256))
          throw Error('edition_read_invalid');
        revision={revision:data.revision as number,updatedAt:data.updatedAt as string};
      }
      if(seq!==editionReadSequence.current)return;
      setEditionConfig(revision);setEditionPhase('ready');
    }catch{
      if(seq===editionReadSequence.current){
        setEditionConfig(null);setEditionPhase('unavailable');
      }
    }
  },[week]);
  useEffect(()=>{void loadEdition()},[loadEdition]);
  const providerReadiness=useMemo<ProviderReadiness[]>(()=>CORE_PROVIDERS.map(provider=>{
    const candidates=proposals.filter(p=>p.providerKey===provider.key);
    const paired=candidates.map(proposal=>({
      proposal,decision:methodDecisions.find(d=>d.sourceKey===proposal.sourceKey)??null,
    }));
    const current=paired.filter(x=>x.decision?.proposalRevision===x.proposal.revision);
    const missing=paired.find(x=>!x.decision||x.decision.proposalRevision!==x.proposal.revision);
    const held=current.find(x=>x.decision?.decisionState==='held');
    const pendingContract=current.find(x=>x.decision?.decisionState==='collector_admitted'&&
      !x.decision.captureContractVersion);
    const paused=current.find(x=>x.decision?.decisionState==='paused');
    const enrolled=current.find(x=>x.decision?.decisionState==='collector_admitted'&&
      !!x.decision.captureContractVersion);
    const focus=missing??held??pendingContract??paused??enrolled??current[0];
    let state='No proposal',next='Document a Kenya chart source and its access method';
    if(missing){state='Method review needed';next='Review the current source revision';}
    else if(held){state='Evidence held';next='Resolve the recorded evidence hold';}
    else if(pendingContract){state='Method admitted';next='Review candidate contract enrollment';}
    else if(paused){state='Paused';next='Review the paused method before any restart';}
    else if(enrolled){state='Candidate enrolled';next='Runtime approval and live collection remain separate';}
    else if(current.length){state='Retired';next='Review a new source method before use';}
    return {key:provider.key,label:provider.label,proposalCount:candidates.length,
      decisionCount:current.length,state,next,focus:focus?.proposal??null};
  }),[proposals,methodDecisions]);
  // An enrolled candidate is NOT a qualified source or an accepted source
  // constitution. Count only the current matching method/proposal revision
  // with a matching actual capture contract in the selected source projection.
  // Never show a positive count while either protected review read is stale.
  // Only matching current proposal/method/contract revisions count as
  // reviewed candidate contracts. This is not qualification or collection.
  const reviewedSourceIds=useMemo(()=>{
    const ids=new Set<string>();
    if(proposalPhase!=='ready'||methodPhase!=='ready'||phase!=='ready'||!report)return ids;
    for(const source of report.sources){
      const proposal=proposals.find(p=>p.sourceKey===source.sourceKey&&
        p.providerKey===source.provider);
      const method=methodDecisions.find(m=>m.sourceKey===source.sourceKey&&
        m.providerKey===source.provider&&m.proposalRevision===proposal?.revision);
      if(proposal&&method?.decisionState==='collector_admitted'&&
        method.captureContractVersion===source.version)ids.add(source.id);
    }
    return ids;
  },[report,phase,proposals,proposalPhase,methodDecisions,methodPhase]);
  const reviewedCandidateContracts=reviewedSourceIds.size;
  // An as-of original supports an Edition only if its verified acquisition
  // happened in this EAT week and the CURRENT method/contract still match.
  // This says nothing about the provider's measurement interval.
  const observedAsOfCaptureIds=useMemo(()=>{
    const ids=new Set<string>();
    if(!report||phase!=='ready'||methodPhase!=='ready'||proposalPhase!=='ready')return ids;
    for(const source of report.sources){
      if(!source.receiptSha256||!source.lastSuccessfulAt||
        !reviewedSourceIds.has(source.id))continue;
      const instant=Date.parse(source.lastSuccessfulAt);
      if(!Number.isFinite(instant)||
        wk100CurrentWeekStartEat(new Date(instant))!==week)continue;
      if(methodDecisions.some(method=>method.sourceKey===source.sourceKey&&
        method.providerKey===source.provider&&
        method.captureContractVersion===source.version&&
        method.decisionState==='collector_admitted'&&
        method.nativePeriodAuthority==='observed_as_of'))ids.add(source.id);
    }
    return ids;
  },[report,phase,proposalPhase,methodPhase,methodDecisions,reviewedSourceIds,week]);
  // The source-master must include pre-enrollment proposals. A proposal is
  // neither an enrolled capture contract nor a current-week evidence receipt.
  const registryRows=useMemo<RegistrySource[]>(()=>{
    const currentProposals=new Map<string,Wk100ProposalRecord>();
    if(proposalPhase==='ready')for(const proposal of proposals){
      const previous=currentProposals.get(proposal.sourceKey);
      if(!previous||proposal.revision>previous.revision)
        currentProposals.set(proposal.sourceKey,proposal);
    }
    const rows:RegistrySource[]=[];
    const enrolledKeys=new Set<string>();
    for(const contract of report?.sources??[]){
      enrolledKeys.add(contract.sourceKey);
      rows.push({
        id:'contract:'+contract.id,sourceKey:contract.sourceKey,
        provider:contract.provider,surface:contract.surface,contract,
        proposal:currentProposals.get(contract.sourceKey)??null,
        method:methodPhase==='ready'
          ?methodDecisions.find(m=>m.sourceKey===contract.sourceKey)??null:null,
      });
    }
    for(const proposal of currentProposals.values()){
      if(enrolledKeys.has(proposal.sourceKey))continue;
      rows.push({
        id:'proposal:'+proposal.sourceKey,sourceKey:proposal.sourceKey,
        provider:proposal.providerKey,surface:proposal.surface,contract:null,proposal,
        method:methodPhase==='ready'
          ?methodDecisions.find(m=>m.sourceKey===proposal.sourceKey)??null:null,
      });
    }
    return rows.sort((a,b)=>a.provider.localeCompare(b.provider)||
      a.surface.localeCompare(b.surface));
  },[report,proposalPhase,proposals,methodPhase,methodDecisions]);
  const sources=useMemo(()=>registryRows.filter(row=>{
    const contract=row.contract;
    const metric=contract?.metric??row.proposal?.metric??'';
    const health=contract?.captureState??'not_collected';
    const reviewed=!!contract&&reviewedSourceIds.has(contract.id);
    return (status==='all'||(status==='collected'?!!contract?.receiptSha256:
      status==='failed'?['transport_failed','parse_failed','target_period_unavailable','missed'].includes(health):
      health==='not_collected'))&&
      (providerFilter==='all'||row.provider===providerFilter)&&
      (metricFilter==='all'||metric===metricFilter)&&
      (reviewFilter==='all'||(reviewFilter==='reviewed'?reviewed:!reviewed))&&
      (constitutionFilter==='all'||(report?.qualifiedSources??0)>0&&
        contract?.admissionState==='qualified')&&
      (row.surface+' '+row.provider+' '+row.sourceKey).toLowerCase().includes(search.trim().toLowerCase());
  }),[registryRows,status,providerFilter,metricFilter,reviewFilter,constitutionFilter,report,search,reviewedSourceIds]);
  const selectedRegistrySource=registryRows.find(row=>row.sourceKey===selectedSourceKey)??null;
  const selectedCurrentMethod=selectedRegistrySource?.proposal&&selectedRegistrySource.method?.proposalRevision===
    selectedRegistrySource.proposal.revision?selectedRegistrySource.method:null;
  // Exactly one next action follows real server-owned proposal, review and
  // receipt state. A candidate contract never makes an Edition ready.
  const nextAction=(()=>{
    if(!report)return {
      title:'Check source status',
      description:'The source ledger is unavailable. No source readiness is assumed.',
      target:'/sources',button:'Review Sources',
    };
    if(proposalPhase!=='ready'||methodPhase!=='ready')return {
      title:'Check source review authority',
      description:'The protected proposal or method decision is unavailable. No collector method is assumed approved.',
      target:'/sources',button:'Review Sources',
    };
    if(proposals.length===0&&report.sourceCount===0)return {
      title:'Establish the source roster',
      description:'No source proposals are recorded. Document a Kenya source and its research method before review.',
      target:'/sources',button:'Add Source',
    };
    if(report.sourceCount===0){
      const awaiting=proposals.some(p=>{
        const decision=methodDecisions.find(d=>d.sourceKey===p.sourceKey);
        return !decision||decision.proposalRevision!==p.revision||
          decision.decisionState!=='collector_admitted';
      });
      return awaiting?{
        title:'Review proposed source methods',
        description:'Proposals exist, but no capture contract is enrolled. Review each current method before candidate enrollment.',
        target:'/sources',button:'Review Methods',
      }:{
        title:'Review candidate contract enrollment',
        description:'Method decisions are recorded. Review exact source contracts before any separately approved collection.',
        target:'/sources',button:'Review Sources',
      };
    }
    if(reviewedCandidateContracts===0)return {
      title:'Review current source methods',
      description:'Candidate contracts exist, but no matching current proposal and reviewed method can be confirmed.',
      target:'/sources',button:'Review Methods',
    };
    if(report.successfulSources===0)return {
      title:'Verify a source capture',
      description:week===wk100CurrentWeekStartEat()?
        'A reviewed source has no original this week. Request Collect Now in Collection. Only the approved service scheduler can act on it.':
        'This historical week has no verified capture. Collect Now cannot backdate an observation.',
      target:'/collection',button:'Review Collection',
    };
    return {
      title:'Inspect captured source evidence',
      description:'Review original receipts and native periods. Captures still need independent qualification before ranking.',
      target:'/collection',button:'Review Evidence',
    };
  })();
  const requestCollectNow=async(source:Source)=>{
    const proposal=proposals.find(p=>p.sourceKey===source.sourceKey);
    const decision=methodDecisions.find(d=>d.sourceKey===source.sourceKey);
    if(week!==wk100CurrentWeekStartEat()||
      proposalPhase!=='ready'||methodPhase!=='ready'||
      source.market!=='KE'||source.admissionState!=='candidate'||
      !proposal||!decision||decision.decisionState!=='collector_admitted'||
      decision.proposalRevision!==proposal.revision||
      decision.captureContractVersion!==source.version||
      collectNow?.phase==='requesting'||
      (collectNow?.phase==='requested'&&collectNow.contractId===source.id&&
        collectNow.week===week))return;
    const key=week+':'+source.id;
    let operationId=collectNowOperations.current.get(key);
    if(!operationId){
      operationId=crypto.randomUUID();
      collectNowOperations.current.set(key,operationId);
    }
    setCollectNow({contractId:source.id,week,phase:'requesting'});
    try{
      const {data,error}=await supabase.rpc('wk100_request_collect_now_v1',{
        p_contract_id:source.id,p_operation_id:operationId,
      });
      if(error){
        const code=String(error.code??'');
        throw new Error(code==='42501'?'Your account cannot request collection.':
          code==='22023'?'This source method is no longer eligible. Refresh its review.':
          code==='23505'?'A collection request already exists for this source and minute.':
          'The service did not confirm the collection request.');
      }
      const slot=typeof data?.scheduledAt==='string'?Date.parse(data.scheduledAt):NaN;
      if(!data||data.operationId!==operationId||
        data.contractId!==source.id||data.sourceKey!==source.sourceKey||
        data.weekStartEat!==week||
        !['requested','already_requested'].includes(data.status)||
        !Number.isFinite(slot)||
        data.canScore!==false||data.canPublish!==false)
        throw new Error('The service returned an invalid collection acknowledgement.');
      setCollectNow({contractId:source.id,week,phase:'requested',
        scheduledAt:data.scheduledAt});
      void load();void loadRecovery();
    }catch(e){
      setCollectNow({contractId:source.id,week,phase:'failed',
        error:e instanceof Error?e.message:'Collection could not be requested.'});
    }
  };
  const verifyOriginal=async(source:Source,attemptId:string)=>{
    const seq=++originalSequence.current;
    setOriginalReadback({contractId:source.id,attemptId,phase:'loading'});
    try{
      const {data,error}=await supabase.functions.invoke('wk100-source-admin-read',{
        body:{action:'verify_private_original',weekStartEat:week,
          contractId:source.id,receiptId:attemptId},
      });
      if(error||!data||data.schemaVersion!=='wk100-admin-original-readback-v1'||
        data.weekStartEat!==week||data.contractId!==source.id||
        data.receiptId!==attemptId||data.originalVerified!==true||
        typeof data.payloadSha256!=='string'||!/^[a-f0-9]{64}$/.test(data.payloadSha256)||
        !Number.isInteger(data.byteLength)||data.byteLength<1||data.byteLength>4194304||
        data.canScore!==false||data.canPublish!==false)throw Error();
      if(seq!==originalSequence.current)return;
      setOriginalReadback({contractId:source.id,attemptId,phase:'verified',
        digest:data.payloadSha256,byteLength:data.byteLength});
    }catch{
      if(seq===originalSequence.current)
        setOriginalReadback({contractId:source.id,attemptId,phase:'unavailable'});
    }
  };
  const go=(path:string)=>navigate('/admin/charts/wk100-operations'+path+'?week='+encodeURIComponent(week));
  return <div className="space-y-5">
    <AdminChartsPageHeader eyebrow="WAKILISHA 100 / Kenya" title={view==='overview'?'Weekly Overview':view==='sources'?'Source Registry':'Collection & Incidents'} description="Private source evidence and operational readiness for the selected EAT week.">
      <button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>{void load();void loadEdition();void loadProposals();void loadMethods();if(view==='collection')void loadRecovery()}} disabled={phase==='loading'}>Refresh status</button>
    </AdminChartsPageHeader>
    <WkSurface className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
      <div className="flex items-center gap-2"><button type="button" className="wk-button wk-button-secondary wk-button-sm" aria-label="Previous week" onClick={()=>setWeek(v=>nextWeek(v,-1))}>‹</button><div className="min-w-40 text-center"><p className="text-xs text-wk-text-muted">Edition week · Monday EAT</p><p className="text-sm font-bold text-wk-text">{week}</p></div><button type="button" className="wk-button wk-button-secondary wk-button-sm" aria-label="Next week" onClick={()=>setWeek(v=>nextWeek(v,1))}>›</button></div>
      <div className="flex flex-wrap items-center gap-2">
        {view==='overview'&&<button type="button"
          className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>navigate('/admin/charts/ingest?wk100Week='+encodeURIComponent(week))}>
          Configure this Edition
        </button>}
        <span role="status" className="rounded-full border border-wk-border px-3 py-1 text-xs font-semibold text-wk-text-soft">
          {editionPhase==='loading'?'Checking Edition configuration…':
            editionPhase==='unavailable'?'Edition configuration unavailable':
            editionConfig?'Edition configuration · Revision '+editionConfig.revision:
            'No saved Edition configuration'}
        </span>
        <span className="rounded-full border border-wk-border px-3 py-1 text-xs font-semibold text-wk-text-soft">Research only · Publication locked</span>
      </div>
    </WkSurface>
    <WkWorkflowRail ariaLabel="Chart operations stages"
      steps={['Collect','Identify','Qualify','Rank','Publish'].map((label,i)=>({
        id:label.toLowerCase(),label,
        description:i===0?'Current: source and evidence review':'Locked until preceding phase acceptance',
        state:i===0?'current' as const:'blocked' as const,
      }))}
      onSelect={step=>{if(step.id==='collect')go('')}}/>
    <nav className="flex flex-wrap gap-2" aria-label="Collection workspace">
      {[['Overview',''],['Sources','/sources'],['Collection','/collection']].map(([name,path])=><button key={name} type="button" onClick={()=>go(path)} aria-current={(view==='overview'&&path==='')||(view==='sources'&&path==='/sources')||(view==='collection'&&path==='/collection')?'page':undefined} className={'rounded-full border px-4 py-2 text-xs font-semibold '+((view==='overview'&&path==='')||(view==='sources'&&path==='/sources')||(view==='collection'&&path==='/collection')?'border-wk-brand bg-wk-brand-soft text-wk-text':'border-wk-border text-wk-text-muted hover:bg-wk-surface-raised')}>{name}</button>)}
    </nav>
    {phase==='loading'&&<Card title="Reading capture status"><p role="status" className="text-sm text-wk-text-muted">Checking the restricted source ledger…</p></Card>}
    {phase==='unavailable'&&<Card title="Source status unavailable"><p role="alert" className="text-sm text-wk-text-muted">The protected source service did not return a verified response. No source is assumed to be qualified or collected. Backend deployment and authorized access are needed before this view can show live status.</p></Card>}
    {phase==='ready'&&report&&<>
      {view==='overview'&&<div className="space-y-5">
        <WkOperationsHero eyebrow={'WAKILISHA 100 · Kenya · week '+week}
          title={'Week of '+new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Nairobi'}).format(new Date(week+'T12:00:00Z'))}
          description={report.sourceCount===0?'No enrolled capture sources yet. This week has no verified evidence set and cannot proceed to private ranking.':'Source research is provisional. Captures do not become scoring evidence until separately qualified.'}
          aside={<WkStateBadge tone="warning">Private · Not ready</WkStateBadge>}/>
        <div data-wk-weekly-layout className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <div data-wk-weekly-primary className="min-w-0 space-y-5">
          <WkNextAction title={nextAction.title}
            blocked
            description={nextAction.description}
            action={<button type="button" className="wk-button wk-button-primary wk-button-sm"
              onClick={()=>go(nextAction.target)}>{nextAction.button}</button>}
            secondary={<button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>go('/collection')}>Why collection is held</button>}/>
          <Card title="Readiness">
            <WkReadinessList items={[
              {id:'sources',label:'Qualified source constitution',status:'blocked',
                description:proposalPhase!=='ready'||methodPhase!=='ready'
                  ?'Source review authority unavailable. Qualification cannot be inferred.'
                  :reviewedCandidateContracts+' current reviewed candidate contracts. A reviewed contract is not an approved live source constitution.'},
              {id:'receipts',label:'Original source evidence',status:report.successfulSources>0?'pending':'blocked',description:report.successfulSources+' verifiable capture receipts'},
              {id:'period',label:'Reporting dates and observation time',
                status:report.sources.some(x=>x.receiptSha256&&x.nativePeriodAuthority==='provider_defined'&&x.nativePeriodStart&&x.nativePeriodEnd)||
                  observedAsOfCaptureIds.size>0?'pending':'blocked',
                description:observedAsOfCaptureIds.size>0
                  ?observedAsOfCaptureIds.size+' verified as-of observation(s). Provider measurement windows remain unknown.'
                  :'No verified provider reporting period or reviewed as-of original for this week.'},
              {id:'identity',label:'Canonical recording identities',status:'blocked',description:'Registry and MIZIZI reconciliation is Phase 2'},
              {id:'eligibility',label:'Complete eligibility and corrections',status:'blocked',description:'All applicable filter checks are Phase 2'},
              {id:'ranking',label:'Frozen methodology and private Top 100',status:'blocked',description:'A private ranking is not inferred from captures'},
              {id:'edition',label:'Edition staging and explicit publication',status:'blocked',description:'No public flagship has been authorized'},
            ]}/>
          </Card>
          </div>
          <aside data-wk-weekly-summary aria-label="Weekly evidence summary" className="min-w-0 space-y-5">
            <Card title="This week">
              <WkDetailList items={[
                {label:'Registered candidates',value:report.sourceCount},
                {label:'Reviewed candidate contracts',value:reviewedCandidateContracts},
                {label:'Verified captures',value:report.successfulSources},
                {label:'Collection failures',value:report.failedSources},
              ]}/>
            </Card>
            <Card title="Collection activity"><WkAuditTimeline locale="en-KE" timeZone="Africa/Nairobi"
              ariaLabel="Verified capture activity" emptyLabel="No source attempts recorded for this week."
              events={report.sources.flatMap(s=>s.recentAttempts.map((a,i)=>({
                id:s.id+':'+(a.id||i),label:s.surface+' · '+a.status.replaceAll('_',' '),
                occurredAt:a.attemptedAt,description:a.failureCode?
                  'Reason: '+a.failureCode:'Observed rows: '+a.observedDepth,
              }))).sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).slice(0,12)}/>
            </Card>
          </aside>
        </div>
      </div>}
      {view==='sources'&&<div className="space-y-5">
        <WkOperationsHero eyebrow="Programme · Kenya source constitution" title="Sources"
          description="Manage known collection surfaces without conflating technical access, qualification, capture health, and scoring admission."
          aside={<WkStateBadge tone="warning">{report.qualifiedSources} qualified</WkStateBadge>}
          action={<button className="wk-button wk-button-primary wk-button-sm" type="button" onClick={()=>{setEditing(null);setAdd(true)}}>Add Source</button>}/>
        <Card title="Source Registry">
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_repeat(5,minmax(105px,155px))]">
            <WkSearchField ariaLabel="Search provider or source" placeholder="Provider or source" value={search} onChange={setSearch}/>
            <WkSelect ariaLabel="Filter provider" value={providerFilter} onChange={setProviderFilter}
              options={[{value:'all',label:'All providers'},...Array.from(new Set(registryRows.map(s=>s.provider))).filter(Boolean).map(v=>({value:v,label:v}))]}/>
            <WkSelect ariaLabel="Filter health" value={status} onChange={setStatus}
              options={[{value:'all',label:'All health states'},{value:'collected',label:'Captured'},{value:'failed',label:'Failing'},{value:'not_collected',label:'Unknown'}]}/>
            <WkSelect ariaLabel="Filter metric" value={metricFilter} onChange={setMetricFilter}
              options={[{value:'all',label:'All metrics'},...Array.from(new Set(registryRows.map(s=>s.contract?.metric??s.proposal?.metric??''))).filter(Boolean).map(v=>({value:v,label:v}))]}/>
            <WkSelect ariaLabel="Filter method review" value={reviewFilter} onChange={setReviewFilter}
              options={[{value:'all',label:'All method states'},
                {value:'reviewed',label:'Current reviewed candidates'},
                {value:'pending',label:'Method review pending'}]}/>
            <WkSelect ariaLabel="Filter constitution" value={constitutionFilter} onChange={setConstitutionFilter}
              options={[{value:'all',label:'Constitution · All'},
                {value:'in',label:'Constitution · In'}]}/>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-wk-text-muted">
            <span>Known sources · {registryRows.length} · Enrolled capture contracts · {report.sourceCount} · Reviewed candidate contracts · {reviewedCandidateContracts}</span>
            <span>Candidate-only service · scoring constitution not granted</span>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,480px)]">
          <WkDataTable<RegistrySource> rows={sources} getKey={row=>row.id} ariaLabel="Source registry"
            empty={proposalPhase==='loading'&&report.sourceCount===0?
              'Reading proposed sources…':
              proposalPhase==='unavailable'&&report.sourceCount===0?
              'Proposed source authority unavailable. The source roster cannot be confirmed.':
              registryRows.length===0?'No sources proposed or enrolled yet.':
              'No sources match these filters.'}
            columns={[
              {key:'source',label:'Source · operator',render:row=><>
                <button type="button" className="font-semibold text-wk-text underline-offset-2 hover:underline"
                  onClick={()=>{setSelectedSourceKey(row.sourceKey);setDetailTab('configuration')}}>{row.surface}</button>
                <p className="mt-1 text-xs text-wk-text-muted">{row.provider} · {row.sourceKey}</p>
              </>},
              {key:'metric',label:'Metric · period · depth',render:row=>
                <span className="text-wk-text-soft">
                  {row.contract?.metric??row.proposal?.metric??'Unknown'} ·
                   {row.method?.nativePeriodAuthority==='observed_as_of'?
                     (row.contract&&observedAsOfCaptureIds.has(row.contract.id)?' Observed as-of':' As-of method, not collected'):
                     row.contract?.nativePeriodAuthority==='provider_defined'?' Defined':' Unverified'} ·
                  {' '+(row.contract?.expectedDepth??row.proposal?.expectedDepth??'Unknown')}
                </span>},
              {key:'cadence',label:'Candidate Timing',render:row=>
                <span className="text-wk-text-soft">{row.contract||row.proposal?
                  candidateCadence((row.contract??row.proposal)!):'Timing unavailable'}</span>},
              {key:'qualification',label:'Qualification',render:row=>
                <WkStateBadge tone={row.contract&&reviewedSourceIds.has(row.contract.id)?'info':
                  row.method?.decisionState==='paused'||row.method?.decisionState==='held'?'warning':'neutral'}>
                  {registryReviewLabel(row,proposalPhase==='ready'&&methodPhase==='ready',
                    !!row.contract&&reviewedSourceIds.has(row.contract.id))}
                </WkStateBadge>},
              {key:'health',label:'Health',render:row=>row.contract?
                <WkStateBadge tone={['transport_failed','parse_failed','missed','target_period_unavailable'].includes(row.contract.captureState)?'danger':
                  row.contract.receiptSha256?'success':'neutral'}>
                  {['transport_failed','parse_failed','missed','target_period_unavailable'].includes(row.contract.captureState)?
                    'Failing':row.contract.receiptSha256?'Captured':'Not collected'}
                </WkStateBadge>:
                <WkStateBadge>Not enrolled</WkStateBadge>},
              {key:'last',label:'Last success',render:row=>
                <span className="text-wk-text-muted">{when(row.contract?.lastSuccessfulAt??null)}</span>},
              {key:'constitution',label:'Constitution',render:()=>
                <span className="text-xs text-wk-text-muted">Out · no scoring authority</span>},
            ] satisfies WkDataColumn<RegistrySource>[]} />
          <aside role="region" aria-label="Selected source inspector"
            className="min-w-0 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-wk-text">{selectedRegistrySource?.surface??'Select a source'}</h3>
              {selectedRegistrySource&&<button type="button" className="wk-button wk-button-secondary wk-button-sm"
                onClick={()=>setSelectedSourceKey(null)}>Clear selection</button>}
            </div>
            {selectedRegistrySource?<div className="mt-4 space-y-4">
              <p className="text-xs text-wk-text-muted">
                {selectedRegistrySource.contract?'Capture contract enrolled · Collection remains separately gated':
                  'Source proposal · no capture contract enrolled'}
              </p>
              <WkTabs ariaLabel="Selected source detail" value={detailTab} onChange={setDetailTab}
                items={[{id:'configuration',label:'Configuration'},{id:'qualification',label:'Qualification'},{id:'history',label:'Change History'}]}>
                {detailTab==='configuration'&&<WkDetailList items={[
                  {label:'Provider and market',value:selectedRegistrySource.provider+' · KE'},
                  {label:'Source ID',value:selectedRegistrySource.sourceKey},
                  {label:'Proposed method',value:selectedRegistrySource.proposal?.methodClass??'Not recorded'},
                  {label:'Source evidence reference',value:selectedRegistrySource.proposal?.evidenceReference??'Not recorded'},
                  {label:'Method constitution version',value:selectedCurrentMethod?.constitutionVersion??'Not recorded'},
                  {label:'Native metric and behaviour',value:
                    (selectedRegistrySource.contract?.metric??selectedRegistrySource.proposal?.metric??'Unknown')+' · '+
                    (selectedRegistrySource.contract?.behavior??selectedRegistrySource.proposal?.behavior??'Unknown')},
                  {label:'Candidate EAT cadence',value:
                    selectedRegistrySource.contract||selectedRegistrySource.proposal?
                    candidateCadence((selectedRegistrySource.contract??selectedRegistrySource.proposal)!):'Unknown'},
                  {label:'Expected depth',value:
                    selectedRegistrySource.contract?.expectedDepth??selectedRegistrySource.proposal?.expectedDepth??'Unknown'},
                  {label:'Capture contract',value:selectedRegistrySource.contract?.version??'Not enrolled'},
                   {label:'Reporting date authority',value:selectedCurrentMethod?.nativePeriodAuthority==='observed_as_of'
                     ?'WAKILISHA observed-as-of. Provider reporting period unknown.'
                     :selectedCurrentMethod?.nativePeriodAuthority==='provider_defined'
                     ?'Provider-declared period':'No approved period method'},
                   {label:'Original observation time',value:selectedRegistrySource.contract&&
                     observedAsOfCaptureIds.has(selectedRegistrySource.contract.id)
                       ?when(selectedRegistrySource.contract.lastSuccessfulAt)
                       :'No verified as-of original for this week'},
                  {label:'Native period',value:selectedRegistrySource.contract?.nativePeriodAuthority==='provider_defined'?
                    when(selectedRegistrySource.contract.nativePeriodStart)+' to '+
                    when(selectedRegistrySource.contract.nativePeriodEnd):'Unverified'},
                ]}/>}
                {detailTab==='qualification'&&<WkReadinessList items={[
                  {id:'proposal',label:'Current source proposal',
                    status:selectedRegistrySource.proposal?'pending':'blocked',
                    description:selectedRegistrySource.proposal?
                      'Revision '+selectedRegistrySource.proposal.revision+' is proposed, not admitted':
                      'No current proposal could be confirmed'},
                  {id:'method',label:'Reviewed source method',
                    status:selectedCurrentMethod?.decisionState==='collector_admitted'?'pending':'blocked',
                    description:selectedCurrentMethod?
                      selectedCurrentMethod.decisionState.replaceAll('_',' ')+' · Collection not enabled':
                      'A matching current method decision is not confirmed'},
                  {id:'contract',label:'Enrolled capture contract',
                    status:selectedRegistrySource.contract?'pending':'blocked',
                    description:selectedRegistrySource.contract?
                      'Candidate contract recorded, not a qualified source':'No capture contract enrolled'},
                  {id:'score',label:'Ranking and publishing',
                    status:'blocked',description:'No candidate can grant scoring authority'},
                ]}/>}
                {detailTab==='history'&&<WkDetailList items={[
                  {label:'Latest proposal revision',value:selectedRegistrySource.proposal?.revision??'Not recorded'},
                  {label:'Proposal saved',value:when(selectedRegistrySource.proposal?.createdAt??null)},
                  {label:'Method review',value:selectedRegistrySource.method?
                    selectedRegistrySource.method.decisionState.replaceAll('_',' ')+
                    ' · revision '+selectedRegistrySource.method.decisionRevision:'Not recorded'},
                  {label:'Method decision recorded',value:when(selectedRegistrySource.method?.createdAt??null)},
                  {label:'Independent method evidence',value:selectedCurrentMethod?.hasMethodEvidence?
                    'Recorded, not collection approval':'Not verified'},
                  {label:'Method matches proposal',value:selectedCurrentMethod?'Yes':'Not confirmed'},
                  {label:'Last capture attempt',value:when(selectedRegistrySource.contract?.lastAttemptAt??null)},
                  {label:'Original receipt SHA-256',value:selectedRegistrySource.contract?.receiptSha256??'Not recorded'},
                  {label:'Capture attempt count',value:selectedRegistrySource.contract?.attemptCount??0},
                ]}/>}
              </WkTabs>
              {selectedRegistrySource.proposal&&proposalPhase==='ready'&&<div className="flex flex-wrap gap-2">
                <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                  onClick={()=>{setEditing(selectedRegistrySource.proposal);setAdd(true)}}>Revise Proposal</button>
                {methodPhase==='ready'&&<button type="button" className="wk-button wk-button-secondary wk-button-sm"
                  onClick={()=>{setIncidentPause(false);setReviewing(selectedRegistrySource.proposal)}}>Review Method</button>}
              </div>}
            </div>:<p className="mt-3 text-xs text-wk-text-muted">
              Select a source to inspect its proposal, method decision, capture contract, and evidence.
              Proposed sources remain visible before enrollment. This inspector does not grant scoring authority.
            </p>}
          </aside>
          </div>
        </Card>
        <Card title="Core Provider Readiness">
          <p className="mb-3 text-xs leading-relaxed text-wk-text-muted">
            Five founder-selected Kenya platforms are in scope, in the displayed order.
            Source selection is not collector admission; existing research and historical
            source records remain separately auditable.
            Candidate enrollment does not activate collection or publishing.
          </p>
          {(proposalPhase==='loading'||methodPhase==='loading')&&
            <p role="status" className="text-sm text-wk-text-muted">Reading source method authority…</p>}
          {(proposalPhase==='unavailable'||methodPhase==='unavailable')&&
            <p role="alert" className="text-sm text-wk-text-muted">
              The protected source authority is unavailable. Provider readiness cannot be confirmed.
            </p>}
          {proposalPhase==='ready'&&methodPhase==='ready'&&
            <WkDataTable<ProviderReadiness> rows={providerReadiness} getKey={p=>p.key}
              ariaLabel="Five core provider readiness" empty="No core providers configured."
              columns={[
                {key:'provider',label:'Platform',render:p=>
                  <span className="font-semibold text-wk-text">{p.label}</span>},
                {key:'records',label:'Saved Records',render:p=>
                  <span className="text-wk-text-soft">{p.proposalCount} proposed · {p.decisionCount} current reviews</span>},
                {key:'state',label:'Current Position',render:p=>
                  <WkStateBadge tone={p.state==='Paused'||p.state==='Evidence held'?'warning':
                    p.state==='Candidate enrolled'?'info':'neutral'}>{p.state}</WkStateBadge>},
                {key:'next',label:'Next Action',render:p=>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-wk-text-muted">{p.next}</span>
                    <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                      onClick={()=>{
                        if(p.focus){setIncidentPause(false);setReviewing(p.focus)}
                        else {setEditing(null);setAdd(true)}
                      }}>{p.focus?'Review '+p.label+' Method':'Add '+p.label+' Source'}</button>
                  </div>},
              ] satisfies WkDataColumn<ProviderReadiness>[]} />}
        </Card>
        <Card title="Spotify Editorial — Supplementary Signals">
          <p className="mb-3 text-xs leading-relaxed text-wk-text-muted">
            Four founder-selected Spotify editorial playlists are required supplementary research
            inputs for the WAKILISHA 100 methodology. Their verified inclusion and displayed
            order may inform a lower-weight editorial signal, capped together as ONE provider
            family. They do not report Kenya stream totals and do not count toward the five
            primary platforms or the two-independent-provider collector receipt minimum.
          </p>
          <ul aria-label="Required Spotify editorial sources" className="grid gap-2 sm:grid-cols-2">
            {WK100_SPOTIFY_EDITORIAL_SOURCES.map(source=>
              <li key={source.sourceKey} className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                <a className="font-semibold text-wk-text underline underline-offset-2"
                   href={spotifyEditorialSourceUrl(source.playlistId)}
                   target="_blank" rel="noopener noreferrer">{source.label}</a>
                <p className="mt-1 text-xs text-wk-text-muted">{source.role}</p>
                <p className="mt-2 text-xs text-wk-text-soft">
                  Editorial placement · source-method review required · no collector receipt
                </p>
              </li>)}
          </ul>
          <p className="mt-3 text-xs text-wk-text-muted">
            Numeric weighting and anti-double-counting are approved in Phase 3. This source
            register does not admit unattended Spotify collection or authorize scoring.
          </p>
        </Card>
        <Card title="Source proposals">
          <p className="mb-3 text-xs leading-relaxed text-wk-text-muted">
            These are append-only Admin configuration proposals, not admitted sources.
            They cannot start capture, appear in a weekly scoring constitution or publish a chart.
          </p>
          {proposalPhase==='loading'&&<p role="status" className="text-sm text-wk-text-muted">Reading protected proposals…</p>}
          {proposalPhase==='unavailable'&&<p role="alert" className="text-sm text-wk-text-muted">
            The protected proposal service is unavailable. No saved configuration is assumed.
            Source proposals cannot be submitted until the versioned database and Edge authority are deployed.
          </p>}
          {proposalPhase==='ready'&&<WkDataTable<Wk100ProposalRecord>
            rows={proposals} getKey={p=>p.id} ariaLabel="Source proposals"
            empty="No source proposals have been saved."
            columns={[
              {key:'surface',label:'Provider and surface',render:p=><span className="font-semibold text-wk-text">{p.surface}<span className="mt-1 block text-xs font-normal text-wk-text-muted">{p.providerKey} · {p.sourceKey}</span></span>},
              {key:'method',label:'Method',render:p=><span className="text-wk-text-soft">{p.methodClass.replaceAll('_',' ')}</span>},
              {key:'revision',label:'Revision',render:p=><span className="text-wk-text-soft">{p.revision}</span>},
              {key:'status',label:'Authority',render:()=> <WkStateBadge>Proposed only</WkStateBadge>},
              {key:'action',label:'Actions',render:p=><div className="flex flex-wrap gap-2">
                <button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>{setEditing(p);setAdd(true)}}>Revise</button>
                <button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>{setIncidentPause(false);setReviewing(p)}}>Review Method</button>
              </div>},
            ] satisfies WkDataColumn<Wk100ProposalRecord>[]} />}
        </Card>
        <Card title="Source Method Reviews">
          <p className="mb-3 text-xs leading-relaxed text-wk-text-muted">
            Independent method decisions are audited separately from source proposals. Admitting a method
            does not enable automated collection, qualify scoring evidence or publish a chart.
          </p>
          {methodPhase==='loading'&&<p role="status" className="text-sm text-wk-text-muted">Reading method decisions…</p>}
          {methodPhase==='unavailable'&&<p role="alert" className="text-sm text-wk-text-muted">
            The protected method review service is unavailable. No source method is assumed approved.
          </p>}
          {methodPhase==='ready'&&<WkDataTable<Wk100MethodDecision>
            rows={methodDecisions} getKey={d=>d.sourceKey} ariaLabel="Source method decisions"
            empty="No reviewed source methods yet."
            columns={[
              {key:'source',label:'Source',render:d=><span className="font-semibold text-wk-text">
                {d.sourceKey}<span className="mt-1 block text-xs font-normal text-wk-text-muted">{d.providerKey}</span>
              </span>},
              {key:'decision',label:'Method review',render:d=><WkStateBadge tone={d.decisionState==='collector_admitted'?'info':d.decisionState==='retired'?'danger':'neutral'}>
                {d.decisionState==='collector_admitted'?'Method admitted':d.decisionState.replaceAll('_',' ')}
              </WkStateBadge>},
              {key:'revision',label:'Revision',render:d=><span className="text-wk-text-soft">{d.decisionRevision}</span>},
              {key:'collection',label:'Collection',render:()=> <WkStateBadge>Off</WkStateBadge>},
            ] satisfies WkDataColumn<Wk100MethodDecision>[]} />}
        </Card>

      </div>}
      {view==='collection'&&<div data-wk-w3-layout=""
        className={detail&&desktopIncident?
          'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,480px)]':
          'grid grid-cols-1 gap-5'}>
        <div data-wk-w3-master="" className="min-w-0 space-y-5">
        <WkOperationsHero eyebrow={'Collection · EAT week '+week} title="Collection"
          description="Source-specific reporting periods, captured evidence and attempt integrity are tracked separately. A successful download does not grant scoring qualification."
          aside={<WkStateBadge tone={report.failedSources?'danger':'neutral'}>{report.failedSources?report.failedSources+' source failures':'No admitted collection'}</WkStateBadge>}
          action={<span className="text-xs text-wk-text-muted">Choose a reviewed source below to request collection or inspect recovery</span>}/>
        <WkSurface className="rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[.1em] text-wk-text-muted">Qualified coverage</p>
              <p className="mt-2 text-xl font-bold text-wk-text">{report.qualifiedSources} qualified sources</p>
              <p className="mt-1 text-sm text-wk-text-muted">{report.successfulSources} capture receipts across {report.sourceCount} candidate contracts. These do not establish admitted coverage.</p>
            </div><WkStateBadge tone="warning">Not ready for ranking</WkStateBadge>
          </div>
          <div role="group" aria-label="Candidate collection coverage breakdown"
            className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {([
              ['Receipt recorded',report.successfulSources],
              ['No verified original',Math.max(0,report.sourceCount-report.successfulSources)],
              ['Latest attempt failed',report.failedSources],
              ['Not yet attempted',report.sources.filter(s=>s.attemptCount===0).length],
            ] as const).map(([label,count])=>
              <div key={label} className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                <p className="text-[11px] text-wk-text-muted">{label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-wk-text">{count}</p>
              </div>)}
          </div>
          <p className="mt-3 text-xs text-wk-text-muted">
            Candidate receipt coverage: {report.successfulSources} of {report.sourceCount}.
            A source may have an earlier receipt and a later failure, so the categories can overlap.
            None of these records independently qualifies a source or unlocks ranking.
          </p>
          <div aria-label="Candidate receipt coverage" role="progressbar"
            aria-valuenow={report.sourceCount?Math.round(100*Math.min(report.successfulSources,report.sourceCount)/report.sourceCount):0}
            aria-valuemin={0} aria-valuemax={100}
            className="mt-4 h-2 overflow-hidden rounded-full bg-wk-surface-raised">
            <div className="h-full bg-wk-brand"
              style={{width:(report.sourceCount?100*Math.min(report.successfulSources,report.sourceCount)/report.sourceCount:0)+'%'}}/>
          </div>
        </WkSurface>
        <p className="text-xs leading-relaxed text-wk-text-muted">
          Retry requests remain subject to the original 20-minute collection slot, method admission,
          the existing scheduler, and durable lease. Coverage decisions document missingness and
          never restore missing evidence or change source weights.
        </p>
        {recoveryPhase==='loading'&&<p role="status" className="text-xs text-wk-text-muted">Reading recovery history…</p>}
        {recoveryPhase==='unavailable'&&<p role="alert" className="text-sm text-wk-text-muted">
          The protected recovery service is unavailable. No retry or coverage decision can be recorded.
        </p>}
         {collectNow?.week===week&&<p role={collectNow.phase==='failed'?'alert':'status'}
           className="rounded-xl border border-wk-border p-3 text-sm text-wk-text">
           {collectNow.phase==='requesting'?'Recording the collection request…':
             collectNow.phase==='requested'?
             'Collection requested at '+when(collectNow.scheduledAt??null)+
             '. The service scheduler must be enabled separately. No capture receipt is confirmed yet.':
             collectNow.error}
         </p>}
         <Card title="Source collection">
          <WkDataTable<Source> rows={report.sources} getKey={s=>s.id} ariaLabel="Weekly source collection"
            empty="No source capture contracts or attempts exist for this week. Collection scheduling has not been enabled."
            columns={[
              {key:'source',label:'Source · reporting period',render:s=><><button type="button" className="font-semibold text-wk-text hover:underline" onClick={()=>setDetail(s)}>{s.surface}</button><p className="mt-1 text-xs text-wk-text-muted">{s.nativePeriodAuthority==='provider_defined'?'Provider-defined period':'Native period unknown'}</p></>},
              {key:'depth',label:'Rows observed',render:s=><span className="font-semibold tabular-nums text-wk-text">{s.observedDepth} <span className="font-normal text-wk-text-muted">of {s.expectedDepth}</span></span>},
              {key:'attempt',label:'Latest attempt',render:s=><span className="text-wk-text-muted">{when(s.lastAttemptAt)}</span>},
               {key:'receipt',label:'Validation · receipt',render:s=>s.receiptSha256?
                 <button type="button" className="text-left font-semibold text-wk-text hover:underline"
                   onClick={()=>{setDetail(s);setDetailTab('history')}}>Inspect original receipt</button>:
                 <span className="text-wk-text-muted">No verified receipt</span>},
              {key:'status',label:'Status',render:s=><WkStateBadge tone={['transport_failed','parse_failed','target_period_unavailable','missed'].includes(s.captureState)?'danger':s.receiptSha256?'info':'neutral'}>{s.captureState.replaceAll('_',' ')}</WkStateBadge>},
              {key:'recovery',label:'Recovery',render:s=>{
                if(recoveryPhase!=='ready')
                  return <span className="text-xs text-wk-text-muted">Recovery unavailable</span>;
                const coverage=recoveryActions.filter(a=>a.contractId===s.id&&
                  a.actionKind!=='retry_requested')
                  .sort((a,b)=>b.revision-a.revision)[0];
                const withinWindow=!!s.lastScheduledAt &&
                  Date.now()>=Date.parse(s.lastScheduledAt) &&
                  Date.now()-Date.parse(s.lastScheduledAt)<=20*60_000;
                const retryable=['transport_failed','missed'].includes(s.captureState) &&
                  !!s.lastAttemptNumber && s.lastAttemptNumber<8 && withinWindow;
                return <div className="flex flex-wrap gap-2">
                  {retryable&&<button type="button" className="wk-button wk-button-secondary wk-button-sm"
                    onClick={()=>setRecoveryTarget({kind:'request_retry',source:s,revision:0})}>Request Retry</button>}
                  {['transport_failed','missed'].includes(s.captureState)&&!retryable&&
                    <span className="text-xs text-wk-text-muted">Retry window closed or exhausted</span>}
                  {coverage?.actionKind==='coverage_requested'?<>
                    <WkStateBadge tone="warning">Coverage review pending</WkStateBadge>
                    <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                      onClick={()=>setRecoveryTarget({kind:'accept_exception',source:s,revision:coverage.revision})}>Accept Missingness</button>
                    <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                      onClick={()=>setRecoveryTarget({kind:'reject_exception',source:s,revision:coverage.revision})}>Reject Request</button>
                  </>:!s.receiptSha256&&<button type="button" className="wk-button wk-button-secondary wk-button-sm"
                    onClick={()=>setRecoveryTarget({kind:'request_exception',source:s,revision:coverage?.revision??0})}>Request Coverage Review</button>}
                </div>;
              }},
              {key:'control',label:'Incident Control',render:s=>{
                const decision=methodDecisions.find(d=>d.sourceKey===s.sourceKey);
                const proposal=proposals.find(p=>p.sourceKey===s.sourceKey);
                if(methodPhase!=='ready'||proposalPhase!=='ready')
                  return <span className="text-xs text-wk-text-muted">Controls unavailable</span>;
                if(decision?.decisionState==='paused')
                  return <WkStateBadge tone="warning">Paused</WkStateBadge>;
                if(decision?.decisionState!=='collector_admitted'||!proposal||
                   proposal.revision!==decision.proposalRevision||
                   decision.captureContractVersion!==s.version)
                  return <span className="text-xs text-wk-text-muted">No current admitted method</span>;
                const active=collectNow?.contractId===s.id&&collectNow.week===week;
                const accepted=active&&collectNow.phase==='requested';
                return <div className="flex flex-wrap gap-2">
                  {week===wk100CurrentWeekStartEat()&&s.market==='KE'&&
                    s.admissionState==='candidate'&&
                    <button type="button" className="wk-button wk-button-primary wk-button-sm"
                      disabled={accepted||(active&&collectNow.phase==='requesting')}
                      onClick={()=>void requestCollectNow(s)}>
                      {accepted?'Request Recorded':active&&collectNow.phase==='requesting'?
                        'Requesting…':'Collect Now'}
                    </button>}
                  {week!==wk100CurrentWeekStartEat()&&
                    <span className="text-xs text-wk-text-muted">Current week only</span>}
                  <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                    onClick={()=>{setIncidentPause(true);setReviewing(proposal)}}>
                    Pause Collection
                  </button>
                </div>;
              }},
            ] satisfies WkDataColumn<Source>[]} />
        </Card>
        <Card title="Recovery decision history">
          <WkAuditTimeline locale="en-KE" timeZone="Africa/Nairobi"
            ariaLabel="Collection recovery decisions" emptyLabel="No recovery requests or decisions recorded."
            events={recoveryActions.map(a=>({
              id:a.actionId,label:a.sourceKey+' · '+a.actionKind.replaceAll('_',' '),
              occurredAt:a.createdAt,description:a.reason,
            })).sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).slice(0,30)}/>
        </Card>
        <Card title="Collection activity">
          <WkAuditTimeline locale="en-KE" timeZone="Africa/Nairobi" ariaLabel="Collection attempt history" emptyLabel="No collection attempts recorded." events={report.sources.flatMap(s=>s.recentAttempts.map((a,i)=>({
            id:s.id+':'+(a.id||i),label:s.surface+' · '+a.status.replaceAll('_',' '),
            occurredAt:a.attemptedAt,
            description:a.failureCode?'Safe reason: '+a.failureCode:'Rows observed: '+a.observedDepth,
          }))).sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).slice(0,30)}/>
        </Card>
        {report.failedSources>0&&<WkNextAction eyebrow="Collection incident" title="A source returned an unusable observation"
          description="Inspect the latest safe failure code and capture history. The system must not reuse another week's evidence or redistribute source weights automatically."
          blocked action={<button type="button" className="wk-button wk-button-secondary wk-button-sm"
            onClick={()=>setDetail(report.sources.find(s=>['transport_failed','parse_failed','target_period_unavailable','missed'].includes(s.captureState))??null)}>Inspect incident</button>}/>}
        </div>
        {detail&&<WkInspector open={true} inline={desktopIncident} onClose={()=>setDetail(null)} title={detail.surface}
      eyebrow="Source candidate · Kenya"
      summary={<div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-wk-text-muted">{detail.provider} · {detail.market} · {detail.version}</span>
        <WkStateBadge>Candidate</WkStateBadge>
        <WkStateBadge tone={detail.failureCode?'danger':detail.receiptSha256?'info':'neutral'}>{detail.captureState.replaceAll('_',' ')}</WkStateBadge>
      </div>}>
      <WkTabs ariaLabel="Source information" value={detailTab} onChange={setDetailTab}
        items={[{id:'configuration',label:'Configuration'},{id:'qualification',label:'Qualification'},{id:'history',label:'History'}]}>
        {detailTab==='configuration'&&<div className="space-y-4">
          <WkDetailList items={[
            {label:'Provider',value:detail.provider},
            {label:'Source identity',value:detail.sourceKey},
            {label:'Territory',value:detail.market},
            {label:'Native metric',value:detail.metric},
            {label:'Behavior class',value:detail.behavior},
            {label:'Expected depth',value:detail.expectedDepth},
            {label:'Candidate cadence definition',value:candidateCadence(detail)},
            {label:'Minimum healthy checkpoints',value:detail.minimumHealthyCheckpoints},
            {label:'Adapter revision',value:detail.adapterVersion||'Not recorded'},
            {label:'Source contract version',value:detail.version},
             {label:'Original observation time',value:detail.receiptSha256?when(detail.lastSuccessfulAt):'No verified original'},
             {label:'WAKILISHA observed-as-of',value:observedAsOfCaptureIds.has(detail.id)?
               'Verified for this EAT Edition. Provider measurement period remains unknown.':
               'No approved as-of evidence for this Edition'},
            {label:'Native measurement period',value:detail.nativePeriodAuthority==='provider_defined'
              ?when(detail.nativePeriodStart)+' to '+when(detail.nativePeriodEnd):'Unknown'},
          ]}/>
          <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
            <p className="text-xs font-bold text-wk-text">Infrastructure-managed source method</p>
            <p className="mt-2 text-xs leading-relaxed text-wk-text-muted">The timing shown is a candidate contract definition, not proof that collection is scheduled. Approved endpoints, parser identity, and credentials are not editable here. No secrets are transmitted to the browser.</p>
          </div>
        </div>}
        {detailTab==='qualification'&&<div className="space-y-3">
          <WkReadinessList items={[
            {id:'market',label:'Market and surface',status:detail.market==='KE'?'pending':'blocked',description:'A Kenya label does not independently establish source qualification'},
            {id:'method',label:'Independent source method',status:'blocked',description:'No accepted WK100 source admission has been established for this candidate'},
             {id:'native',label:'Reporting date evidence',
               status:detail.nativePeriodAuthority==='provider_defined'||observedAsOfCaptureIds.has(detail.id)
                 ?'pending':'blocked',
               description:observedAsOfCaptureIds.has(detail.id)
                 ?'Verified collection date only. The provider reporting period is unknown.'
                 :'Provider reporting dates or reviewed as-of capture remain unverified'},
            {id:'score',label:'Scoring authority',status:'blocked',description:'Candidate capture contracts do not grant scoring authority'},
          ]}/>
        </div>}
        {detailTab==='history'&&<div className="space-y-4">
          <WkDetailList items={[
            {label:'Most recent attempt',value:when(detail.lastAttemptAt)},
             {label:'Most recent slot',value:when(detail.lastScheduledAt)},
             {label:'Latest attempt number',value:detail.lastAttemptNumber??'Not recorded'},
            {label:'Last successful capture',value:when(detail.lastSuccessfulAt)},
            {label:'Observed depth',value:detail.observedDepth},
            {label:'Original receipt SHA-256',value:detail.receiptSha256||'No verified receipt'},
            {label:'Recorded attempts',value:detail.attemptCount},
            {label:'Attempts remaining',value:Math.max(0,8-(detail.lastAttemptNumber??0))+
              ' at most, only inside the original 20-minute slot'},
            {label:'Safe failure code',value:detail.failureCode||'None recorded'},
          ]}/>
          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
            <h3 className="text-sm font-bold text-wk-text">Incident impact and recovery</h3>
            <p className="mt-2 text-xs leading-relaxed text-wk-text-muted">
              Earlier-week evidence cannot fill this gap. Coverage decisions record missingness,
              never replacement evidence or new source weights. Ranking and publication remain blocked.
            </p>
            <WkDetailList items={[
              {label:'Current source outcome',value:detail.captureState.replaceAll('_',' ')},
              {label:'Original evidence for this week',value:detail.receiptSha256?
                'Candidate receipt recorded, pending independent qualification':
                'No accepted original receipt for this source'},
              {label:'Latest coverage decision',value:recoveryPhase!=='ready'?'Unavailable':
                recoveryActions.filter(a=>a.contractId===detail.id&&a.actionKind!=='retry_requested')
                  .sort((a,b)=>b.revision-a.revision)[0]?.actionKind.replaceAll('_',' ')??'Not requested'},
              {label:'Edition and ranking impact',value:'Blocked pending accepted source and evidence authority'},
            ]}/>
          </div>
          {detail.attemptCount>detail.recentAttempts.length&&
            <p className="text-xs text-wk-text-muted">
              Showing {detail.recentAttempts.length} of {detail.attemptCount} recorded attempts.
            </p>}
          <WkAuditTimeline locale="en-KE" timeZone="Africa/Nairobi" ariaLabel="Source capture attempts" emptyLabel="No attempts have been recorded for this week."
            events={detail.recentAttempts.map((a,i)=>({
              id:a.id||String(i),
              label:'Attempt '+(a.attemptNumber??'?')+' · '+a.status.replaceAll('_',' '),
              occurredAt:a.attemptedAt,
              description:'Slot '+when(a.scheduledAt)+' · '+
                (a.failureCode?'Safe reason: '+a.failureCode:'Observed rows: '+a.observedDepth),
            }))}/>
          <section aria-label="Private original readback" className="space-y-3">
            <h3 className="text-sm font-bold text-wk-text">Private Original Readback</h3>
            <p className="text-xs leading-relaxed text-wk-text-muted">
              Verify the exact stored bytes against the recorded SHA-256.
              The server performs the readback. No original file or private path leaves Storage.
            </p>
            <div className="flex flex-wrap gap-2">
              {detail.recentAttempts.filter(a=>
                ['succeeded','partial_depth','parse_failed','target_period_unavailable'].includes(a.status)
                &&!!a.id).map(a=><button key={a.id} type="button"
                  disabled={originalReadback?.phase==='loading'}
                  className="wk-button wk-button-secondary wk-button-sm"
                  onClick={()=>void verifyOriginal(detail,a.id)}>
                  Verify original · Attempt {a.attemptNumber??'?'}
                </button>)}
            </div>
            {!detail.recentAttempts.some(a=>
              ['succeeded','partial_depth','parse_failed','target_period_unavailable'].includes(a.status)
              &&!!a.id)&&<p className="text-xs text-wk-text-muted">
              No retained original appears in the current attempt window.
            </p>}
            {originalReadback?.contractId===detail.id&&
              <div role={originalReadback.phase==='unavailable'?'alert':'status'}
                className="rounded-xl border border-wk-border bg-wk-surface-raised p-3 text-xs text-wk-text-soft">
                {originalReadback.phase==='loading'?'Checking the private original…':
                  originalReadback.phase==='verified'?
                    'Original verified in private Storage. SHA-256: '+originalReadback.digest+
                    '. Bytes: '+originalReadback.byteLength+'. This is not scoring admission.':
                    'The server could not verify the original. No evidence is assumed valid.'}
              </div>}
          </section>
        </div>}
      </WkTabs>
      <p className="mt-5 rounded-xl bg-wk-surface-raised p-4 text-xs leading-relaxed text-wk-text-muted">
        Source settings, qualification, retries, and coverage exceptions require separately accepted governed commands. This inspection view does not modify the capture ledger.
      </p>
    </WkInspector>}
      </div>}
    </>}
    {view==='sources'&&
        <Card title="Research Already Captured">
          <p className="mb-3 text-xs leading-relaxed text-wk-text-muted">
            Researcher-held originals from 29–30 October 2026. These observations remain useful
            without a source proposal. The private files are not hosted capture receipts,
            verified measurement weeks, or permission to publish.
          </p>
          <WkDataTable rows={getWk100ArchivedResearchPortfolio(WK100_ARCHIVED_EAT_WEEK)}
            getKey={r=>r.sourceKey} ariaLabel="Archived Kenya research observations"
            empty="No preserved research observations." columns={[
              {key:'source',label:'Platform',render:r=><span className="font-semibold text-wk-text">{r.displayName}</span>},
              {key:'observed',label:'Observed',render:r=><span className="text-wk-text-soft">{when(r.observedAtUtc)}</span>},
              {key:'evidence',label:'Research Evidence',render:r=>
                <div>
                  <span className="text-wk-text-soft">{r.rankStructure==='verified'
                    ?r.rankDepth+' observed '+r.observationType.toLowerCase()
                    :'Original retained; ranks unverified'}</span>
                  <p className="text-xs text-wk-text-muted">{r.note}</p>
                </div>},
            ]} />
          <p className="mt-3 text-xs text-wk-text-muted">
            In Ingest Studio, select WAKILISHA 100 and the EAT week of 26 October 2026
            to review the preserved originals. Opening the studio does not save
            a draft, upload evidence, or change this week's collection status.
          </p>
          <button type="button" className="wk-button wk-button-secondary wk-button-sm mt-3"
            onClick={()=>navigate('/admin/charts/ingest')}>
            Open Ingest Studio
          </button>
        </Card>
    }
    {recoveryTarget&&<SourceRecoveryDialog
      key={recoveryTarget.source.id+':'+recoveryTarget.kind+':'+week+':'+recoveryTarget.revision}
      kind={recoveryTarget.kind} source={recoveryTarget.source}
      week={week} revision={recoveryTarget.revision}
      close={()=>setRecoveryTarget(null)}
      onSaved={()=>{void loadRecovery();void load()}}/>}
    {add&&<SourceProposalForm initial={editing} existing={proposals}
      close={()=>{setAdd(false);setEditing(null)}} onSaved={()=>void loadProposals()}/>}
    {reviewing&&<SourceMethodReviewForm proposal={reviewing}
      previous={methodDecisions.find(d=>d.sourceKey===reviewing.sourceKey)??null}
      initialDecisionState={incidentPause?'paused':'held'}
      close={()=>{setReviewing(null);setIncidentPause(false)}}
      onSaved={()=>{void loadMethods();void load()}}/>}

  </div>;
}
