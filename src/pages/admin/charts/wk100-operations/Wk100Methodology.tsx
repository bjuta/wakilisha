import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {WkSurface} from '@/components/design-system/primitives/Surface';
import {WkNumberField} from '@/components/design-system/primitives/NumberField';
import {WkStateBadge} from '@/components/design-system/primitives/StateBadge';
import {WkDetailList} from '@/components/design-system/primitives/DetailList';
import {
  WK100_METHOD_FAMILIES,WK100_SPOTIFY_EDITORIAL_PLAYLISTS,
  validateWk100MethodologyCandidate,
} from '@/../supabase/functions/_shared/wk100-methodology-candidate.mjs';

type Family='apple_ke'|'shazam_ke'|'mdundo_ke'|'youtube_ke'|'audiomack_ke'|'spotify_editorial';
const FAMILIES=[...WK100_METHOD_FAMILIES] as Family[];
type Draft={weekStartEat:string;revision:number;configSha256:string;
  config:{weekStartEat:string;ingestPolicySha256:string;
    methodologyCandidate?:{weightsPercent?:Record<Family,number>;ingestPolicySha256?:string};
    [key:string]:unknown}};
type Source={provider:string;sourceKey:string;expectedDepth:number;
  observedDepth:number;receiptSha256:string|null;nativePeriodAuthority:string};
const NAMES:Record<Family,string>={
  apple_ke:'Apple Music · consumption rank',
  shazam_ke:'Shazam · discovery rank',
  mdundo_ke:'Mdundo · consumption rank',
  youtube_ke:'YouTube · weekly song views',
  audiomack_ke:'Audiomack · geo-chart placement',
  spotify_editorial:'Spotify · four editorial lists, ONE family',
};
function blankWeights():Record<Family,number|null>{
  return Object.fromEntries(FAMILIES.map(k=>[k,null])) as Record<Family,number|null>;
}
export function Wk100Methodology({week,sources=[]}:{week:string;sources?:Source[]}){
  const [revision,setRevision]=useState<Draft|null>(null);
  const [weights,setWeights]=useState<Record<Family,number|null>>(blankWeights);
  const [phase,setPhase]=useState<'loading'|'ready'|'missing'|'unavailable'|'saving'>('loading');
  const [message,setMessage]=useState('');
  const sequence=useRef(0);
  const read=useCallback(async()=>{
    const seq=++sequence.current;
    setPhase('loading');setMessage('');setRevision(null);setWeights(blankWeights());
    try{
      const {data,error}=await supabase.functions.invoke('chart-ingest-api',{
        body:{action:'wk100_get_admin_draft',weekStartEat:week},
      });
      if(error||data?.ok!==true||data.weekStartEat!==week)throw Error('draft_unavailable');
      if(seq!==sequence.current)return;
      if(data.draft===null){setPhase('missing');return;}
      const value=data.draft as Draft;
      if(value.weekStartEat!==week||value.config?.weekStartEat!==week||
        !Number.isInteger(value.revision)||value.revision<1||
        !/^[a-f0-9]{64}$/.test(value.configSha256)||
        !/^[a-f0-9]{64}$/.test(value.config.ingestPolicySha256))throw Error('draft_invalid');
      const candidate=value.config.methodologyCandidate;
      setRevision(value);
      if(candidate?.weightsPercent){
        const restored=blankWeights();
        for(const key of FAMILIES)
          restored[key]=Number.isInteger(candidate.weightsPercent[key])?
            candidate.weightsPercent[key]:null;
        setWeights(restored);
      }
      setPhase('ready');
    }catch{
      if(seq===sequence.current){setPhase('unavailable');setMessage('The saved Edition could not be verified. No methodology can be edited.');}
    }
  },[week]);
  useEffect(()=>{void read();return()=>{sequence.current+=1;}},[read]);
  const candidate=useMemo(()=>revision?{
    schemaVersion:'wk100-methodology-candidate/v1',weekStartEat:week,
    ingestPolicySha256:revision.config.ingestPolicySha256,
    weightsPercent:weights,spotifyEditorialPlaylistIds:[...WK100_SPOTIFY_EDITORIAL_PLAYLISTS],
    normalization:'source_metric_classes_separate',
    missingness:'hold_without_redistribution',
    identityPolicy:'confirmed_registry_recording_only',
    approvalState:'proposed',canScore:false,canPublish:false,
  }:null,[revision,week,weights]);
  const valid=useMemo(()=>{
    if(!candidate)return false;
    try{validateWk100MethodologyCandidate(candidate,{
      weekStartEat:week,ingestPolicySha256:revision?.config.ingestPolicySha256,
    });return true;}catch{return false;}
  },[candidate,revision,week]);
  const saved=revision?.config.methodologyCandidate;
  const stale=!!saved&&saved.ingestPolicySha256!==revision?.config.ingestPolicySha256;
  const total=FAMILIES.reduce((n,f)=>n+(weights[f]??0),0);
  const save=async()=>{
    if(phase!=='ready'||!revision||!candidate||!valid)return;
    setPhase('saving');setMessage('Saving this proposed methodology against the exact Edition revision…');
    try{
      validateWk100MethodologyCandidate(candidate,{
        weekStartEat:week,ingestPolicySha256:revision.config.ingestPolicySha256,
      });
      const {data,error}=await supabase.functions.invoke('chart-ingest-api',{
        body:{action:'wk100_save_admin_draft',weekStartEat:week,
          expectedRevision:revision.revision,
          config:{...revision.config,methodologyCandidate:candidate}},
      });
      if(error||data?.ok!==true||data.persisted!==true||
        data.revision!==revision.revision+1)throw Error('save_not_verified');
      await read();
      setMessage('Proposed methodology saved. No scoring, freeze or publication was authorized.');
    }catch{
      setPhase('unavailable');
      setMessage('Could not save. Another revision or permission may have changed. Reload the Edition before editing.');
    }
  };
  return <section data-wk100-methodology className="space-y-5" aria-label="W7 Methodology">
    <WkSurface className="rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wk-text-muted">Rank / W7 / Kenya</p>
          <h2 className="mt-1 text-xl font-bold text-wk-text">Methodology</h2>
          <p className="mt-2 max-w-3xl text-sm text-wk-text-muted">
            Review an explicit contribution for each source family. This is a candidate,
            not an approved scoring formula. Ranks, discovery and weekly views stay distinct.
          </p>
        </div>
        <WkStateBadge tone="warning">Private · Ranking locked</WkStateBadge>
      </div>
      {phase==='loading'&&<p role="status" className="mt-4 text-sm text-wk-text-muted">Checking the saved weekly Edition…</p>}
      {phase==='missing'&&<p role="alert" className="mt-4 text-sm text-wk-danger">
        No saved Edition configuration exists for this EAT week. Configure the Edition before proposing a methodology.
      </p>}
      {phase==='unavailable'&&<div className="mt-4 space-y-3">
        <p role="alert" className="text-sm text-wk-danger">{message}</p>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm" onClick={()=>{void read()}}>Reload saved Edition</button>
      </div>}
      {revision&&phase!=='unavailable'&&phase!=='loading'&&<>
        <div className="mt-4"><WkDetailList items={[
          {label:'Edition week',value:week},
          {label:'Saved Edition revision',value:String(revision.revision)},
          {label:'Eligibility policy SHA-256',value:revision.config.ingestPolicySha256},
          {label:'Methodology state',value:stale?'Needs re-review · policy changed':saved?'Proposed · not frozen':'Not yet proposed'},
        ]}/></div>
        {stale&&<p role="alert" className="mt-3 text-sm text-wk-danger">
          The saved eligibility policy differs from this methodology proposal. Review every value and save a new proposal.
        </p>}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {FAMILIES.map(family=><div key={family} className="rounded-xl border border-wk-border p-3">
            <p className="mb-2 text-sm font-semibold text-wk-text">{NAMES[family]}</p>
            <WkNumberField ariaLabel={NAMES[family]+' weight percent'}
              value={weights[family]??''} min={0} max={100} step={1}
              disabled={phase==='saving'}
              onChange={value=>setWeights(old=>({...old,[family]:Number.isInteger(value)?value:null}))}/>
            <p className="mt-2 text-xs text-wk-text-muted">
              {family==='spotify_editorial'
                ?'Four named playlists share one contribution. It must be lower than each weighted core family.'
                :sources.some(s=>s.provider===family&&s.receiptSha256)
                  ?'A source original exists. Admission, native period and Registry identity still require review.'
                  :'No verified original shown in this view; do not infer availability.'}
            </p>
          </div>)}
        </div>
        <div className="mt-4 space-y-2">
          <p role="status" className="text-sm text-wk-text-muted">
            Explicit contributions: {total}% of 100%. {valid?'Candidate values pass structural checks.':'Enter all six values totalling 100%; keep editorial lower than every positive core weight.'}
          </p>
          <p className="text-xs text-wk-text-muted">
            Missing source evidence is held, never reweighted. Only confirmed Registry recording identities may qualify.
            These percentages cannot be applied to incomparable metrics before a separately governed methodology freeze.
          </p>
          {message&&phase!=='unavailable'&&<p role="status" className="text-sm text-wk-text-muted">{message}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wk-button wk-button-primary wk-button-sm"
              disabled={!valid||phase==='saving'} onClick={()=>{void save()}}>Save methodology proposal</button>
            <button type="button" className="wk-button wk-button-secondary wk-button-sm"
              disabled={phase==='saving'} onClick={()=>{void read()}}>Reload current revision</button>
          </div>
          <p className="text-xs font-semibold text-wk-text-muted">
            No freeze or scoring command exists on this screen. W8 private ranking stays blocked.
          </p>
        </div>
      </>}
    </WkSurface>
  </section>;
}
