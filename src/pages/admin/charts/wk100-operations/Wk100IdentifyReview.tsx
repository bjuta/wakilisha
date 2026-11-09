import {useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {supabase} from '@/lib/supabase';
import {WkSurface} from '@/components/design-system/primitives/Surface';
import {WkSelect} from '@/components/design-system/primitives/Select';
import {WkSearchField} from '@/components/design-system/primitives/Field';
import {WkDataTable} from '@/components/design-system/primitives/DataTable';
import {WkStateBadge} from '@/components/design-system/primitives/StateBadge';
import {WkDetailList} from '@/components/design-system/primitives/DetailList';
import {compareWk100EligibilityRechecks} from '@/services/chartsIngestion/wk100EligibilityRecheck.mjs';

type Receipt={id:string;status:string;attemptedAt:string|null;observedDepth:number};
type Source={
  id:string;sourceKey:string;surface:string;provider:string;expectedDepth:number;
  recentAttempts:Receipt[];
};
type Row={
  captureRowId:string;rank:number;observedTitle:string|null;observedArtist:string|null;
  providerTrackId:string|null;canonicalTrackId:string|null;
  identityState:'resolved'|'needs_review'|'conflicting'|'inactive';
  reviewReason:string|null;provisionalRef:string|null;
  outcome?:'ELIGIBLE'|'EXCLUDED'|'REVIEW_REQUIRED'|'CONFLICTED';reasonCodes?:string[];
  registryTrackSlug?:string|null;registryReleaseSlug?:string|null;
  registryArtistSlugs?:string[];registryFactsSha256?:string;
};
type Review={
  schemaVersion:'wk100-admin-identify-observations-v1'|'wk100-admin-eligibility-preview-v1';
  weekStartEat:string;contractId:string;receiptId:string;sourceKey:string;
  registryProviderKey?:string;receiptStatus:string;observedDepth:number;
  configRevision?:number;eligibilityProfileName?:string;marketScopeName?:string;
  policySha256?:string;counts?:Record<'ELIGIBLE'|'EXCLUDED'|'REVIEW_REQUIRED'|'CONFLICTED',number>;
  expectedDepth:number;payloadSha256:string;originalReadbackInThisRequest?:false;
  totals?:{observed:number;resolved:number;needsReview:number;conflicting:number;inactive:number};
  rows:Row[];canWriteRegistry:false;canScore:false;canPublish:false;
};
const eligible=(attempt:Receipt)=>['succeeded','partial_depth'].includes(attempt.status);
const readableStatus:Record<Row['identityState'],string>={
  resolved:'Linked recording',
  needs_review:'Needs review',
  conflicting:'Conflicting links',
  inactive:'Inactive recording',
};
const reasonLabel:Record<string,string>={
  provider_identity_unavailable:'No provider recording ID',
  provider_link_missing:'No confirmed Registry link',
  conflicting_registry_links:'More than one confirmed link',
  linked_track_not_active:'Linked Registry Track is inactive',
};
function when(value:string|null){
  if(!value)return 'Unknown time';
  const date=new Date(value);
  return Number.isFinite(date.valueOf())
    ?new Intl.DateTimeFormat('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'}).format(date)+' EAT'
    :'Unknown time';
}
export function Wk100IdentifyReview({week,sources,stage='identify'}:{week:string;sources:Source[];stage?:'identify'|'qualify'}){
  const qualify=stage==='qualify';
  const navigate=useNavigate();
  const selectable=useMemo(()=>sources.filter(s=>s.recentAttempts.some(eligible)),[sources]);
  const [sourceId,setSourceId]=useState('');
  const [receiptId,setReceiptId]=useState('');
  const [review,setReview]=useState<Review|null>(null);
  const [phase,setPhase]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [readNonce,setReadNonce]=useState(0);
  const [comparison,setComparison]=useState<{
    changedCount:number;evaluatedRows:number;changed:{
      captureRowId:string;rank:number;observedTitle:string|null;
      beforeOutcome:string;afterOutcome:string;beforeReasons:string[];
      afterReasons:string[];factsChanged:boolean;outcomeChanged:boolean;
    }[];
  }|null>(null);
  const [reviewError,setReviewError]=useState<'changed'|'unavailable'>('unavailable');
  const beforeRecheck=useRef<Review|null>(null);
  const sequence=useRef(0);
  const source=selectable.find(s=>s.id===sourceId);
  const receipts=source?.recentAttempts.filter(eligible)??[];
  useEffect(()=>{
    const seq=++sequence.current;
    setReview(null);setComparison(null);
    setSearch('');setFilter('all');
    if(!source||!receipts.some(r=>r.id===receiptId)){
      setPhase('idle');return;
    }
    setPhase('loading');
    void (async()=>{
      try{
        const {data,error}=await supabase.functions.invoke('wk100-source-admin-read',{
          body:{action:qualify?'preview_recording_eligibility':'read_recording_observations',
            weekStartEat:week,contractId:source.id,receiptId},
        });
        if(error||!data||data.schemaVersion!==(qualify?'wk100-admin-eligibility-preview-v1':'wk100-admin-identify-observations-v1')||
          data.weekStartEat!==week||data.contractId!==source.id||data.receiptId!==receiptId||
          data.sourceKey!==source.sourceKey||!Array.isArray(data.rows)||
          data.rows.length!==data.observedDepth||
          (qualify?(!data.counts||Object.values(data.counts).reduce((n:number,v:unknown)=>n+(typeof v==='number'?v:0),0)!==data.rows.length):
            data.totals?.observed!==data.rows.length)||
          (qualify&&!data.rows.every((r:Row)=>/^[a-f0-9]{64}$/.test(r.registryFactsSha256??'')))||
          data.canWriteRegistry!==false||data.canScore!==false||data.canPublish!==false)
          throw Error('identity_response_invalid');
        if(seq===sequence.current){
          if(qualify&&beforeRecheck.current){
            const previous=beforeRecheck.current;
            beforeRecheck.current=null;
            try{setComparison(compareWk100EligibilityRechecks(previous,data));}
            catch{setReviewError('changed');setPhase('unavailable');return;}
          }
          setReview(data as Review);setPhase('ready');
        }
      }catch{
        if(seq===sequence.current){beforeRecheck.current=null;setReviewError('unavailable');setPhase('unavailable');}
      }
    })();
    return ()=>{sequence.current+=1;};
    // Receipt selection is explicit. No current-week source is selected
    // automatically for identification or downstream ranking.
  },[sourceId,receiptId,readNonce,week,sources,qualify]);
  const rows=useMemo(()=>review?.rows.filter(row=>
    (filter==='all'||(qualify?row.outcome===filter:row.identityState===filter))&&
    (!search||[
      row.observedTitle,row.observedArtist,row.providerTrackId,
      row.canonicalTrackId,String(row.rank),row.reasonCodes?.join(' '),
    ].some(v=>v?.toLowerCase().includes(search.trim().toLowerCase()))))??[],
    [review,filter,search,qualify]);
  return <section data-wk-identify-review className="space-y-5" aria-label={qualify?"Eligibility review":"Recording review"}>
    <WkSurface className="rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wk-text-muted">{qualify?"Qualify / W5 / Kenya":"Identify / W4 / Kenya"}</p>
          <h2 className="mt-1 text-xl font-bold text-wk-text">{qualify?"Eligibility Workbench":"Recording Review"}</h2>
          <p className="mt-2 max-w-3xl text-sm text-wk-text-muted">
            {qualify
              ?'Check every captured position against this week’s saved eligibility rules. Missing Registry facts need review.'
              :'Inspect the observed positions and exact Registry links. Similar titles do not establish recording identity.'}
          </p>
        </div>
        <WkStateBadge tone="warning">Private review only</WkStateBadge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-wk-text-muted">Captured source</p>
          <WkSelect ariaLabel="Captured source" value={sourceId} onChange={value=>{
            beforeRecheck.current=null;setSourceId(value);setReceiptId('');
          }} options={[{value:'',label:'Choose a source'},
            ...selectable.map(s=>({value:s.id,label:s.surface}))]}/>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-wk-text-muted">Exact source receipt</p>
          <WkSelect ariaLabel="Exact source receipt" value={receiptId} disabled={!source}
            onChange={value=>{beforeRecheck.current=null;setReceiptId(value);}} options={[{value:'',label:'Choose a receipt'},
              ...receipts.map(r=>({value:r.id,label:r.status.replaceAll('_',' ')+' · '+when(r.attemptedAt)}))]}/>
        </div>
      </div>
      {selectable.length===0&&<p role="status" className="mt-4 text-sm text-wk-text-muted">
        No captured source originals are available for this EAT week. Return to Collection to inspect the evidence.
      </p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>navigate('/admin/charts/wk100-operations/collection?week='+encodeURIComponent(week))}>
          View collection evidence
        </button>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>navigate('/admin/review/mizizi')}>Open MIZIZI review</button>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>navigate('/admin/registry/tracks')}>Open Registry Tracks</button>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          disabled={!source||!receiptId||phase==='loading'}
          onClick={()=>{beforeRecheck.current=null;setReadNonce(x=>x+1);}}>Refresh selected receipt</button>
      </div>
    </WkSurface>
    {phase==='loading'&&<WkSurface className="rounded-xl p-4">
      <p role="status" className="text-sm text-wk-text-muted">{qualify?"Checking saved eligibility rules and Registry evidence…":"Checking exact recording links…"}</p>
    </WkSurface>}
    {phase==='unavailable'&&<WkSurface className="rounded-xl p-4">
      <p role="alert" className="text-sm text-wk-danger">
        {reviewError==='changed'
          ?'The source evidence or saved Edition policy changed. Start a new review before comparing results.'
          :qualify
          ?'We couldn’t verify this week’s saved eligibility policy and Registry evidence. No result is accepted. Retry the read.'
          :'We couldn’t verify this receipt or its Registry links. No recording is assumed matched. Retry the read.'}
      </p>
    </WkSurface>}
    {phase==='ready'&&review&&<>
      {qualify&&<WkSurface className="rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-bold text-wk-text">Review Corrections</h3>
            <p className="mt-1 text-sm text-wk-text-muted">
              Open the Registry editor for a linked Track, or investigate a missing link.
              Return here after saving any corrections to compare the same source receipt.
            </p></div>
          <button type="button" className="wk-button wk-button-primary wk-button-sm"
            onClick={()=>{beforeRecheck.current=review;setReadNonce(x=>x+1);}}>
            Re-evaluate After Corrections
          </button>
        </div>
        {comparison&&<div data-wk-eligibility-recheck className="mt-4 space-y-3" role="status">
          <p className="text-sm font-semibold text-wk-text">
            {comparison.changedCount===0
              ?'No changes to Registry facts or eligibility results.'
              :comparison.changedCount+' of '+comparison.evaluatedRows+' positions changed.'}
          </p>
          {comparison.changedCount>0&&<WkDataTable
            ariaLabel="WAKILISHA 100 eligibility changes" rows={comparison.changed}
            getKey={r=>r.captureRowId}
            columns={[
              {key:'rank',label:'Rank',render:r=>r.rank},
              {key:'title',label:'Observed title',render:r=>r.observedTitle??'Title not supplied'},
              {key:'outcome',label:'Before and after',render:r=>
                <span>{r.beforeOutcome.replaceAll('_',' ')} → {r.afterOutcome.replaceAll('_',' ')}</span>},
              {key:'reasons',label:'What changed',render:r=><span>
                {r.factsChanged?'Registry facts changed. ':''}
                {r.outcomeChanged?'Eligibility result changed. ':''}
                {r.afterReasons.map(x=>x.replaceAll('_',' ')).join('; ')||'No rule failures'}
              </span>},
            ]}/>}
          <p className="text-xs text-wk-text-muted">
            This is a comparison, not an approval. The original source receipt and Edition policy remain unchanged.
          </p>
        </div>}
      </WkSurface>}
      <WkSurface className="rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h3 className="text-base font-bold text-wk-text">{qualify?"Eligibility Review":"Identity Coverage"}</h3>
            <p className="mt-1 text-xs text-wk-text-muted">
              {qualify
                ?'All captured positions use this week’s saved policy and current Registry facts. Passing rules does not authorize ranking.'
                :'Exact provider links only. The receipt digest remains unchanged. This read does not authorize ranking.'}
            </p></div>
          <WkStateBadge tone="warning">
            {review.receiptStatus==='partial_depth'?'Partial source evidence':'Candidate source evidence'}
          </WkStateBadge>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <WkDetailList items={qualify?[
            {label:'Observed positions',value:review.observedDepth},
            {label:'Expected positions',value:review.expectedDepth},
            {label:'Rules met (not approved)',value:review.counts?.ELIGIBLE??0},
            {label:'Excluded by policy',value:review.counts?.EXCLUDED??0},
            {label:'Needs review',value:review.counts?.REVIEW_REQUIRED??0},
            {label:'Conflicting evidence',value:review.counts?.CONFLICTED??0},
          ]:[
            {label:'Observed positions',value:review.totals?.observed??0},
            {label:'Expected positions',value:review.expectedDepth},
            {label:'Confirmed active Registry links',value:review.totals?.resolved??0},
            {label:'Needs review',value:review.totals?.needsReview??0},
            {label:'Conflicting links',value:review.totals?.conflicting??0},
            {label:'Inactive linked Tracks',value:review.totals?.inactive??0},
          ]}/>
          <WkDetailList items={[
            {label:'Source key',value:review.sourceKey},
            {label:'Capture receipt',value:review.receiptId},
            {label:'Original SHA-256',value:review.payloadSha256},
            {label:qualify?'Eligibility profile':'Registry provider namespace',
              value:qualify?review.eligibilityProfileName??'Unavailable':review.registryProviderKey??'Unknown'},
            ...(qualify?[
              {label:'Edition revision',value:review.configRevision??0},
              {label:'Policy SHA-256',value:review.policySha256??'Unavailable'},
            ]:[]),
          ]}/>
        </div>
      </WkSurface>
      <WkSurface className="rounded-xl p-4 sm:p-5">
        <h3 className="text-base font-bold text-wk-text">{qualify?"Eligibility Results":"Source Recording Observations"}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <WkSearchField value={search} onChange={setSearch} ariaLabel="Search source recordings"
            placeholder="Search title, artist, source ID, or rank"/>
          <WkSelect value={filter} onChange={setFilter} ariaLabel={qualify?'Eligibility outcome':'Recording link status'}
            options={qualify?[
              {value:'all',label:'All outcomes'},
              {value:'ELIGIBLE',label:'Rules met'},
              {value:'EXCLUDED',label:'Excluded'},
              {value:'REVIEW_REQUIRED',label:'Needs review'},
              {value:'CONFLICTED',label:'Conflicting evidence'},
            ]:[{value:'all',label:'All link states'},
              ...Object.entries(readableStatus).map(([value,label])=>({value,label}))]}/>
        </div>
        <p role="status" className="mt-3 text-xs text-wk-text-muted">
          Showing {rows.length} of {review.rows.length} source positions.
        </p>
        <WkDataTable rows={rows} getKey={row=>row.captureRowId}
          ariaLabel={qualify?"WAKILISHA 100 eligibility results":"WAKILISHA 100 recorded source positions"}
          empty="No source positions match these filters."
          columns={[
            {key:'rank',label:'Source rank',render:r=><span className="font-bold text-wk-text">{r.rank}</span>},
            {key:'recording',label:'Observed recording',render:r=><div className="min-w-44">
              <p className="font-semibold text-wk-text">{r.observedTitle??'Title not supplied'}</p>
              <p className="text-wk-text-muted">{r.observedArtist??'Artist not supplied by source'}</p>
            </div>},
            {key:'provider',label:'Provider track ID',render:r=>
              <span className="break-all text-wk-text-muted">{r.providerTrackId??'Not supplied'}</span>},
            {key:'identity',label:qualify?'Policy outcome':'Registry link',render:r=><div>
              <p className="font-semibold text-wk-text">{qualify
                ?({ELIGIBLE:'Rules met',EXCLUDED:'Excluded',REVIEW_REQUIRED:'Needs review',CONFLICTED:'Conflicting evidence'}[r.outcome??'REVIEW_REQUIRED'])
                :readableStatus[r.identityState]}</p>
              <p className="text-wk-text-muted">{qualify
                ?(r.reasonCodes?.map(x=>x.replaceAll('_',' ')).join('; ')||'No rule failures')
                :(r.canonicalTrackId??(r.reviewReason?reasonLabel[r.reviewReason]??'Review required':'Review required'))}</p>
            </div>},
            ...(qualify?[{key:'correction',label:'Registry review',render:(r:Row)=><><a
              className="font-semibold text-wk-brand underline"
              href={r.canonicalTrackId&&r.registryTrackSlug
                ?'/admin/registry/tracks/'+encodeURIComponent(r.registryTrackSlug)
                :'/admin/registry/tracks'+(r.observedTitle
                  ?'?search='+encodeURIComponent(r.observedTitle.slice(0,120)):'')}
              target="_blank" rel="noopener noreferrer">
              {r.canonicalTrackId&&r.registryTrackSlug?'Edit Linked Track':'Investigate in Registry'}
            </a>
            {r.registryReleaseSlug&&<a
              className="block font-semibold text-wk-brand underline"
              href={'/admin/registry/releases/'+encodeURIComponent(r.registryReleaseSlug)}
              target="_blank" rel="noopener noreferrer">Edit Linked Release</a>}
            {r.registryArtistSlugs?.map((slug,i)=><a key={slug}
              className="block font-semibold text-wk-brand underline"
              href={'/admin/registry/artists/'+encodeURIComponent(slug)}
              target="_blank" rel="noopener noreferrer">
              Review Credited Artist {i+1}
            </a>)}</>}]:[]),
          ]}/>
        <p className="mt-4 text-xs text-wk-text-muted">
          {qualify
            ?'This is a private rule preview. Exclusions and reviews need governed decisions. No rows were changed, scored, or published.'
            :'Registry changes must use MIZIZI or Registry review. This table does not merge recordings or change identities.'}
        </p>
      </WkSurface>
    </>}
  </section>;
}
