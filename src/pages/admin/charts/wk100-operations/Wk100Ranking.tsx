import {useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {supabase} from '@/lib/supabase';
import {WkSurface} from '@/components/design-system/primitives/Surface';
import {WkSearchField} from '@/components/design-system/primitives/Field';
import {WkStateBadge} from '@/components/design-system/primitives/StateBadge';
import type {Wk100MethodDecision} from './SourceMethodReviewForm';
import {WK100_RANKING_SPECIFICATION_V1 as SPEC} from '@/../supabase/functions/_shared/wk100-ranking-primitive.mjs';
import {reviewWk100RankingEvidence} from '@/../supabase/functions/_shared/wk100-ranking-evidence-review.mjs';

type Source={id:string;provider:string;sourceKey:string;market:string;metric:string;
  version:string;captureState:string;expectedDepth:number;observedDepth:number;
  receiptSha256:string|null;nativePeriodAuthority:string;
  nativePeriodStart:string|null;nativePeriodEnd:string|null;
  lastSuccessfulAt:string|null};
type Family=typeof SPEC.families[number];
type RankingRow={rank:number;recordingId:string;title:string|null;artist:string|null;
  score:number;listedFamilyCount:number;
  contributions:{family:string;points:number}[]};
type RankResult={
  schemaVersion:'wk100-admin-private-ranking/v1';weekStartEat:string;
  specificationId:string;rankingState:'incomplete'|'private_candidate';
  requiredReceiptCount:number;
  sourceFamilies:{family:string;required:number;observedAttempts:number;
    eligibleCheckpointCount:number;observedDays:number;issues:string[];
    checkpointCandidate:boolean}[];
  ranked:RankingRow[];rankingDigest:string|null;
  sourceAdmissionSnapshotSha256:string|null;
  registrySnapshotSha256:string|null;policySha256:string|null;
  heldPositions:Record<string,number>|null;
  gates:{id:string;label:string;state:'verified'|'blocked'}[];
  reason?:string;canStage:false;canPublish:false;
};
const DISPLAY:Record<string,{label:string;meaning:string}>={
  apple_ke:{label:'Apple Music',meaning:'Seven daily Kenya positions. Not weekly stream totals.'},
  shazam_ke:{label:'Shazam',meaning:'Kenya song recognition positions. Not audio plays.'},
  mdundo_ke:{label:'Mdundo',meaning:'Kenya chart positions. No inferred play totals.'},
  youtube_ke:{label:'YouTube',meaning:'Provider-reported Kenya weekly songs and native views.'},
  audiomack_ke:{label:'Audiomack',meaning:'Kenya geographic placements. Not disclosed stream totals.'},
};
const REASONS:Record<string,string>={
  source_not_enrolled:'No enrolled source for this family.',
  multiple_source_contracts:'More than one source contract needs review.',
  source_contract_incompatible:'The source contract does not match the fixed specification.',
  source_depth_incomplete:'The original contains fewer positions than required.',
  observation_week_unverified:'The capture does not establish this EAT week.',
  native_period_unverified:'The source period has not been verified.',
  duplicate_day_or_receipt:'Several captures claim the same daily checkpoint.',
  partial_original_retained:'A partial original remains on record.',
  unknown_period_receipt_retained:'A retained original has an unknown reporting period.',
  no_qualified_checkpoint:'No complete source checkpoint is available.',
  checkpoints_missing:'The required daily or weekly checkpoints are missing.',
  duplicate_receipt:'A source receipt appears more than once.',
};
const GATES=[
  ['source','Complete source observations'],
  ['method','Current source admission and originals'],
  ['eligibility','Registry and saved eligibility policy'],
  ['ranking','Reproducible private Top 100'],
  ['approval','Independent editorial approval'],
  ['stage','Private Edition staging'],
  ['publish','Explicit Edition publication'],
] as const;
const REPLAY_REASONS:Record<string,string>={
  saved_policy_not_verified:'The weekly eligibility policy is missing or has changed.',
  source_constitution_unavailable:'The server has no verified source constitution.',
  source_method_not_current:'A source method is not currently approved for this ranking.',
  canonical_recordings_not_ready:'Canonical recording links or eligibility need more review.',
  original_replay_not_verified:'An original could not be verified against its stored positions.',
  private_attestation_not_verified:'The private evidence replay did not pass verification.',
};
const SHA=/^[a-f0-9]{64}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const fixed=(n:number)=>Number.isFinite(n)?n.toFixed(2):'0.00';
function verify(result:unknown,week:string):result is RankResult{
  if(!result||typeof result!=='object'||Array.isArray(result))return false;
  const r=result as RankResult;
  if(r.schemaVersion!=='wk100-admin-private-ranking/v1'||
    r.weekStartEat!==week||r.specificationId!==SPEC.id||
    !['incomplete','private_candidate'].includes(r.rankingState)||
    r.canStage!==false||r.canPublish!==false||
    r.requiredReceiptCount!==11||!Array.isArray(r.sourceFamilies)||
    r.sourceFamilies.length!==5||!Array.isArray(r.ranked)||
    !Array.isArray(r.gates)||r.gates.length!==7)return false;
  if(r.sourceFamilies.some(x=>!SPEC.families.includes(x.family as Family)||
    !Number.isInteger(x.required)||!Number.isInteger(x.observedAttempts)||
    !Number.isInteger(x.eligibleCheckpointCount)||!Array.isArray(x.issues)||
    x.issues.some(issue=>typeof issue!=='string')||
    typeof x.checkpointCandidate!=='boolean'))return false;
  if(GATES.some(([id])=>!r.gates.some(g=>g.id===id&&
    ['verified','blocked'].includes(g.state))))return false;
  if(r.rankingState==='incomplete')return r.ranked.length===0&&
    r.rankingDigest===null;
  return r.ranked.length===100&&
    [r.rankingDigest,r.registrySnapshotSha256,r.policySha256,
      r.sourceAdmissionSnapshotSha256].every(x=>typeof x==='string'&&SHA.test(x))&&
    r.ranked.every((row,i)=>row.rank===i+1&&uuid.test(row.recordingId)&&
      Number.isFinite(row.score)&&row.score>=0&&row.score<=100&&
      Number.isInteger(row.listedFamilyCount)&&
      Array.isArray(row.contributions)&&row.contributions.length===5&&
      SPEC.families.every(f=>row.contributions.some(p=>p.family===f&&
        Number.isFinite(p.points)&&p.points>=0&&p.points<=20)))&&
    new Set(r.ranked.map(row=>row.recordingId)).size===100;
}
export function Wk100Ranking({week,sources=[],methods=[],reviewedSourceIds=[]}:{
  week:string;sources?:Source[];methods?:Wk100MethodDecision[];
  reviewedSourceIds?:string[];
}){
  const navigate=useNavigate();
  const [result,setResult]=useState<RankResult|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [nonce,setNonce]=useState(0);
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(0);
  const [focused,setFocused]=useState<string|null>(null);
  const sequence=useRef(0);
  const evidence=useMemo(()=>{
    try{return reviewWk100RankingEvidence({
      weekStartEat:week,sources,methods,reviewedSourceIds,
    });}catch{return null;}
  },[week,sources,methods,reviewedSourceIds]);
  useEffect(()=>{
    const current=++sequence.current;
    setResult(null);setFocused(null);setPage(0);setPhase('loading');
    void (async()=>{
      try{
        const {data,error}=await supabase.functions.invoke('wk100-source-admin-read',{
          body:{action:'read_private_ranking',weekStartEat:week},
        });
        if(current!==sequence.current)return;
        if(error||!verify(data,week)){setPhase('unavailable');return;}
        setResult(data);setPhase('ready');
      }catch{if(current===sequence.current)setPhase('unavailable');}
    })();
    return ()=>{sequence.current++;};
  },[week,nonce]);
  const ranked=result?.rankingState==='private_candidate'?result.ranked:[];
  const filtered=useMemo(()=>ranked.filter(row=>
    !query.trim()||[row.title,row.artist,String(row.rank)].some(x=>
      String(x??'').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))),
  [ranked,query]);
  const pages=Math.max(1,Math.ceil(filtered.length/20));
  const shown=filtered.slice(Math.min(page,pages-1)*20,(Math.min(page,pages-1)+1)*20);
  const selected=ranked.find(row=>row.recordingId===focused)??ranked[0]??null;
  const sourceItems=result?.sourceFamilies??[];
  const gates=result?.gates??GATES.map(([id,label])=>({id,label,state:'blocked' as const}));
  const privateCandidate=result?.rankingState==='private_candidate';
  const go=(stage:'collect'|'identify'|'qualify')=>navigate(
    '/admin/charts/wk100-operations?week='+encodeURIComponent(week)+
    (stage==='collect'?'':'&stage='+stage));
  return <section data-wk100-ranking aria-label="W7 to W9 Ranking" className="space-y-5">
    <WkSurface className="rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-wk-text-muted">Rank / W7 to W9 / Kenya</p>
          <h2 className="mt-1 text-xl font-bold text-wk-text">Ranking</h2>
          <p className="mt-2 max-w-3xl text-sm text-wk-text-muted">
            A private Top 100 built from the five fixed source families. The index
            measures chart traction, not a count of Kenyan streams or listeners.
          </p>
        </div>
        <WkStateBadge tone="warning">Private · Publication locked</WkStateBadge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-wk-border p-3">
          <p className="text-xs text-wk-text-muted">Edition week</p>
          <p className="text-sm font-semibold text-wk-text">{week}</p>
        </div>
        <div className="rounded-xl border border-wk-border p-3">
          <p className="text-xs text-wk-text-muted">Calculation</p>
          <p className="text-sm font-semibold text-wk-text">Fixed, versioned ranking</p>
        </div>
        <div className="rounded-xl border border-wk-border p-3">
          <p className="text-xs text-wk-text-muted">Source families</p>
          <p className="text-sm font-semibold text-wk-text">Five required</p>
        </div>
      </div>
      <h3 className="mt-5 text-sm font-semibold text-wk-text">Source Evidence</h3>
      <p className="mt-1 text-xs text-wk-text-muted">
        Each family receives one fixed fifth of the index. Seven Apple daily
        observations stay within Apple’s share. Spotify playlists receive no
        ranking points. There are no editable ranking percentages.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-wk100-w7-evidence-review>
        {SPEC.families.map(family=>{
          const item=evidence?.core.find((x:{family:string;chainCandidateCount:number})=>
            x.family===family);
          const current=sourceItems.find(x=>x.family===family);
          return <div key={family} className="rounded-xl border border-wk-border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="text-sm font-semibold text-wk-text">{DISPLAY[family].label}</p>
              <p className="text-xs font-semibold text-wk-text-muted">
                {SPEC.familyWeightPercent}% fixed share
              </p>
            </div>
            <p className="mt-1 text-xs text-wk-text-muted">{DISPLAY[family].meaning}</p>
            <p className="mt-2 text-xs text-wk-text-muted">
              {current?current.eligibleCheckpointCount+' of '+current.required+
                ' checkpoints ready for verification.':
                item?.chainCandidateCount?
                  'Candidate source observed. Private verification is still required.':
                  'Source evidence is not ready for ranking.'}
            </p>
          </div>;
        })}
      </div>
      <p role="status" className="mt-4 text-xs text-wk-text-muted">
        {phase==='loading'?'Checking the private ranking and saved source evidence…':
          phase==='unavailable'?'Private ranking readback is unavailable. Nothing is approved.':
          privateCandidate?'A reproducible private research ranking is available. Publishing is still blocked.':
          'Source observations are incomplete. Ranking and publication remain blocked.'}
      </p>
      <button type="button" className="wk-button wk-button-secondary wk-button-sm mt-3"
        onClick={()=>setNonce(v=>v+1)} disabled={phase==='loading'}>
        Refresh Ranking
      </button>
      <p className="mt-2 text-xs font-semibold text-wk-text-muted">
        No staging or publication command is available on this screen.
      </p>
    </WkSurface>

    <WkSurface className="rounded-xl p-4 sm:p-5" data-wk100-w8-ranking>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-wk-text-muted">W8 / Private Ranking</p>
          <h3 className="mt-1 text-lg font-semibold text-wk-text">Private Top 100</h3>
        </div>
        <WkStateBadge tone={privateCandidate?'success':'warning'}>
          {privateCandidate?'Private research candidate':'Not yet ranked'}
        </WkStateBadge>
      </div>
      {privateCandidate&&result?<div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WkSearchField ariaLabel="Search private ranking"
            placeholder="Search recording, artist, or position"
            value={query} onChange={v=>{setQuery(v);setPage(0);}}/>
          <p className="text-xs text-wk-text-muted">
            {filtered.length} of {result.ranked.length} recordings
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Private WAKILISHA 100 Top 100">
            <thead><tr className="border-b border-wk-border">
              <th scope="col" className="p-2">Rank</th>
              <th scope="col" className="p-2">Recording</th>
              <th scope="col" className="p-2">Index</th>
              <th scope="col" className="p-2">Sources</th>
              <th scope="col" className="p-2">Details</th>
            </tr></thead>
            <tbody>{shown.map(row=><tr key={row.recordingId}
              className="border-b border-wk-border">
              <td className="p-2 font-semibold">{row.rank}</td>
              <td className="p-2"><span className="font-semibold">
                {row.title||'Recording title unavailable'}</span>
                <span className="block text-xs text-wk-text-muted">
                  {row.artist||'Artist name unavailable'}</span></td>
              <td className="p-2">{fixed(row.score)}</td>
              <td className="p-2">{row.listedFamilyCount} of five</td>
              <td className="p-2"><button type="button"
                className="wk-button wk-button-secondary wk-button-sm"
                onClick={()=>setFocused(row.recordingId)}>
                Explain Score
              </button></td>
            </tr>)}</tbody>
          </table>
          {!shown.length&&<p className="p-3 text-sm text-wk-text-muted">
            No recordings match this search.</p>}
        </div>
        <div className="flex items-center justify-between">
          <button type="button" className="wk-button wk-button-secondary wk-button-sm"
            disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous 20</button>
          <p className="text-xs text-wk-text-muted">
            Page {Math.min(page,pages-1)+1} of {pages}
          </p>
          <button type="button" className="wk-button wk-button-secondary wk-button-sm"
            disabled={page>=pages-1} onClick={()=>setPage(p=>Math.min(pages-1,p+1))}>
            Next 20
          </button>
        </div>
      </div>:<p className="mt-3 text-sm text-wk-text-muted">
        The Top 100 appears here only after the server verifies every required
        original, source method, canonical recording, and saved eligibility rule.
      </p>}
    </WkSurface>

    <WkSurface className="rounded-xl p-4 sm:p-5" data-wk100-w8s-explanation>
      <p className="text-xs text-wk-text-muted">W8S / Score Explanation</p>
      <h3 className="mt-1 text-lg font-semibold text-wk-text">How This Score Was Built</h3>
      {privateCandidate&&selected?<div className="mt-4 space-y-3">
        <p className="text-sm font-semibold text-wk-text">
          #{selected.rank} · {selected.title||'Recording title unavailable'}
          <span className="ml-2 text-wk-text-muted">{fixed(selected.score)} / 100</span>
        </p>
        <ul aria-label="Five source contributions" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {selected.contributions.map(p=><li key={p.family}
            className="rounded-xl border border-wk-border p-3">
            <p className="text-xs font-semibold text-wk-text">
              {DISPLAY[p.family]?.label??p.family}</p>
            <p className="mt-2 text-lg font-bold text-wk-text">
              {fixed(p.points)} <span className="text-xs font-normal text-wk-text-muted">
                of 20 points</span></p>
          </li>)}
        </ul>
        <p className="text-xs text-wk-text-muted">
          Each position earns a normalized rank credit. Apple’s seven days are
          averaged into one share. Zero positional points do not mean zero listening.
          YouTube view counts are checked as native evidence, not added as comparable streams.
        </p>
        <p className="text-xs text-wk-text-muted">
          Equal shares are the declared first-version research convention,
          not estimated market audiences.
        </p>
      </div>:<p className="mt-3 text-sm text-wk-text-muted">
        No score can be explained until the server verifies an entire private
        ranking. Missing sources receive no invented points.
      </p>}
    </WkSurface>

    {!privateCandidate&&<WkSurface className="rounded-xl p-4 sm:p-5"
      data-wk100-w8b-incomplete>
      <p className="text-xs text-wk-text-muted">W8B / Incomplete Ranking</p>
      <h3 className="mt-1 text-lg font-semibold text-wk-text">What Is Missing</h3>
      {phase==='unavailable'?<p role="alert" className="mt-3 text-sm text-wk-text-muted">
        The protected ranking service has not returned verified evidence.
        Do not treat this as an empty chart.</p>:
        phase==='loading'?<p className="mt-3 text-sm text-wk-text-muted">
          Checking original source positions and reporting periods…</p>:
        <div className="mt-3 space-y-3">
          {sourceItems.map(item=><div key={item.family}
            className="rounded-lg border border-wk-border p-3">
            <div className="flex flex-wrap justify-between gap-3">
              <p className="text-sm font-semibold">{DISPLAY[item.family]?.label}</p>
              <p className="text-xs text-wk-text-muted">
                {item.eligibleCheckpointCount} / {item.required} checkpoints</p>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-wk-text-muted">
              {item.issues.map(issue=><li key={issue}>{REASONS[issue]??'Source verification is incomplete.'}</li>)}
              {!item.issues.length&&<li>Originals need private replay and Registry checks.</li>}
            </ul>
          </div>)}
          {result?.reason&&<p className="text-sm text-wk-text-muted">
            {REPLAY_REASONS[result.reason]??
              'The private ranking could not be verified.'}
            {' '}Review the original source, Registry links, and weekly eligibility policy.
          </p>}
        </div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>go('collect')}>Review Collection</button>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>go('identify')}>Review Recording Links</button>
        <button type="button" className="wk-button wk-button-secondary wk-button-sm"
          onClick={()=>go('qualify')}>Review Eligibility</button>
      </div>
    </WkSurface>}

    <WkSurface className="rounded-xl p-4 sm:p-5" data-wk100-w9-readiness>
      <p className="text-xs text-wk-text-muted">W9 / Readiness Inspection</p>
      <h3 className="mt-1 text-lg font-semibold text-wk-text">Edition Readiness</h3>
      <p className="mt-2 text-sm text-wk-text-muted">
        A complete private ranking is not permission to stage or publish an Edition.
        Every later approval and integrity check stays independent.
      </p>
      <ul aria-label="Ranking readiness checks" className="mt-4 space-y-2">
        {gates.map(gate=><li key={gate.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-wk-border p-3">
          <p className="text-sm font-semibold text-wk-text">{gate.label}</p>
          <WkStateBadge tone={gate.state==='verified'?'success':'warning'}>
            {gate.state==='verified'?'Verified for private research':'Not approved'}
          </WkStateBadge>
        </li>)}
      </ul>
      <p role="status" className="mt-4 text-sm font-semibold text-wk-text">
        Private staging blocked. Publication blocked.
      </p>
      <p className="mt-2 text-xs text-wk-text-muted">
        W9 records the evidence boundary. It does not replace independent
        editorial approval, an exact Edition freeze, or the governed publisher.
      </p>
    </WkSurface>
  </section>;
}
