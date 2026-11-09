import {useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {supabase} from '@/lib/supabase';
import {WkSurface} from '@/components/design-system/primitives/Surface';
import {WkSelect} from '@/components/design-system/primitives/Select';
import {WkSearchField} from '@/components/design-system/primitives/Field';
import {WkDataTable} from '@/components/design-system/primitives/DataTable';
import {WkStateBadge} from '@/components/design-system/primitives/StateBadge';
import {WkDetailList} from '@/components/design-system/primitives/DetailList';

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
};
type Review={
  schemaVersion:'wk100-admin-identify-observations-v1';
  weekStartEat:string;contractId:string;receiptId:string;sourceKey:string;
  registryProviderKey:string;receiptStatus:string;observedDepth:number;
  expectedDepth:number;payloadSha256:string;originalReadbackInThisRequest:false;
  totals:{observed:number;resolved:number;needsReview:number;conflicting:number;inactive:number};
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
export function Wk100IdentifyReview({week,sources}:{week:string;sources:Source[]}){
  const navigate=useNavigate();
  const selectable=useMemo(()=>sources.filter(s=>s.recentAttempts.some(eligible)),[sources]);
  const [sourceId,setSourceId]=useState('');
  const [receiptId,setReceiptId]=useState('');
  const [review,setReview]=useState<Review|null>(null);
  const [phase,setPhase]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [readNonce,setReadNonce]=useState(0);
  const sequence=useRef(0);
  const source=selectable.find(s=>s.id===sourceId);
  const receipts=source?.recentAttempts.filter(eligible)??[];
  useEffect(()=>{
    const seq=++sequence.current;
    setReview(null);setSearch('');setFilter('all');
    if(!source||!receipts.some(r=>r.id===receiptId)){
      setPhase('idle');return;
    }
    setPhase('loading');
    void (async()=>{
      try{
        const {data,error}=await supabase.functions.invoke('wk100-source-admin-read',{
          body:{action:'read_recording_observations',
            weekStartEat:week,contractId:source.id,receiptId},
        });
        if(error||!data||data.schemaVersion!=='wk100-admin-identify-observations-v1'||
          data.weekStartEat!==week||data.contractId!==source.id||data.receiptId!==receiptId||
          data.sourceKey!==source.sourceKey||!Array.isArray(data.rows)||
          data.rows.length!==data.observedDepth||data.totals?.observed!==data.rows.length||
          data.canWriteRegistry!==false||data.canScore!==false||data.canPublish!==false)
          throw Error('identity_response_invalid');
        if(seq===sequence.current){setReview(data as Review);setPhase('ready');}
      }catch{if(seq===sequence.current)setPhase('unavailable');}
    })();
    return ()=>{sequence.current+=1;};
    // Receipt selection is explicit. No current-week source is selected
    // automatically for identification or downstream ranking.
  },[sourceId,receiptId,readNonce,week,sources]);
  const rows=useMemo(()=>review?.rows.filter(row=>
    (filter==='all'||row.identityState===filter)&&
    (!search||[
      row.observedTitle,row.observedArtist,row.providerTrackId,
      row.canonicalTrackId,String(row.rank),
    ].some(v=>v?.toLowerCase().includes(search.trim().toLowerCase()))))??[],
    [review,filter,search]);
  return <section data-wk-identify-review className="space-y-5" aria-label="Recording review">
    <WkSurface className="rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wk-text-muted">Identify / W4 / Kenya</p>
          <h2 className="mt-1 text-xl font-bold text-wk-text">Recording Review</h2>
          <p className="mt-2 max-w-3xl text-sm text-wk-text-muted">
            Inspect observed chart positions and exact Registry links. A matching title is not proof
            of the same recording. Unresolved details stay attached to their original evidence
            and do not automatically prevent a later evidence-qualified Edition.
          </p>
        </div>
        <WkStateBadge tone="warning">Private review only</WkStateBadge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-wk-text-muted">Captured source</p>
          <WkSelect ariaLabel="Captured source" value={sourceId} onChange={value=>{
            setSourceId(value);setReceiptId('');
          }} options={[{value:'',label:'Choose a source'},
            ...selectable.map(s=>({value:s.id,label:s.surface}))]}/>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-wk-text-muted">Exact source receipt</p>
          <WkSelect ariaLabel="Exact source receipt" value={receiptId} disabled={!source}
            onChange={setReceiptId} options={[{value:'',label:'Choose a receipt'},
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
          onClick={()=>setReadNonce(x=>x+1)}>Refresh selected receipt</button>
      </div>
    </WkSurface>
    {phase==='loading'&&<WkSurface className="rounded-xl p-4">
      <p role="status" className="text-sm text-wk-text-muted">Checking exact recording links…</p>
    </WkSurface>}
    {phase==='unavailable'&&<WkSurface className="rounded-xl p-4">
      <p role="alert" className="text-sm text-wk-danger">
        The restricted recording review could not verify this receipt or its Registry links.
        No recording has been assumed matched. You can retry the read.
      </p>
    </WkSurface>}
    {phase==='ready'&&review&&<>
      <WkSurface className="rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h3 className="text-base font-bold text-wk-text">Identity coverage</h3>
            <p className="mt-1 text-xs text-wk-text-muted">
              Exact provider links only. Original receipt SHA is preserved. This read does not
              replay the private original or authorize ranking.
            </p></div>
          <WkStateBadge tone="warning">
            {review.receiptStatus==='partial_depth'?'Partial source evidence':'Candidate source evidence'}
          </WkStateBadge>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <WkDetailList items={[
            {label:'Observed positions',value:review.totals.observed},
            {label:'Expected positions',value:review.expectedDepth},
            {label:'Confirmed active Registry links',value:review.totals.resolved},
            {label:'Needs review',value:review.totals.needsReview},
            {label:'Conflicting links',value:review.totals.conflicting},
            {label:'Inactive linked Tracks',value:review.totals.inactive},
          ]}/>
          <WkDetailList items={[
            {label:'Source key',value:review.sourceKey},
            {label:'Capture receipt',value:review.receiptId},
            {label:'Original SHA-256',value:review.payloadSha256},
            {label:'Registry provider namespace',value:review.registryProviderKey},
          ]}/>
        </div>
      </WkSurface>
      <WkSurface className="rounded-xl p-4 sm:p-5">
        <h3 className="text-base font-bold text-wk-text">Source recording observations</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <WkSearchField value={search} onChange={setSearch} ariaLabel="Search source recordings"
            placeholder="Search title, artist, source ID, or rank"/>
          <WkSelect value={filter} onChange={setFilter} ariaLabel="Recording link status"
            options={[{value:'all',label:'All link states'},
              ...Object.entries(readableStatus).map(([value,label])=>({value,label}))]}/>
        </div>
        <p role="status" className="mt-3 text-xs text-wk-text-muted">
          Showing {rows.length} of {review.rows.length} source positions.
        </p>
        <WkDataTable rows={rows} getKey={row=>row.captureRowId}
          ariaLabel="WAKILISHA 100 recorded source positions"
          empty="No source positions match these filters."
          columns={[
            {key:'rank',label:'Source rank',render:r=><span className="font-bold text-wk-text">{r.rank}</span>},
            {key:'recording',label:'Observed recording',render:r=><div className="min-w-44">
              <p className="font-semibold text-wk-text">{r.observedTitle??'Title not supplied'}</p>
              <p className="text-wk-text-muted">{r.observedArtist??'Artist not supplied by source'}</p>
            </div>},
            {key:'provider',label:'Provider track ID',render:r=>
              <span className="break-all text-wk-text-muted">{r.providerTrackId??'Not supplied'}</span>},
            {key:'identity',label:'Registry link',render:r=><div>
              <p className="font-semibold text-wk-text">{readableStatus[r.identityState]}</p>
              <p className="text-wk-text-muted">
                {r.canonicalTrackId??(r.reviewReason?reasonLabel[r.reviewReason]??'Review required':'Review required')}
              </p>
            </div>},
          ]}/>
        <p className="mt-4 text-xs text-wk-text-muted">
          Registry changes must go through existing governed MIZIZI or Registry review.
          This table does not create Tracks, merge recordings, or write identity decisions.
        </p>
      </WkSurface>
    </>}
  </section>;
}
