import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminChartsPageHeader } from '../components/AdminChartsPageHeader';
import { WkSurface } from '@/components/design-system/primitives/Surface';
import { WkMetricCard, WkMetricStrip } from '@/components/design-system/primitives/Metric';
import { WkWorkflowRail } from '@/components/design-system/primitives/WorkflowRail';
import { WkInspector } from '@/components/design-system/primitives/Inspector';
import { Sheet } from '@/components/design-system/primitives/Sheet';
import { WkSearchField } from '@/components/design-system/primitives/Field';
import { WkStateBadge } from '@/components/design-system/primitives/StateBadge';
import { wk100CurrentWeekStartEat } from '../ingest/wk100EatWeek.mjs';

type Source = {
  id:string;sourceKey:string;provider:string;surface:string;market:string;
  metric:string;behavior:string;expectedDepth:number;cadence:string;version:string;
  admissionState:string;captureState:string;attemptCount:number;lastAttemptAt:string|null;
  lastSuccessfulAt:string|null;observedDepth:number;nativePeriodAuthority:string;
  nativePeriodStart:string|null;nativePeriodEnd:string|null;receiptSha256:string|null;
  failureCode:string|null;canScore:false;canPublish:false;
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
  return <Sheet open={true} onClose={close} title="Propose Source" side="right" maxWidth="lg" footer={<div className="flex justify-between"><button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>step===1?close():setStep(s=>s-1)}>{step===1?'Cancel':'Back'}</button>{step<3?<button type="button" disabled={!selected} className="wk-button wk-button-primary wk-button-sm" onClick={()=>setStep(s=>s+1)}>Continue</button>:<button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={close}>Close review</button>}</div>}>
      <p className="text-xs font-bold uppercase text-wk-brand">Source candidate · {step} of 3</p>
      {step===1?<div className="mt-4 space-y-2">{catalogue.map(([name,desc])=><button key={name} type="button" aria-pressed={selected===name} onClick={()=>setSelected(name)} className={'w-full rounded-lg border p-3 text-left '+(selected===name?'border-wk-brand bg-wk-brand-soft':'border-wk-border hover:bg-wk-surface-raised')}><strong className="block text-sm text-wk-text">{name}</strong><span className="text-xs text-wk-text-muted">{desc}</span></button>)}</div>:
      <div className="mt-4 rounded-xl bg-wk-surface-raised p-4"><h3 className="font-semibold text-wk-text">{item?.[0]}</h3><p className="mt-2 text-sm text-wk-text-muted">{item?.[1]}</p><p className="mt-3 text-sm text-wk-text-muted">{step===2?'A qualified source requires verified market, method, native metric and access authority.':'Source creation is not yet enabled. This review does not create a contract or start collection.'}</p></div>}
    </Sheet>;
}
export default function Wk100OperationsPage({view}:{view:View}) {
  const navigate=useNavigate();
  const [week,setWeek]=useState(()=>wk100CurrentWeekStartEat());
  const [report,setReport]=useState<Report|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [detail,setDetail]=useState<Source|null>(null);
  const [add,setAdd]=useState(false);
  const load=useCallback(async()=>{
    setPhase('loading');setReport(null);setDetail(null);
    try {
      const {data,error}=await supabase.functions.invoke('wk100-source-admin-read',{body:{action:'read_source_health',weekStartEat:week}});
      if(error||!data||data.schemaVersion!=='wk100-admin-source-health-v1'||data.weekStartEat!==week||
        !Array.isArray(data.sources)||data.canScore!==false||data.canPublish!==false)throw Error();
      setReport(data as Report);setPhase('ready');
    } catch {setPhase('unavailable');}
  },[week]);
  useEffect(()=>{void load()},[load]);
  const sources=useMemo(()=>(report?.sources??[]).filter(s=>
    (status==='all'||(status==='collected'?!!s.receiptSha256:status==='failed'?
      ['transport_failed','parse_failed','target_period_unavailable','missed'].includes(s.captureState):s.captureState==='not_collected'))&&
    (s.surface+' '+s.provider+' '+s.sourceKey).toLowerCase().includes(search.trim().toLowerCase())
  ),[report,search,status]);
  const go=(path:string)=>navigate('/admin/charts/wk100-operations'+path);
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
      <WkMetricStrip>{[['Registered candidates',report.sourceCount],['Qualified sources',report.qualifiedSources],['Verified captures',report.successfulSources],['Collection failures',report.failedSources]].map(([name,value])=><WkMetricCard key={name} label={name} value={value}/>)}</WkMetricStrip>
      {view==='overview'&&<div className="grid gap-3 lg:grid-cols-2">
        <Card title="Weekly Research"><p className="text-sm text-wk-text-muted">{report.sourceCount===0?'No source capture contracts have been enrolled.':report.successfulSources+' of '+report.sourceCount+' candidates have a verified private capture this week.'}</p><button type="button" onClick={()=>go('/collection')} className="wk-button wk-button-secondary wk-button-sm mt-3">Review Collection</button></Card>
        <Card title="Next Action"><p className="text-sm text-wk-text-muted">Qualify source methods and establish the approved collection roster. Ranking and publication remain held.</p><button type="button" onClick={()=>go('/sources')} className="wk-button wk-button-secondary wk-button-sm mt-3">Review Sources</button></Card>
      </div>}
      {view==='sources'&&<>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-wk-text-muted">Only registered capture contracts appear as live sources.</p><button className="wk-button wk-button-secondary wk-button-sm" type="button" onClick={()=>setAdd(true)}>Propose Source</button></div>
        <Card title="Registered Sources">
          <div className="mb-4 flex flex-wrap gap-2"><WkSearchField ariaLabel="Search sources" placeholder="Search source" value={search} onChange={setSearch} className="min-w-40 flex-1"/><select aria-label="Collection state" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-sm text-wk-text"><option value="all">All states</option><option value="collected">Collected</option><option value="failed">Failed</option><option value="not_collected">Not collected</option></select></div>
          {!sources.length?<p className="rounded-xl bg-wk-surface-raised p-5 text-sm text-wk-text-muted">{report.sourceCount===0?'No source capture contracts exist yet. Propose a source to inspect the expected qualification requirements.':'No sources match the selected filters.'}</p>:<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-wk-border text-wk-text-muted">{['Source','Metric','Qualification','Collection','Last verified'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{sources.map(s=><tr className="border-b border-wk-border/60" key={s.id}><td className="p-3"><button className="font-semibold text-wk-text hover:underline" type="button" onClick={()=>setDetail(s)}>{s.surface}</button><p className="text-wk-text-muted">{s.provider} · {s.sourceKey}</p></td><td className="p-3 text-wk-text-soft">{s.metric} · {s.expectedDepth}</td><td className="p-3"><WkStateBadge>Candidate</WkStateBadge></td><td className="p-3"><WkStateBadge tone={['transport_failed','parse_failed','missed','target_period_unavailable'].includes(s.captureState)?'danger':'neutral'}>{s.captureState.replaceAll('_',' ')}</WkStateBadge></td><td className="p-3 text-wk-text-muted">{when(s.lastSuccessfulAt)}</td></tr>)}</tbody></table></div>}
        </Card>
      </>}
      {view==='collection'&&<Card title="Collection Status"><p className="mb-4 text-xs text-wk-text-muted">A successful source download is not automatic admission to scoring. Provider-native periods remain separately verifiable.</p>{report.sources.length===0?<p className="rounded-xl bg-wk-surface-raised p-5 text-sm text-wk-text-muted">No collection contracts or attempts exist for the selected week. Scheduled collection and retry controls will become available only through a governed service.</p>:<div className="space-y-2">{report.sources.map(s=><button key={s.id} type="button" onClick={()=>setDetail(s)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-wk-border p-4 text-left hover:bg-wk-surface-raised"><span><strong className="block text-sm text-wk-text">{s.surface}</strong><span className="text-xs text-wk-text-muted">{s.observedDepth}/{s.expectedDepth} observed · {s.nativePeriodAuthority==='provider_defined'?'Provider-defined period':'Native period unknown'}</span></span><span className="text-xs text-wk-text-muted">{s.captureState.replaceAll('_',' ')}</span></button>)}</div>}</Card>}
      {view==='overview'&&<Card title="Publication Readiness"><p className="text-sm text-wk-text-muted">Private evidence collection, full eligibility evaluation, actual ranking and publication authority have not been accepted as a complete weekly workflow. No publication operation is available here.</p></Card>}
    </>}
    {detail&&<WkInspector open={true} onClose={()=>setDetail(null)} title={detail.surface} eyebrow="Source inspection" summary={<p className="text-sm text-wk-text-muted">{detail.provider} · {detail.market} · {detail.version}</p>}><dl className="mt-5 space-y-3">{[['Provider',detail.provider],['Market',detail.market],['Metric',detail.metric],['Behavior',detail.behavior],['Version',detail.version],['Capture state',detail.captureState],['Attempts',String(detail.attemptCount)],['Last attempt',when(detail.lastAttemptAt)],['Last success',when(detail.lastSuccessfulAt)],['Native period',detail.nativePeriodAuthority==='provider_defined'?when(detail.nativePeriodStart)+' to '+when(detail.nativePeriodEnd):'Unverified'],['Evidence SHA-256',detail.receiptSha256||'No verified receipt'],['Failure reason',detail.failureCode||'None recorded']].map(([k,v])=><div key={k} className="border-b border-wk-border pb-2"><dt className="text-xs text-wk-text-muted">{k}</dt><dd className="break-all text-sm font-semibold text-wk-text">{v}</dd></div>)}</dl><p className="mt-5 rounded-xl bg-wk-surface-raised p-4 text-sm text-wk-text-muted">Source editing, qualification and retries are held until governed service operations are available. This panel never starts a collection.</p></WkInspector>}
    {add&&<AddSource close={()=>setAdd(false)}/>}
  </div>;
}
