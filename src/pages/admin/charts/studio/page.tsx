import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "@/hooks/useAdminUser";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { WkDisclosure } from "@/components/design-system/primitives/Disclosure";
import { AdminChartsPageHeader } from "@/pages/admin/charts/components/AdminChartsPageHeader";
import { StudioChartMusicRow } from "@/components/admin/charts/StudioChartMusicRow";
import { loadVerifiedAppleChartSongs, type VerifiedAppleChartSong } from "@/services/chartsPrivate/appleCatalogReview";
import { suggestRecordingReviewGroups, type ReviewedArtistAlias, type ReviewedArtist } from "@/services/chartsPrivate/recordingReviewSuggestions";

type SourceKey = "youtube_ke" | "mdundo_ke" | "apple_ke" | "audiomack_ke" | "shazam_ke";
type Tab = "sources" | "review" | "preview" | "history" | "freeze";
type EvidenceRow = {
  source_key: SourceKey; receipt_id: string; rank: number;
  title: string; artist: string | null; provider_track_id: string | null;
  reason: string;
};
type Coverage = {
  source_key: SourceKey; receipt_id: string; source_weight_points: number;
  observed_depth: number; expected_depth: number; observed_status: string;
  original_sha256: string; observed_at: string;
  provider_updated_at: string | null;
  provider_week_ending_date: string | null;
  native_period_authority: string;
};
type SourceMethod = {
  source_key: SourceKey; review_state: string;
  reviewed_method: string | null; method_revision: number;
  authorization_expires_at: string | null;
};
type Candidate = {
  track_id: string; score_points: string; source_count: number;
  source_contributions: Array<{
    source_key: SourceKey; credit_points: string; rank: number;
  }>;
};
type ReceiptHistory = {
  id: string; source_key: SourceKey; observed_at: string;
  original_sha256: string; observed_depth: number; expected_depth: number;
  observed_status: string; native_period_authority: string;
  provider_week_ending_date: string | null;
};
type Preview = {
  methodology_version: string; scoring_policy_version: string;
  review_status: string; frozen: false; can_publish: false;
  source_coverage: Coverage[]; candidates: Candidate[];
  unresolved: EvidenceRow[]; conflicts: EvidenceRow[];
};
type FreezeRecord = {
  id: string; frozen_at: string; input_sha256: string;
  ranking_sha256: string; frozen_private: boolean;
};
type FreezeGate = {
  input_sha256: string; ranking_sha256: string; eligible_count: number;
  unresolved_count: number; conflict_count: number; freeze_ready: boolean;
  latest_freeze_id: string | null; recent_freezes: FreezeRecord[];
};
type SourceAppearance = {
  source_key: SourceKey; native_rank: number; provider_track_id: string | null;
  title: string; artist: string | null; credit_units: number;
};
type NativeReviewEntry = {
  position?: number; title: string; artist: string | null;
  source_count: number; score_points: string; needs_recording_review: boolean;
  contributions: SourceAppearance[];
};
type AppleTitleLead = {
  title: string; apple_rank: number; apple_provider_track_id: string | null;
  possible_sources: SourceKey[]; possible_artists: string[];
  contributes_extra_score: false;
};
type NativeReview = {
  contract: string; count: number; candidate_count: number;
  entries: NativeReviewEntry[]; multi_source_occurrences: NativeReviewEntry[];
  apple_title_review: AppleTitleLead[]; freeze_ready: false; can_publish: false;
};
type StudioResponse = {
  ok: boolean; state: string; preview?: Preview; native_review?: NativeReview | null; freeze_gate?: FreezeGate;
  server_verified_originals?: number; source_methods?: SourceMethod[];
  history?: ReceiptHistory[]; read_at?: string;
  receipt_count?: number; error?: string;
};
type RegistryTrack = { id: string; title: string; isrc: string | null; status: string };
type Probe = {
  source_key: SourceKey; probe_id: string; expected_revision: number;
  original_sha256: string; observed_depth: number; expected_depth: number;
  provider_week_ending_date: string | null;
};

const SOURCES: Array<{key: SourceKey; label: string; weight: number; method: string}> = [
  {key:"youtube_ke",label:"YouTube Kenya Weekly Top Songs",weight:30,method:"POST"},
  {key:"mdundo_ke",label:"Mdundo Kenya Top Songs",weight:25,method:"GET"},
  {key:"apple_ke",label:"Apple Music Kenya Top 100",weight:20,method:"GET"},
  {key:"audiomack_ke",label:"Audiomack Kenya Weekly 100",weight:15,method:"GET"},
  {key:"shazam_ke",label:"Shazam Kenya Top 200",weight:10,method:"GET"},
];
const SOURCE_LABEL = Object.fromEntries(SOURCES.map(s=>[s.key,s.label])) as Record<SourceKey,string>;
const DECLARATION = "I have independently verified this exact recording and authorize its Registry provider link.";
const FREEZE_DECLARATION = "I approve freezing this exact 100-recording private chart candidate. It will not publish.";
const DATE = (value?:string|null) => value
  ? new Date(value).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"})
  : "Not declared";
const shorthand = (text:string) => text.length>20
  ? text.slice(0,12)+"…"+text.slice(-6):text;
const chip=(kind:"good"|"warn"|"muted")=>kind==="good"
  ?"bg-wk-success-soft text-wk-success":
  kind==="warn"?"bg-wk-warning-soft text-wk-warning":"bg-wk-surface-raised text-wk-text-muted";
const buttonPrimary = "rounded-xl bg-wk-brand px-4 py-2.5 text-[12px] font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const buttonSecondary = "rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[12px] font-bold text-wk-text hover:bg-wk-surface-raised/70 disabled:cursor-not-allowed disabled:opacity-40";
const fieldClass = "w-full min-w-0 rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand";

async function invokeStudio(mode:string,body:Record<string,unknown> = {}) {
  const {data,error}=await supabase.functions.invoke("charts2-capture?mode="+mode,{
    body,
  });
  if(error || !data?.ok) {
    throw new Error(
      (data && typeof data.error==="string" ? data.error : error?.message)
      ?? "charts2_studio_operation_failed"
    );
  }
  return data;
}

export default function ChartsStudioPage() {
  const admin=useAdminUser();
  const [tab,setTab]=useState<Tab>("sources");
  const [snapshot,setSnapshot]=useState<StudioResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [week,setWeek]=useState("");
  const [probes,setProbes]=useState<Partial<Record<SourceKey,Probe>>>({});
  const [sourceConsent,setSourceConsent]=useState<SourceKey|null>(null);
  const [holdReason,setHoldReason]=useState("");
  const [reviewFilter,setReviewFilter]=useState<SourceKey|"all">("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(0);
  const [selected,setSelected]=useState<EvidenceRow|null>(null);
  const [registryQuery,setRegistryQuery]=useState("");
  const [registryMatches,setRegistryMatches]=useState<RegistryTrack[]>([]);
  const [selectedTrack,setSelectedTrack]=useState<RegistryTrack|null>(null);
  const [reviewNote,setReviewNote]=useState("");
  const [evidenceUrl,setEvidenceUrl]=useState("");
  const [reviewConsent,setReviewConsent]=useState(false);
  const [freezeConsent,setFreezeConsent]=useState(false);
  const [showAllAppearances,setShowAllAppearances]=useState(false);
  const [showAllAppleLeads,setShowAllAppleLeads]=useState(false);
  const [reviewSongQuery,setReviewSongQuery]=useState("");
  const [reviewMultipleOnly,setReviewMultipleOnly]=useState(false);
  const [appleSongs,setAppleSongs]=useState<Record<string,VerifiedAppleChartSong>>({});
  const [artistAliases,setArtistAliases]=useState<ReviewedArtistAlias[]>([]);
  const [registryArtists,setRegistryArtists]=useState<ReviewedArtist[]>([]);
  const [aliasLookupWarning,setAliasLookupWarning]=useState(false);
  const [showAllDuplicateGroups,setShowAllDuplicateGroups]=useState(false);
  const [batchMode,setBatchMode]=useState(false);
  const [batchRows,setBatchRows]=useState<EvidenceRow[]>([]);

  useEffect(()=>{
    if(tab!=="preview" || !snapshot?.native_review) return;
    const requested=new Map<string,string>();
    for(const entry of snapshot.native_review.entries){
      for(const position of entry.contributions){
        if(position.source_key==="apple_ke" && position.provider_track_id)
          requested.set(position.provider_track_id,entry.title);
      }
    }
    for(const lead of snapshot.native_review.apple_title_review){
      if(lead.apple_provider_track_id)
        requested.set(lead.apple_provider_track_id,lead.title);
    }
    const controller=new AbortController();
    let current=true;
    void loadVerifiedAppleChartSongs([...requested].map(([id,title])=>({id,title})),
      controller.signal).then(songs=>{
        if(current)setAppleSongs(songs);
      }).catch(()=>{
        if(current)setAppleSongs({});
      });
    return ()=>{current=false;controller.abort();};
  },[tab,snapshot?.native_review]);


  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try {setSnapshot(await invokeStudio("studio_preview") as StudioResponse);}
    catch(e){setError(e instanceof Error?e.message:"studio_load_failed");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!snapshot?.preview)return;
    let active=true;
    void Promise.all([
      supabase.from("registry_artist_aliases")
        .select("alias_slug,alias_display_name,canonical_artist_id")
        .eq("status","active").limit(500),
      supabase.from("registry_artists")
        .select("id,display_name").eq("status","active").limit(1500),
    ]).then(([aliases,artists])=>{
      if(!active)return;
      setArtistAliases((aliases.data??[]) as ReviewedArtistAlias[]);
      setRegistryArtists((artists.data??[]) as ReviewedArtist[]);
      setAliasLookupWarning(Boolean(aliases.error||artists.error));
    }).catch(()=>{if(active)setAliasLookupWarning(true);});
    return ()=>{active=false;};
  },[snapshot?.preview]);

  const operate=async(key:string,fn:()=>Promise<void>)=>{
    if(busy)return;
    setBusy(key);setError("");setNotice("");
    try {await fn();}
    catch(e){setError(e instanceof Error?e.message:"charts2_operation_failed");}
    finally{setBusy("");}
  };
  const sourceAction=async(source:SourceKey,mode:"verify_method"|"collect")=>
    operate(mode+source,async()=>{
      const payload:Record<string,unknown>={source_key:source};
      if(source==="youtube_ke"){
        if(!/^weekly:\d{8}:\d{8}:ke$/.test(week.trim()))
          throw new Error("Enter the genuine YouTube provider week in weekly:YYYYMMDD:YYYYMMDD:ke format.");
        payload.target_period_key=week.trim();
      }
      const result=await invokeStudio(mode,payload);
      if(mode==="verify_method"){
        setProbes(old=>({...old,[source]:result as Probe}));
        setSourceConsent(null);
        setNotice(SOURCE_LABEL[source]+": genuine original verified. Review the SHA and depth before approval.");
      }else{
        setNotice(SOURCE_LABEL[source]+": "+String(result.status)+". Evidence receipt recorded.");
        await refresh();
      }
    });
  const approval=async(source:SourceKey)=>
    operate("approve"+source,async()=>{
      const probe=probes[source];
      if(!probe||sourceConsent!==source)throw new Error("Verify the current source and explicitly consent before admission.");
      // YouTube's already-deployed approval contract predates the Studio's
      // display label: exact SQL attestation omits the word "Weekly".
      const firstParty=source==="youtube_ke"
        ?"YouTube Kenya Top Songs":SOURCE_LABEL[source];
      const method=source==="youtube_ke"?"POST":"GET";
      const acknowledgement="I approve first-party "+firstParty+" "+method+
        " for evidence-only manual collection.";
      const result=await invokeStudio("review_method",{
        source_key:source,action:"admit",probe_id:probe.probe_id,
        expected_revision:probe.expected_revision,acknowledgement,
      });
      setNotice(firstParty+": "+String(result.review_state)+
        ". Authorization expires "+DATE(result.authorization_expires_at)+".");
      setProbes(old=>({...old,[source]:undefined}));
      setSourceConsent(null);
      await refresh();
    });
  const hold=async(source:SourceKey,revision:number)=>
    operate("hold"+source,async()=>{
      if(holdReason.trim().length<24)
        throw new Error("Give a source-specific hold reason (at least 24 characters).");
      const result=await invokeStudio("review_method",{
        source_key:source,action:"hold",probe_id:null,expected_revision:revision,
        acknowledgement:holdReason.trim(),
      });
      setNotice(SOURCE_LABEL[source]+": "+String(result.review_state)+".");
      setHoldReason("");
      await refresh();
    });
  const lookUpTrack=async()=>operate("track-search",async()=>{
    if(!selected)throw new Error("Select a source observation first.");
    const result=await invokeStudio("studio_track_search",{query:registryQuery});
    setRegistryMatches(result.tracks??[]);
    setSelectedTrack(null);
  });
  const commitReview=async()=>operate("registry-link",async()=>{
    if(!admin.can("manage_registry"))
      throw new Error("Manage Registry permission is required for canonical provider-link review.");
    const rows=batchMode?batchRows:(selected?[selected]:[]);
    if(!rows.length||!selectedTrack||!reviewConsent)
      throw new Error("Select source rows, one existing Registry recording, and confirm your review.");
    if(rows.some(row=>!row.provider_track_id))
      throw new Error("Source rows without a provider ID cannot be linked.");
    if(new Set(rows.map(row=>row.source_key)).size!==rows.length)
      throw new Error("Choose only one source position per recording for this review.");
    if(reviewNote.trim().length<40)
      throw new Error("Document at least 40 characters of independent recording identity evidence.");
    if(!/^https:\/\//.test(evidenceUrl.trim()))
      throw new Error("Provide an independent HTTPS recording evidence URL.");
    let accepted=0;
    for(const row of rows){
      const source=snapshot?.preview?.source_coverage.find(x=>x.source_key===row.source_key);
      if(!source)throw new Error("The source receipt is no longer available. Reload the Studio.");
      try {
        // Each source goes through the existing actor-authorized Registry broker.
        // A failed later row never masquerades as an atomic batch success.
        await invokeStudio("studio_review_link",{
          source_key:row.source_key,rank:row.rank,
          receipt_id:source.receipt_id,original_sha256:source.original_sha256,
          track_id:selectedTrack.id,review_note:reviewNote.trim(),
          evidence_url:evidenceUrl.trim(),acknowledgement:DECLARATION,
        });
        accepted++;
      }catch(e){
        await refresh();
        const cause=e instanceof Error?e.message:"Review rejected";
        throw new Error(String(accepted)+" of "+String(rows.length)+
          " links accepted. "+SOURCE_LABEL[row.source_key]+" #"+row.rank+
          " was rejected: "+cause+". Accepted links remain recorded. Recheck before continuing.");
      }
    }
    setNotice(String(accepted)+" Registry source links accepted for "+selectedTrack.title+
      ". Private rankings are being recalculated.");
    setSelected(null);setSelectedTrack(null);setRegistryMatches([]);
    setBatchMode(false);setBatchRows([]);
    setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
    await refresh();
  });

  const gate=snapshot?.freeze_gate;
  const freezeCandidate=async()=>operate("private-freeze",async()=>{
    if(!admin.can("manage_charts")||!admin.can("manage_registry"))
      throw new Error("Charts and Registry review permissions are both required.");
    if(!gate?.freeze_ready||gate.eligible_count<100||
       gate.conflict_count!==0||!freezeConsent)
      throw new Error("The private freeze is blocked until 100 eligible recordings are verified.");
    const result=await invokeStudio("studio_freeze",{
      expected_input_sha256:gate.input_sha256,
      expected_previous_id:gate.latest_freeze_id,
      acknowledgement:FREEZE_DECLARATION,
    });
    setNotice("Private candidate frozen with 100 reviewed recordings. No public chart was changed."+
      (result.idempotent?" This exact evidence snapshot was already frozen.":""));
    setFreezeConsent(false);
    await refresh();
  });
  const preview=snapshot?.preview;
  const filteredReviewSongs=useMemo(()=>{
    const q=reviewSongQuery.trim().toLocaleLowerCase("en");
    return (snapshot?.native_review?.entries??[]).filter(entry=>
      (!reviewMultipleOnly||entry.contributions.length>1) &&
      (!q||(entry.title+" "+(entry.artist??"")).toLocaleLowerCase("en").includes(q))
    );
  },[snapshot?.native_review,reviewSongQuery,reviewMultipleOnly]);
  const songForEntry=(entry:NativeReviewEntry)=>{
    const apple=entry.contributions.find(c=>c.source_key==="apple_ke");
    return apple?.provider_track_id?appleSongs[apple.provider_track_id]??null:null;
  };

  const duplicateGroups=useMemo(()=>suggestRecordingReviewGroups(
    preview?.unresolved??[],artistAliases,registryArtists,
  ),[preview?.unresolved,artistAliases,registryArtists]);
  const openDuplicateGroup=(rows: EvidenceRow[])=>{
    const selectable=rows.filter(row=>Boolean(row.provider_track_id));
    if(!selectable.length)return;
    setBatchMode(true);setBatchRows([]);
    setSelected(selectable[0]);setRegistryQuery(selectable[0].title);
    setRegistryMatches([]);setSelectedTrack(null);
    setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
    setTab("review");
  };
  const coverage=preview?.source_coverage??[];
  const methods=snapshot?.source_methods??[];
  const unresolved=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("en");
    return (preview?.unresolved??[]).filter(x=>
      (reviewFilter==="all"||x.source_key===reviewFilter) &&
      (!q||(x.title+" "+(x.artist??"")+" "+(x.provider_track_id??"")).toLocaleLowerCase("en").includes(q)));
  },[preview,search,reviewFilter]);
  const displayed=unresolved.slice(page*20,(page+1)*20);
  const activeCount=methods.filter(x=>x.review_state==="collector_admitted"&&
    x.authorization_expires_at&&Date.parse(x.authorization_expires_at)>Date.now()).length;

  return (
    <main className="mx-auto max-w-[1440px] space-y-5 p-4 pb-16 sm:p-6" aria-label="Private Charts Studio">
      <AdminChartsPageHeader eyebrow="WAKILISHA / Charts 2.0"
        title="Charts Studio"
        description="Review the songs behind the chart and check their sources.">
        <button type="button" onClick={()=>void refresh()} disabled={loading||!!busy} className={buttonSecondary}>
          {loading?"Checking originals…":"Refresh verified evidence"}
        </button>
      </AdminChartsPageHeader>
      <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
        <span className={"rounded-full px-3 py-1 text-[11px] font-black "+chip(preview?"good":"warn")}>
          {loading?"Checking sources":preview?"Sources ready":"Sources unavailable"}
        </span>
        <span className="text-[12px] text-wk-text-muted">
          Private review only. Nothing is published from this page.
        </span>
      </div>
      {error && <WkSurface role="alert" className="border border-wk-danger p-4 text-[13px] text-wk-danger">{error}</WkSurface>}
      {notice && <WkSurface role="status" className="p-4 text-[13px] font-semibold text-wk-text">{notice}</WkSurface>}
      {!loading && snapshot?.state==="incomplete_source_set" &&
        <WkSurface className="p-5 text-wk-warning">
          Only {snapshot.receipt_count??0} of five original receipts are available. Private scoring is blocked.
        </WkSurface>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Music Sources",coverage.length+" / 5"],
          ["Chart Positions",String(coverage.reduce((n,x)=>n+x.observed_depth,0))],
          ["Confirmed Recordings",String(preview?.candidates.length??0)],
          ["Songs to Check",String((preview?.unresolved.length??0)+(preview?.conflicts.length??0))],
        ].map(([label,value])=>
          <WkSurface key={label} className="p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">{label}</p>
            <p className="mt-2 text-[27px] font-black tabular-nums text-wk-text">{loading?"…":value}</p>
          </WkSurface>
        )}
      </div>
      <nav aria-label="Charts Studio work areas" className="flex flex-wrap gap-2">
        {([
          ["sources","Sources"],["review","Song Review"],
          ["preview","Top 100"],["history","Source History"],
          ["freeze","Private Freeze"],
        ] as Array<[Tab,string]>).map(([id,label])=>
          <button type="button" key={id} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined}
            className={"rounded-xl px-4 py-2.5 text-[12px] font-bold transition-colors "+
              (tab===id?"bg-wk-brand text-white":"border border-wk-border bg-wk-surface text-wk-text")}>{label}</button>
        )}
      </nav>
      {tab==="sources" &&
        <section aria-label="Source health" className="space-y-3">
          <WkSurface className="p-4 text-[12px] text-wk-text-muted">
            A source's 24-hour admission can expire while its immutable evidence remains valid.
            New collection requires a fresh first-party probe and explicit approval.
            No collection is scheduled; every attempt requires an operator action.
          </WkSurface>
          {SOURCES.map(source=>{
            const cov=coverage.find(x=>x.source_key===source.key);
            const method=methods.find(x=>x.source_key===source.key);
            const admitted=method?.review_state==="collector_admitted"&&
              !!method.authorization_expires_at&&
              Date.parse(method.authorization_expires_at)>Date.now();
            const probe=probes[source.key];
            return <WkSurface key={source.key} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-black text-wk-text">{source.label}</h2>
                  <p className="mt-1 text-[12px] text-wk-text-muted">
                    {source.weight}% · Native {source.method} ·
                    {" "}{cov?cov.observed_depth+" / "+cov.expected_depth+" ranks":"No accepted receipt"}
                  </p>
                  <p className="mt-1 text-[11px] text-wk-text-muted">
                    Observed {DATE(cov?.observed_at)} · Provider week {DATE(cov?.provider_week_ending_date)}
                    {cov?.provider_updated_at?" · Provider updated "+DATE(cov.provider_updated_at):""}
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1 text-[11px] font-black "+chip(admitted?"good":"warn")}>
                  {admitted?"Admission active":"Method held or expired"}
                </span>
              </div>
              {source.key==="youtube_ke" &&
                <div className="max-w-sm space-y-1">
                  <label htmlFor="charts2-week" className="text-[11px] font-bold text-wk-text">Native YouTube provider week</label>
                  <input id="charts2-week" value={week} onChange={e=>setWeek(e.target.value)}
                    placeholder="weekly:YYYYMMDD:YYYYMMDD:ke" className={fieldClass}/>
                </div>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonSecondary} disabled={!!busy||loading}
                  onClick={()=>void sourceAction(source.key,"verify_method")}>Verify first-party original</button>
                <button type="button" className={buttonPrimary} disabled={!admitted||!!busy||loading}
                  onClick={()=>void sourceAction(source.key,"collect")}>Collect / retry</button>
              </div>
              {probe && <div className="space-y-3 rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                <p className="text-[12px] font-black text-wk-text">
                  Real probe verified · {probe.observed_depth}/{probe.expected_depth} ranks
                </p>
                <p className="break-all font-mono text-[11px] text-wk-text-muted">
                  SHA-256: {probe.original_sha256}
                </p>
                <WkCheckbox checked={sourceConsent===source.key}
                  onChange={checked=>setSourceConsent(checked?source.key:null)}>
                  I inspected this source, endpoint and original evidence, and explicitly approve a 24-hour evidence-only admission.
                </WkCheckbox>
                <button type="button" className={buttonPrimary} disabled={sourceConsent!==source.key||!!busy}
                  onClick={()=>void approval(source.key)}>Approve exact method</button>
              </div>}
              {method && <WkDisclosure className="text-[12px] text-wk-text-muted"
                summary="Method controls and revocation"
                triggerClassName="min-h-11 text-left font-bold text-wk-text underline underline-offset-4"
                contentClassName="space-y-2 pt-2">
                <p className="mt-2">Revision {method.method_revision} · Expires {DATE(method.authorization_expires_at)}</p>
                <label className="mt-2 block" htmlFor={"hold-"+source.key}>Reason for audited HOLD</label>
                <input id={"hold-"+source.key} value={holdReason} onChange={e=>setHoldReason(e.target.value)}
                  placeholder="Write a source-specific, factual hold reason" className={fieldClass}/>
                <button type="button" className={buttonSecondary} disabled={!!busy||holdReason.trim().length<24}
                  onClick={()=>void hold(source.key,method.method_revision)}>Hold / revoke method</button>
              </WkDisclosure>}
            </WkSurface>;
          })}
        </section>
      }
      {tab==="review" && <section aria-label="Recording identity review" className="space-y-4">
        <WkSurface className="p-4">
          <h2 className="text-[15px] font-black text-wk-text">Review Recordings</h2>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            Find songs that may be the same recording. Compare the versions, then choose
            which Registry recording they belong to. Your approval preserves each chart position.
            Entries without a source ID remain on the review list.
          </p>
          <p className="mt-2 text-[12px] font-semibold text-wk-text">
            {admin.can("manage_registry")?"Registry review capability available":
              "You can inspect the queue. A manage_registry steward must approve recording links."}
          </p>
          <Link className="text-[12px] font-bold text-wk-brand underline" to="/admin/registry/tracks">
            Open existing Registry track authority
          </Link>
        </WkSurface>
        <WkSurface className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-black text-wk-text">Songs That Might Match</h3>
              <p className="mt-1 text-[12px] text-wk-text-muted">
                {duplicateGroups.length} possible groups. Song titles and known artist names help us find them.
              </p>
            </div>
            {duplicateGroups.length>12 &&
              <button type="button" className={buttonSecondary}
                onClick={()=>setShowAllDuplicateGroups(value=>!value)}>
                {showAllDuplicateGroups?"Show Fewer":"Show All"}
              </button>}
          </div>
          {aliasLookupWarning &&
            <p className="text-[12px] text-wk-warning" role="status">
              We couldn’t check every artist alias. Please review the names carefully.
            </p>}
          <div className="divide-y divide-wk-border">
            {duplicateGroups.slice(0,showAllDuplicateGroups?undefined:12).map(group=>
              <div key={group.key} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-wk-text">{group.title}</p>
                  <p className="text-[11px] text-wk-text-muted">{group.reason}</p>
                  <p className="mt-1 text-[11px] text-wk-text-muted">
                    {group.observations.map(row=>SOURCE_LABEL[row.source_key as SourceKey].split(" ")[0]+
                      " #"+row.rank+" ("+(row.artist??"Artist not given")+")").join(" · ")}
                  </p>
                </div>
                <button type="button" className={buttonSecondary}
                  disabled={!!busy||!admin.can("manage_registry")||
                    !group.observations.some(row=>row.provider_track_id)}
                  onClick={()=>openDuplicateGroup(group.observations as EvidenceRow[])}>
                  Review Matches
                </button>
              </div>)}
            {!duplicateGroups.length &&
              <p className="py-3 text-[12px] text-wk-text-muted">No matching songs to review right now.</p>}
          </div>
          <Link to="/admin/registry/artist-aliases" className="text-[12px] font-bold text-wk-brand underline">
            Manage Artist Aliases
          </Link>
        </WkSurface>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Filter identity observations" value={search}
            onChange={e=>{setSearch(e.target.value);setPage(0);}}
            placeholder="Search titles, artists, provider IDs" className={fieldClass+" max-w-md"}/>
          {(["all",...SOURCES.map(x=>x.key)] as Array<SourceKey|"all">).map(s=>
            <button key={s} type="button"
              onClick={()=>{setReviewFilter(s);setPage(0);}}
              className={s===reviewFilter?buttonPrimary:buttonSecondary}>
              {s==="all"?"All":SOURCE_LABEL[s].split(" ")[0]}
            </button>
          )}
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <WkSurface className="overflow-hidden">
            <div className="border-b border-wk-border px-4 py-3 text-[12px] font-semibold text-wk-text-muted">
              {unresolved.length} unresolved · {preview?.conflicts.length??0} conflicts · page {page+1}
            </div>
            <div className="divide-y divide-wk-border">
              {displayed.map(row=>
                <div key={row.receipt_id+":"+row.rank} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-wk-text">#{row.rank} {row.title}</p>
                    <p className="text-[11px] text-wk-text-muted">{row.artist??"Artist not given"} · {SOURCE_LABEL[row.source_key]}</p>
                    <p className="mt-1 text-[11px] text-wk-warning">{row.reason.replaceAll("_"," ")}</p>
                  </div>
                  <button type="button" className={buttonSecondary}
                    disabled={!row.provider_track_id||!admin.can("manage_registry")}
                    onClick={()=>{
                      setBatchMode(false);setBatchRows([]);
                      setSelected(row);setRegistryQuery(row.title);
                      setRegistryMatches([]);setSelectedTrack(null);
                      setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
                    }}>
                    {row.provider_track_id?"Review exact identity":"No provider ID"}
                  </button>
                </div>)}
              {unresolved.length===0 && <p className="p-5 text-[13px] text-wk-text-muted">No unresolved observations in this filter.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-wk-border p-3">
              <button type="button" className={buttonSecondary} disabled={page===0}
                onClick={()=>setPage(Math.max(0,page-1))}>Previous</button>
              <span className="text-[12px] text-wk-text-muted">
                {Math.min(unresolved.length,page*20+1)}–{Math.min(unresolved.length,(page+1)*20)} of {unresolved.length}
              </span>
              <button type="button" className={buttonSecondary} disabled={(page+1)*20>=unresolved.length}
                onClick={()=>setPage(page+1)}>Next</button>
            </div>
          </WkSurface>
          <WkSurface className="space-y-3 p-4">
            <h2 className="text-[15px] font-black text-wk-text">Choose The Recording</h2>
            {!selected?<p className="text-[12px] text-wk-text-muted">
              Choose a song from the list to compare it with a Registry recording.
            </p>:<>
              {batchMode && <div className="space-y-2 rounded-lg border border-wk-border p-3">
                <p className="text-[12px] font-black text-wk-text">
                  Choose The Songs To Link ({batchRows.length} Selected)
                </p>
                <p className="text-[11px] text-wk-text-muted">
                  Select the verified matches. Choose only one position per source.
                </p>
                {duplicateGroups.find(group=>group.observations.some(row=>
                  row.receipt_id===selected.receipt_id&&row.rank===selected.rank))
                  ?.observations.map(row=>{
                    const checked=batchRows.some(item=>item.receipt_id===row.receipt_id&&
                      item.rank===row.rank);
                    return <WkCheckbox key={row.receipt_id+":"+row.rank}
                      checked={checked} disabled={!row.provider_track_id}
                      onChange={value=>setBatchRows(old=>value?
                        [...old.filter(item=>item.source_key!==row.source_key),row as EvidenceRow]:
                        old.filter(item=>!(item.receipt_id===row.receipt_id&&item.rank===row.rank)))}>
                      {SOURCE_LABEL[row.source_key as SourceKey].split(" ")[0]} #{row.rank}
                      {" "}· {row.title} · {row.artist??"Artist not given"}
                      {!row.provider_track_id?" (No provider ID)":""}
                    </WkCheckbox>;
                  })}
              </div>}
              <div className="rounded-lg bg-wk-surface-raised p-3">
                <p className="font-bold text-wk-text">{selected.title}</p>
                <p className="text-[12px] text-wk-text-muted">{selected.artist} · {SOURCE_LABEL[selected.source_key]} · #{selected.rank}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-wk-text-muted">{selected.provider_track_id}</p>
              </div>
              <label htmlFor="studio-registry-query" className="text-[12px] font-bold text-wk-text">Find The Recording To Keep</label>
              <div className="flex gap-2">
                <input id="studio-registry-query" value={registryQuery}
                  onChange={e=>setRegistryQuery(e.target.value)} className={fieldClass}/>
                <button type="button" className={buttonSecondary} disabled={!!busy||registryQuery.trim().length<2}
                  onClick={()=>void lookUpTrack()}>Search</button>
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {registryMatches.map(track=>
                  <button type="button" key={track.id} onClick={()=>setSelectedTrack(track)}
                    className={"w-full rounded-xl border p-3 text-left text-[12px] "+
                      (selectedTrack?.id===track.id?
                        "border-wk-brand bg-wk-brand-soft text-wk-text":
                        "border-wk-border bg-wk-surface text-wk-text")}>
                    <span className="block font-black">{track.title}</span>
                    <span className="block break-all font-mono text-[10px] text-wk-text-muted">{track.id}</span>
                    <span className="block text-[11px] text-wk-text-muted">ISRC: {track.isrc??"Not recorded"}</span>
                  </button>)}
              </div>
              <label htmlFor="studio-evidence" className="text-[12px] font-bold text-wk-text">Link To Recording Evidence</label>
              <input id="studio-evidence" type="url" className={fieldClass}
                placeholder="https://… specific recording / release evidence"
                value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)}/>
              <label htmlFor="studio-note" className="text-[12px] font-bold text-wk-text">Why Do These Songs Match?</label>
              <textarea id="studio-note" rows={4} className={fieldClass}
                placeholder="Add the matching ISRC, release details, or other evidence that confirms the recording."
                value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/>
              {batchMode &&
                <div className="space-y-2 rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                  <h3 className="text-[12px] font-black text-wk-text">Before You Approve</h3>
                  <p className="text-[12px] text-wk-text">
                    {batchRows.length} chart positions will link to
                    {" "}<strong>{selectedTrack?.title??"the Registry recording you choose"}</strong>.
                  </p>
                  <p className="text-[11px] text-wk-text-muted">
                    We’ll keep every original chart position. We won’t delete tracks, change
                    artist aliases, or publish a chart. If one link fails, accepted links stay recorded.
                  </p>
                </div>}
              <WkCheckbox checked={reviewConsent} onChange={setReviewConsent}>
                {DECLARATION}
              </WkCheckbox>
              <button type="button" className={buttonPrimary} disabled={!!busy||!selectedTrack||
                (batchMode&&!batchRows.length)||!reviewConsent||
                reviewNote.trim().length<40||!evidenceUrl.startsWith("https://")}
                onClick={()=>void commitReview()}>
                {batchMode?"Confirm Selected Matches":"Confirm Recording Match"}
              </button>
              <p className="text-[11px] text-wk-text-muted">Every approved match is recorded in the Registry. This won’t change the public chart.</p>
            </>}
          </WkSurface>
        </div>
      </section>}


      {tab==="preview" && snapshot?.native_review?.contract==="charts2-private-native-review/v1" &&
        <section aria-label="Recording chart review" className="space-y-5">
          <WkSurface className="overflow-hidden">
            <div className="border-b border-wk-border bg-wk-surface-raised/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-[var(--wk-font-display)] text-[24px] font-black tracking-[-0.04em] text-wk-text sm:text-[30px]">
                    Top 100 to Review
                  </h2>
                  <p className="mt-1 text-[12px] text-wk-text-muted">
                    Songs from Kenya’s leading music charts. Check the recording before approval.
                  </p>
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-wk-text-soft">
                  {filteredReviewSongs.length} of {snapshot.native_review.count}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label htmlFor="charts-studio-track-search" className="sr-only">Find a song or artist</label>
                <input id="charts-studio-track-search" type="text" inputMode="search"
                  value={reviewSongQuery} onChange={event=>setReviewSongQuery(event.target.value)}
                  placeholder="Find a song or artist"
                  className={fieldClass+" min-w-[180px] flex-1 sm:max-w-[360px]"}/>
                {reviewSongQuery &&
                  <button type="button" onClick={()=>setReviewSongQuery("")}
                    className={buttonSecondary} aria-label="Clear Song Search">Clear</button>}
                <button type="button" aria-pressed={!reviewMultipleOnly}
                  className={!reviewMultipleOnly?buttonPrimary:buttonSecondary}
                  onClick={()=>setReviewMultipleOnly(false)}>All Songs</button>
                <button type="button" aria-pressed={reviewMultipleOnly}
                  className={reviewMultipleOnly?buttonPrimary:buttonSecondary}
                  onClick={()=>setReviewMultipleOnly(true)}>Multiple Charts</button>
              </div>
            </div>
            <div>
              {filteredReviewSongs.map((entry,i)=>
                <StudioChartMusicRow key={entry.position??i} entry={entry}
                  catalogSong={songForEntry(entry)}/>)}
              {!filteredReviewSongs.length &&
                <p className="px-5 py-8 text-center text-[13px] text-wk-text-muted">
                  No songs match this search.
                </p>}
            </div>
          </WkSurface>
          <WkSurface className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wk-border px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-[16px] font-black text-wk-text">Across More Than One Chart</h3>
                <p className="mt-1 text-[12px] text-wk-text-muted">
                  {snapshot.native_review.multi_source_occurrences.length} songs to check across charts.
                </p>
              </div>
              <button type="button" className={buttonSecondary}
                onClick={()=>setShowAllAppearances(v=>!v)}>
                {showAllAppearances?"Show Fewer":"Show All Matches"}
              </button>
            </div>
            <div>
              {snapshot.native_review.multi_source_occurrences
                .slice(0,showAllAppearances?undefined:12).map((entry,i)=>
                <StudioChartMusicRow key={entry.title+"-"+i} entry={entry}
                  catalogSong={songForEntry(entry)} compact/>)}
            </div>
          </WkSurface>
          <WkSurface className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wk-border px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-[16px] font-black text-wk-text">Apple Music Matches to Check</h3>
                <p className="mt-1 text-[12px] text-wk-text-muted">
                  {snapshot.native_review.apple_title_review.length} possible matches. Check before combining songs.
                </p>
              </div>
              <button type="button" className={buttonSecondary}
                onClick={()=>setShowAllAppleLeads(v=>!v)}>
                {showAllAppleLeads?"Show Fewer":"Show All Titles"}
              </button>
            </div>
            <div>
              {snapshot.native_review.apple_title_review
                .slice(0,showAllAppleLeads?undefined:8).map((lead,i)=>
                <div key={lead.apple_provider_track_id??i}>
                  <StudioChartMusicRow compact
                    entry={{title:lead.title,artist:null,
                      contributions:[{source_key:"apple_ke",native_rank:lead.apple_rank,
                        provider_track_id:lead.apple_provider_track_id}]}}
                    catalogSong={lead.apple_provider_track_id?
                      appleSongs[lead.apple_provider_track_id]??null:null}/>
                  <p className="-mt-2 px-4 pb-3 pl-[84px] text-[11px] text-wk-text-muted sm:pl-[102px]">
                    Also on {lead.possible_sources.map(k=>SOURCE_LABEL[k].split(" ")[0]).join(", ")}
                  </p>
                </div>)}
            </div>
          </WkSurface>
        </section>}
      {tab==="preview" && (preview?.candidates.length??0)>0 &&
        <section aria-label="Reviewed Registry recordings" className="space-y-4">
          <WkSurface className="overflow-hidden">
            <div className="border-b border-wk-border p-4">
              <h2 className="text-[15px] font-black text-wk-text">Confirmed Recordings</h2>
              <p className="mt-1 text-[12px] text-wk-text-muted">
                These songs have reviewed Registry links.
              </p>
            </div>
            {(preview?.candidates??[]).slice(0,100).map((candidate,i)=>
              <div key={candidate.track_id}
                className="flex items-center gap-3 border-b border-wk-border px-4 py-3 last:border-0">
                <strong className="w-7 text-[13px] tabular-nums text-wk-text">{i+1}</strong>
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-wk-text">
                  {candidate.track_id}
                </span>
                <strong className="text-[14px] tabular-nums text-wk-text">
                  {candidate.score_points}
                </strong>
              </div>)}
          </WkSurface>
        </section>}
      {tab==="history" && <section aria-label="Immutable capture receipt history" className="space-y-3">
        <WkSurface className="p-4 text-[12px] text-wk-text-muted">
          The latest 35 immutable original-receipt records, without exposing raw Storage objects.
          The Edge worker independently rehashed the five selected originals for this Studio snapshot.
        </WkSurface>
        {(snapshot?.history??[]).map(row=>
          <WkSurface key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-black text-wk-text">{SOURCE_LABEL[row.source_key]}</p>
              <p className="text-[12px] text-wk-text-muted">{DATE(row.observed_at)} · {row.observed_depth}/{row.expected_depth} ranks · {row.observed_status}</p>
              <p className="mt-1 font-mono text-[11px] text-wk-text-muted">SHA {shorthand(row.original_sha256)} · Receipt {shorthand(row.id)}</p>
            </div>
            <span className={"rounded-full px-3 py-1 text-[11px] font-bold "+chip(row.observed_status==="succeeded"?"good":"warn")}>
              {row.native_period_authority.replaceAll("_"," ")}
            </span>
          </WkSurface>)}
      </section>}
      {tab==="freeze" && <section aria-label="Private chart freeze controls" className="space-y-4">
        <WkSurface className="space-y-3 p-5">
          <h2 className="text-[16px] font-black text-wk-text">Freeze a Private Top 100</h2>
          <p className="text-[13px] text-wk-text-muted">
            Only recordings verified in the Registry can enter this candidate.
            A freeze preserves the exact scores and five original receipts. It does not publish a chart.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-wk-surface-raised p-3">
              <p className="text-[11px] font-bold text-wk-text-muted">Eligible Recordings</p>
              <p className="text-[22px] font-black tabular-nums text-wk-text">
                {gate?.eligible_count??0} / 100
              </p>
            </div>
            <div className="rounded-xl bg-wk-surface-raised p-3">
              <p className="text-[11px] font-bold text-wk-text-muted">Open Reviews</p>
              <p className="text-[22px] font-black tabular-nums text-wk-text">{gate?.unresolved_count??0}</p>
            </div>
            <div className="rounded-xl bg-wk-surface-raised p-3">
              <p className="text-[11px] font-bold text-wk-text-muted">Identity Conflicts</p>
              <p className="text-[22px] font-black tabular-nums text-wk-text">{gate?.conflict_count??0}</p>
            </div>
            <div className="rounded-xl bg-wk-surface-raised p-3">
              <p className="text-[11px] font-bold text-wk-text-muted">Private Freezes</p>
              <p className="text-[22px] font-black tabular-nums text-wk-text">{gate?.recent_freezes?.length??0}</p>
            </div>
          </div>
          <p className={"text-[12px] font-bold "+(gate?.freeze_ready?"text-wk-success":"text-wk-warning")}>
            {gate?.freeze_ready
              ?"The database confirms 100 eligible tracks with no conflicts."
              :"The database is holding the freeze until enough recordings have verified Registry links."}
          </p>
          {gate && <p className="break-all rounded-lg border border-wk-border p-3 font-mono text-[11px] text-wk-text-muted">
            Exact evidence digest: {gate.input_sha256}
          </p>}
          <WkCheckbox checked={freezeConsent} onChange={setFreezeConsent}
            disabled={!gate?.freeze_ready||!admin.can("manage_registry")}>
            {FREEZE_DECLARATION}
          </WkCheckbox>
          <button type="button" className={buttonPrimary}
            disabled={!freezeConsent||!gate?.freeze_ready||!admin.can("manage_registry")||!!busy||loading}
            onClick={()=>void freezeCandidate()}>
            Freeze Exact 100-Recording Private Candidate
          </button>
          <p className="text-[12px] text-wk-text-muted">
            WAKILISHA checks your Charts and Registry permissions again on the server.
            A changed original, Registry link, or earlier freeze invalidates this confirmation.
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <h3 className="text-[14px] font-black text-wk-text">Immutable Freeze History</h3>
          {(gate?.recent_freezes??[]).length===0
            ?<p className="mt-3 text-[12px] text-wk-text-muted">
              No private candidate has passed the 100-recording gate yet.
            </p>
            :(gate?.recent_freezes??[]).map(item=>
              <div key={item.id} className="mt-3 border-t border-wk-border pt-3">
                <p className="text-[12px] font-bold text-wk-text">{DATE(item.frozen_at)}. Private only.</p>
                <p className="mt-1 break-all font-mono text-[11px] text-wk-text-muted">
                  Frozen candidate: {item.id}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-wk-text-muted">
                  Ranking SHA-256: {item.ranking_sha256}
                </p>
              </div>)}
        </WkSurface>
      </section>}
      <footer className="border-t border-wk-border pt-4 text-[11px] text-wk-text-muted">
        Five-source evidence is private. Identity review is performed through Registry/MIZIZI authority.
        No public edition is staged, frozen or published here.
        {" "}Verified methods active: {activeCount}/5.
      </footer>
    </main>
  );
}
