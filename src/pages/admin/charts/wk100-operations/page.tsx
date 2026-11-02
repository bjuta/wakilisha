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
import { wk100CurrentWeekStartEat, isWk100WeekStartEat } from '../ingest/wk100EatWeek.mjs';
import { WkOperationsHero, WkNextAction, WkReadinessList } from '@/components/design-system/primitives/OperationsWorkspace';
import { WkAuditTimeline } from '@/components/design-system/primitives/AuditTimeline';

type Source = {
  id:string;sourceKey:string;provider:string;surface:string;market:string;
  metric:string;behavior:string;expectedDepth:number;cadence:string;version:string;
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

const catalogue=[
  ['YouTube Kenya','Native chart method qualification required'],
  ['Spotify Kenya','Approved chart method qualification required'],
  ['Boomplay Kenya','Source access and metric verification required'],
  ['Apple Music Kenya','Native API admission and evidence period required'],
  ['Mdundo Kenya','Source access and period verification required'],
  ['Shazam Kenya','Offered chart evidence and period verification required'],
  ['Audiomack Kenya','Source qualification required'],
] as const;
function nextWeek(v:string,n:number) {
  const d=new Date(v+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n*7);
  return d.toISOString().slice(0,10);
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
function AddSource({close}:{close:()=>void}) {
  const [selected,setSelected]=useState('');
  const [step,setStep]=useState(1);
  const item=catalogue.find(x=>x[0]===selected);
  return <Modal open={true} onClose={close} title="Add Source" maxWidth="3xl" footer={<div className="flex justify-between"><button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>step===1?close():setStep(s=>s-1)}>{step===1?'Cancel':'Back'}</button>{step<3?<button type="button" disabled={!selected} className="wk-button wk-button-primary wk-button-sm" onClick={()=>setStep(s=>s+1)}>Continue</button>:<button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={close}>Close review</button>}</div>}>
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-wk-text-muted">Creates a candidate, not a qualified source</p>
      <h3 className="mt-4 text-2xl font-bold text-wk-text">{step===1?'Which provider?':step===2?'Verify the approved surface':'Review source qualification'}</h3>
      <ol aria-label="Add Source steps" className="mt-3 flex flex-wrap gap-2 text-xs text-wk-text-muted"><li className={step===1?'font-bold text-wk-text':''}>1 Provider and method</li><li aria-hidden="true">→</li><li className={step===2?'font-bold text-wk-text':''}>2 Approved surface</li><li aria-hidden="true">→</li><li className={step===3?'font-bold text-wk-text':''}>3 Review</li></ol>
      {step===1?<div className="mt-5 grid gap-2 sm:grid-cols-2">{catalogue.map(([name,desc])=><button key={name} type="button" aria-pressed={selected===name} onClick={()=>setSelected(name)} className={'min-h-[96px] w-full rounded-2xl border p-4 text-left '+(selected===name?'border-wk-brand bg-wk-brand-soft':'border-wk-border hover:bg-wk-surface-raised')}><strong className="block text-sm text-wk-text">{name}</strong><span className="text-xs text-wk-text-muted">{desc}</span></button>)}</div>:
      <div className="mt-4 rounded-xl bg-wk-surface-raised p-4"><h3 className="font-semibold text-wk-text">{item?.[0]}</h3><p className="mt-2 text-sm text-wk-text-muted">{item?.[1]}</p><p className="mt-3 text-sm text-wk-text-muted">{step===2?'A qualified source requires verified market, method, native metric and access authority.':'Source creation is not yet enabled. This review does not create a contract or start collection.'}</p></div>}
    </Modal>;
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
  const [add,setAdd]=useState(false);
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
      <button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>void load()} disabled={phase==='loading'}>Refresh status</button>
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
        <Card title="Collection activity"><WkAuditTimeline ariaLabel="Verified capture activity" emptyLabel="No source attempts recorded for this week." events={report.sources.flatMap(s=>s.recentAttempts.map((a,i)=>({
          id:s.id+':'+(a.id||i),label:s.surface+' · '+a.status.replaceAll('_',' '),
          occurredAt:a.attemptedAt,description:a.failureCode?('Reason: '+a.failureCode):('Observed rows: '+a.observedDepth),
        }))).sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).slice(0,12)}/></Card>
      </div>}
      {view==='sources'&&<div className="space-y-5">
        <WkOperationsHero eyebrow="Programme · Kenya source constitution" title="Sources"
          description="Manage known collection surfaces without conflating technical access, qualification, capture health, and scoring admission."
          aside={<WkStateBadge tone="warning">{report.qualifiedSources} qualified</WkStateBadge>}
          action={<button className="wk-button wk-button-primary wk-button-sm" type="button" onClick={()=>setAdd(true)}>Add Source</button>}/>
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
            ] satisfies WkDataColumn<Source>[]} />
        </Card>
        <Card title="Collection activity">
          <WkAuditTimeline ariaLabel="Collection attempt history" emptyLabel="No collection attempts recorded." events={report.sources.flatMap(s=>s.recentAttempts.map((a,i)=>({
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
    {detail&&<WkInspector open={true} onClose={()=>setDetail(null)} title={detail.surface} eyebrow="Source inspection" summary={<p className="text-sm text-wk-text-muted">{detail.provider} · {detail.market} · {detail.version}</p>}><WkDetailList items={[
        {label:'Provider',value:detail.provider},
        {label:'Market',value:detail.market},
        {label:'Metric',value:detail.metric},
        {label:'Behavior',value:detail.behavior},
        {label:'Version',value:detail.version},
        {label:'Capture state',value:detail.captureState},
        {label:'Attempts',value:detail.attemptCount},
        {label:'Last attempt',value:when(detail.lastAttemptAt)},
        {label:'Last success',value:when(detail.lastSuccessfulAt)},
        {label:'Native period',value:detail.nativePeriodAuthority==='provider_defined'
          ?when(detail.nativePeriodStart)+' to '+when(detail.nativePeriodEnd):'Unverified'},
        {label:'Evidence SHA-256',value:detail.receiptSha256||'No verified receipt'},
        {label:'Failure reason',value:detail.failureCode||'None recorded'},
      ]} /><p className="mt-5 rounded-xl bg-wk-surface-raised p-4 text-sm text-wk-text-muted">Source editing, qualification and retries are held until governed service operations are available. This panel never starts a collection.</p></WkInspector>}
    {add&&<AddSource close={()=>setAdd(false)}/>}
  </div>;
}
