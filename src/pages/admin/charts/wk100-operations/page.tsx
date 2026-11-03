import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminChartsPageHeader } from '../components/AdminChartsPageHeader';
import { WkSurface } from '@/components/design-system/primitives/Surface';
import { WkMetricCard, WkMetricStrip } from '@/components/design-system/primitives/Metric';
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
import { WkOperationsHero, WkNextAction, WkReadinessList } from '@/components/design-system/primitives/OperationsWorkspace';
import { WkAuditTimeline } from '@/components/design-system/primitives/AuditTimeline';
import { SourceProposalForm, type Wk100ProposalRecord } from './SourceProposalForm';
import { SourceMethodReviewForm, type Wk100MethodDecision } from './SourceMethodReviewForm';

type Source = {
  id:string;sourceKey:string;provider:string;surface:string;market:string;
  metric:string;behavior:string;expectedDepth:number;cadence:string;version:string;
  intervalHours:number|null;eatHour:number|null;eatMinute:number|null;
  weekdayEat:number|null;minimumHealthyCheckpoints:number;adapterVersion:string;
  admissionState:string;captureState:string;attemptCount:number;lastAttemptAt:string|null;
  lastSuccessfulAt:string|null;observedDepth:number;nativePeriodAuthority:string;
  nativePeriodStart:string|null;nativePeriodEnd:string|null;receiptSha256:string|null;
  failureCode:string|null;canScore:false;canPublish:false;
  recentAttempts:{id:string;status:string;attemptedAt:string|null;fetchedAt:string|null;failureCode:string|null;observedDepth:number}[];
};
type Report = {schemaVersion:string;weekStartEat:string;sourceCount:number;
  successfulSources:number;failedSources:number;qualifiedSources:number;
  canScore:false;canPublish:false;sources:Source[]};
type View = 'overview'|'sources'|'collection';
const CORE_PROVIDERS=[
  {key:'youtube_ke',label:'YouTube Kenya'},
  {key:'spotify_ke',label:'Spotify Kenya'},
  {key:'boomplay_ke',label:'Boomplay Kenya'},
  {key:'apple_ke',label:'Apple Music Kenya'},
  {key:'mdundo_ke',label:'Mdundo Kenya'},
  {key:'shazam_ke',label:'Shazam Kenya'},
] as const;
type ProviderReadiness={
  key:string;label:string;proposalCount:number;decisionCount:number;
  state:string;next:string;focus:Wk100ProposalRecord|null;
};


function nextWeek(v:string,n:number) {
  const d=new Date(v+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n*7);
  return d.toISOString().slice(0,10);
}
// An immutable candidate contract describes intended timing, not an active scheduler.
function candidateCadence(s:Source) {
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
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [providerFilter,setProviderFilter]=useState('all');
  const [metricFilter,setMetricFilter]=useState('all');
  const [detail,setDetail]=useState<Source|null>(null);
  const [detailTab,setDetailTab]=useState<'configuration'|'qualification'|'history'>('configuration');
  const [add,setAdd]=useState(false);
  const [editing,setEditing]=useState<Wk100ProposalRecord|null>(null);
  const [proposals,setProposals]=useState<Wk100ProposalRecord[]>([]);
  const [proposalPhase,setProposalPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [reviewing,setReviewing]=useState<Wk100ProposalRecord|null>(null);
  const [incidentPause,setIncidentPause]=useState(false);
  const [methodDecisions,setMethodDecisions]=useState<Wk100MethodDecision[]>([]);
  const [methodPhase,setMethodPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
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
    if(view==='sources'||view==='collection'){void loadProposals();void loadMethods()}
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
  const sources=useMemo(()=>(report?.sources??[]).filter(s=>
    (status==='all'||(status==='collected'?!!s.receiptSha256:status==='failed'?
      ['transport_failed','parse_failed','target_period_unavailable','missed'].includes(s.captureState):s.captureState==='not_collected'))&&
    (providerFilter==='all'||s.provider===providerFilter)&&
    (metricFilter==='all'||s.metric===metricFilter)&&
    (s.surface+' '+s.provider+' '+s.sourceKey).toLowerCase().includes(search.trim().toLowerCase())
  ),[report,search,status,providerFilter,metricFilter]);
  const go=(path:string)=>navigate('/admin/charts/wk100-operations'+path+'?week='+encodeURIComponent(week));
  return <div className="space-y-5">
    <AdminChartsPageHeader eyebrow="WAKILISHA 100 / Kenya" title={view==='overview'?'Weekly Overview':view==='sources'?'Source Registry':'Collection & Incidents'} description="Private source evidence and operational readiness for the selected EAT week.">
      <button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>{void load();if(view==='sources'){void loadProposals();void loadMethods()}}} disabled={phase==='loading'}>Refresh status</button>
    </AdminChartsPageHeader>
    <WkSurface className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
      <div className="flex items-center gap-2"><button type="button" className="wk-button wk-button-secondary wk-button-sm" aria-label="Previous week" onClick={()=>setWeek(v=>nextWeek(v,-1))}>‹</button><div className="min-w-40 text-center"><p className="text-xs text-wk-text-muted">Edition week · Monday EAT</p><p className="text-sm font-bold text-wk-text">{week}</p></div><button type="button" className="wk-button wk-button-secondary wk-button-sm" aria-label="Next week" onClick={()=>setWeek(v=>nextWeek(v,1))}>›</button></div>
      <span className="rounded-full border border-wk-border px-3 py-1 text-xs font-semibold text-wk-text-soft">Research only · Publication locked</span>
    </WkSurface>
    <WkWorkflowRail ariaLabel="Chart operations stages" steps={['Collect','Identify','Qualify','Rank','Publish'].map((label,i)=>({id:label.toLowerCase(),label,description:i===0?'Current phase':'Not operational',state:i===0?'current' as const:'blocked' as const}))}/>
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
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <WkNextAction title={report.sourceCount===0?'Establish the qualified source roster':'Review captured source evidence'}
            blocked={report.sourceCount===0}
            description={report.sourceCount===0?'No source capture contracts have been enrolled. Begin with method qualification and an approved Source Registry.':'Inspect source-specific captures, reporting periods, and validation outcomes before advancing this week.'}
            action={<button type="button" className="wk-button wk-button-primary wk-button-sm" onClick={()=>go(report.sourceCount===0?'/sources':'/collection')}>{report.sourceCount===0?'Review Sources':'Review Collection'}</button>}
            secondary={<button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>go('/collection')}>Why collection is held</button>}/>
          <Card title="Readiness">
            <WkReadinessList items={[
              {id:'sources',label:'Qualified source constitution',status:'blocked',description:report.qualifiedSources+' qualified sources for this week'},
              {id:'receipts',label:'Verified weekly captures',status:report.successfulSources?'pending':'blocked',description:report.successfulSources+' verifiable original evidence receipts'},
              {id:'period',label:'Native measurement periods',status:'pending',description:'A successful capture alone does not prove an eligible source period'},
              {id:'ranking',label:'Private ranking and publication',status:'blocked',description:'The scoring and publisher remain separately controlled'},
            ]}/>
          </Card>
        </div>
        <section aria-label="This week" className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-[.12em] text-wk-text-muted">This week</h2>
          <WkMetricStrip>{[['Registered candidates',report.sourceCount],['Qualified sources',report.qualifiedSources],['Verified captures',report.successfulSources],['Collection failures',report.failedSources]].map(([name,value])=><WkMetricCard key={name} label={name} value={value}/>)}</WkMetricStrip>
        </section>
        <Card title="Collection activity"><WkAuditTimeline locale="en-KE" timeZone="Africa/Nairobi" ariaLabel="Verified capture activity" emptyLabel="No source attempts recorded for this week." events={report.sources.flatMap(s=>s.recentAttempts.map((a,i)=>({
          id:s.id+':'+(a.id||i),label:s.surface+' · '+a.status.replaceAll('_',' '),
          occurredAt:a.attemptedAt,description:a.failureCode?('Reason: '+a.failureCode):('Observed rows: '+a.observedDepth),
        }))).sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).slice(0,12)}/></Card>
      </div>}
      {view==='sources'&&<div className="space-y-5">
        <WkOperationsHero eyebrow="Programme · Kenya source constitution" title="Sources"
          description="Manage known collection surfaces without conflating technical access, qualification, capture health, and scoring admission."
          aside={<WkStateBadge tone="warning">{report.qualifiedSources} qualified</WkStateBadge>}
          action={<button className="wk-button wk-button-primary wk-button-sm" type="button" onClick={()=>{setEditing(null);setAdd(true)}}>Add Source</button>}/>
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
          <button type="button" className="wk-button wk-button-secondary wk-button-sm mt-3"
            onClick={()=>navigate('/admin/charts/ingest')}>
            Open Research Evidence
          </button>
        </Card>
        <Card title="Core Provider Readiness">
          <p className="mb-3 text-xs leading-relaxed text-wk-text-muted">
            Six Kenya platforms are in scope for future collection. The following
            source proposals and method decisions are separate from factual research.
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
              ariaLabel="Six core provider readiness" empty="No core providers configured."
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
        <Card title="Source Registry">
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(130px,160px))]">
            <WkSearchField ariaLabel="Search provider or source" placeholder="Provider or source" value={search} onChange={setSearch}/>
            <WkSelect ariaLabel="Filter provider" value={providerFilter} onChange={setProviderFilter}
              options={[{value:'all',label:'All providers'},...Array.from(new Set((report?.sources??[]).map(s=>s.provider))).filter(Boolean).map(v=>({value:v,label:v}))]}/>
            <WkSelect ariaLabel="Filter health" value={status} onChange={setStatus}
              options={[{value:'all',label:'All health states'},{value:'collected',label:'Captured'},{value:'failed',label:'Failing'},{value:'not_collected',label:'Unknown'}]}/>
            <WkSelect ariaLabel="Filter metric" value={metricFilter} onChange={setMetricFilter}
              options={[{value:'all',label:'All metrics'},...Array.from(new Set((report?.sources??[]).map(s=>s.metric))).filter(Boolean).map(v=>({value:v,label:v}))]}/>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-wk-text-muted">
            <span>Registered candidates · {report.sourceCount} · No sources admitted to the scoring constitution</span>
            <span>All changes require verified source-method authority</span>
          </div>
          <WkDataTable<Source> rows={sources} getKey={s=>s.id} ariaLabel="Source registry"
            empty={report.sourceCount===0?'No source capture contracts are registered. Add Source explains the supported qualification steps.':'No sources match these filters.'}
            columns={[
              {key:'source',label:'Source · operator',render:s=><>
                <button type="button" className="font-semibold text-wk-text underline-offset-2 hover:underline" onClick={()=>setDetail(s)}>{s.surface}</button>
                <p className="mt-1 text-xs text-wk-text-muted">{s.provider} · {s.sourceKey}</p>
              </>},
              {key:'metric',label:'Metric · period · depth',render:s=><span className="text-wk-text-soft">{s.metric} · {s.nativePeriodAuthority==='provider_defined'?'Defined':'Unverified'} · {s.expectedDepth}</span>},
              {key:'cadence',label:'Candidate Timing',render:s=><span className="text-wk-text-soft">{candidateCadence(s)}</span>},
              {key:'qualification',label:'Qualification',render:()=> <WkStateBadge>Candidate</WkStateBadge>},
              {key:'health',label:'Health',render:s=><WkStateBadge tone={['transport_failed','parse_failed','missed','target_period_unavailable'].includes(s.captureState)?'danger':s.receiptSha256?'success':'neutral'}>{['transport_failed','parse_failed','missed','target_period_unavailable'].includes(s.captureState)?'Failing':s.receiptSha256?'Captured':'Unknown'}</WkStateBadge>},
              {key:'last',label:'Last success',render:s=><span className="text-wk-text-muted">{when(s.lastSuccessfulAt)}</span>},
              {key:'constitution',label:'Constitution',render:()=> <span className="text-xs text-wk-text-muted">Not admitted</span>},
            ] satisfies WkDataColumn<Source>[]} />
        </Card>
      </div>}
      {view==='collection'&&<div className="space-y-5">
        <WkOperationsHero eyebrow={'Collection · EAT week '+week} title="Collection"
          description="Source-specific reporting periods, captured evidence and attempt integrity are tracked separately. A successful download does not grant scoring qualification."
          aside={<WkStateBadge tone={report.failedSources?'danger':'neutral'}>{report.failedSources?report.failedSources+' source failures':'No admitted collection'}</WkStateBadge>}
          action={<div className="flex flex-wrap gap-2">
            <button type="button" disabled title="Coverage exceptions need an accepted policy workflow" className="wk-button wk-button-secondary wk-button-sm">Request Coverage Exception</button>
            <button type="button" disabled title="Source retry requires a governed capture command" className="wk-button wk-button-secondary wk-button-sm">Request Retry</button>
          </div>}/>
        <WkSurface className="rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[.1em] text-wk-text-muted">Qualified coverage</p>
              <p className="mt-2 text-xl font-bold text-wk-text">{report.qualifiedSources} qualified sources</p>
              <p className="mt-1 text-sm text-wk-text-muted">{report.successfulSources} capture receipts across {report.sourceCount} candidate contracts. These do not establish admitted coverage.</p>
            </div><WkStateBadge tone="warning">Not ready for ranking</WkStateBadge>
          </div>
          <div aria-label="Qualified coverage progress" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}
            className="mt-4 h-2 overflow-hidden rounded-full bg-wk-surface-raised"><div className="h-full w-0 bg-wk-brand"/></div>
        </WkSurface>
        <Card title="Source collection">
          <WkDataTable<Source> rows={report.sources} getKey={s=>s.id} ariaLabel="Weekly source collection"
            empty="No source capture contracts or attempts exist for this week. Collection scheduling has not been enabled."
            columns={[
              {key:'source',label:'Source · reporting period',render:s=><><button type="button" className="font-semibold text-wk-text hover:underline" onClick={()=>setDetail(s)}>{s.surface}</button><p className="mt-1 text-xs text-wk-text-muted">{s.nativePeriodAuthority==='provider_defined'?'Provider-defined period':'Native period unknown'}</p></>},
              {key:'depth',label:'Rows observed',render:s=><span className="font-semibold tabular-nums text-wk-text">{s.observedDepth} <span className="font-normal text-wk-text-muted">of {s.expectedDepth}</span></span>},
              {key:'attempt',label:'Latest attempt',render:s=><span className="text-wk-text-muted">{when(s.lastAttemptAt)}</span>},
              {key:'receipt',label:'Validation · receipt',render:s=><span className="text-wk-text-muted">{s.receiptSha256?'SHA-256 verified':'No verified receipt'}</span>},
              {key:'status',label:'Status',render:s=><WkStateBadge tone={['transport_failed','parse_failed','target_period_unavailable','missed'].includes(s.captureState)?'danger':s.receiptSha256?'info':'neutral'}>{s.captureState.replaceAll('_',' ')}</WkStateBadge>},
              {key:'control',label:'Incident Control',render:s=>{
                const decision=methodDecisions.find(d=>d.sourceKey===s.sourceKey);
                const proposal=proposals.find(p=>p.sourceKey===s.sourceKey);
                if(methodPhase!=='ready'||proposalPhase!=='ready')
                  return <span className="text-xs text-wk-text-muted">Controls unavailable</span>;
                if(decision?.decisionState==='paused')
                  return <WkStateBadge tone="warning">Paused</WkStateBadge>;
                if(decision?.decisionState!=='collector_admitted'||!proposal||
                   proposal.revision!==decision.proposalRevision)
                  return <span className="text-xs text-wk-text-muted">No current admitted method</span>;
                return <button type="button" className="wk-button wk-button-secondary wk-button-sm"
                  onClick={()=>{setIncidentPause(true);setReviewing(proposal)}}>
                  Pause Collection
                </button>;
              }},
            ] satisfies WkDataColumn<Source>[]} />
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
      </div>}
    </>}
    {detail&&<WkInspector open={true} onClose={()=>setDetail(null)} title={detail.surface}
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
            {id:'native',label:'Native measurement period',status:detail.nativePeriodAuthority==='provider_defined'?'pending':'blocked',description:'Period evidence must be evaluated against the approved week'},
            {id:'score',label:'Scoring authority',status:'blocked',description:'Candidate capture contracts do not grant scoring authority'},
          ]}/>
        </div>}
        {detailTab==='history'&&<div className="space-y-4">
          <WkDetailList items={[
            {label:'Most recent attempt',value:when(detail.lastAttemptAt)},
            {label:'Last successful capture',value:when(detail.lastSuccessfulAt)},
            {label:'Observed depth',value:detail.observedDepth},
            {label:'Verified digest',value:detail.receiptSha256||'No private evidence receipt'},
            {label:'Safe failure code',value:detail.failureCode||'None recorded'},
          ]}/>
          <WkAuditTimeline locale="en-KE" timeZone="Africa/Nairobi" ariaLabel="Source capture attempts" emptyLabel="No attempts have been recorded for this week."
            events={detail.recentAttempts.map((a,i)=>({
              id:a.id||String(i),label:a.status.replaceAll('_',' '),occurredAt:a.attemptedAt,
              description:a.failureCode?'Reason: '+a.failureCode:'Observed rows: '+a.observedDepth,
            }))}/>
        </div>}
      </WkTabs>
      <p className="mt-5 rounded-xl bg-wk-surface-raised p-4 text-xs leading-relaxed text-wk-text-muted">
        Source settings, qualification, retries, and coverage exceptions require separately accepted governed commands. This inspection view does not modify the capture ledger.
      </p>
    </WkInspector>}
    {add&&<SourceProposalForm initial={editing} existing={proposals}
      close={()=>{setAdd(false);setEditing(null)}} onSaved={()=>void loadProposals()}/>}
    {reviewing&&<SourceMethodReviewForm proposal={reviewing}
      previous={methodDecisions.find(d=>d.sourceKey===reviewing.sourceKey)??null}
      initialDecisionState={incidentPause?'paused':'held'}
      close={()=>{setReviewing(null);setIncidentPause(false)}}
      onSaved={()=>{void loadMethods();void load()}}/>}

  </div>;
}
