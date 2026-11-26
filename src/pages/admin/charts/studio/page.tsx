import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {appendChartReviewReference,parseChartReviewReference,appendChartIntakeBatch,parseChartIntakeBatch,writeChartIntakeBatch,type ChartReviewReference,prepareChartTrackIntakes,TRACK_INTAKE_BATCH_LIMIT,type TrackIntakeBatchResult} from "@/services/chartsPrivate/chartReviewContext";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "@/hooks/useAdminUser";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { WkUploadField } from "@/components/design-system/primitives/UploadField";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSearchField } from "@/components/design-system/primitives/Field";
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
type ShazamReviewEvent = {
  id:string;source_key:"shazam_ke";receipt_id:string;original_sha256:string;
  rank:number;title:string;artist:string|null;track_id:string|null;
  action:"approve"|"revoke";event_fingerprint:string;
};
type StudioResponse = {
  ok: boolean; state: string; preview?: Preview; native_review?: NativeReview | null; freeze_gate?: FreezeGate;
  server_verified_originals?: number; source_methods?: SourceMethod[];
  history?: ReceiptHistory[]; read_at?: string;
  observation_reviews?:ShazamReviewEvent[];
  receipt_count?: number; source_coverage?:Coverage[]; error?: string;
};
type RegistryTrack = {
  id: string; title: string; isrc: string | null; status: string;
  slug: string | null; duration_ms: number | null;
  artist_names: string[];
  artist_credits: Array<{
    name:string;is_primary:boolean;origin_iso2:string|null;artist_status:string|null
  }>;
  provider_keys: string[];
};
type RegistryDiscoveryPosition = EvidenceRow & {
  candidate_count:number;
  credit_evidence:"artist_not_supplied"|"artist_credit_agrees"|"artist_credit_unconfirmed";
};
type RegistryDiscoveryGroup = {track:RegistryTrack;positions:RegistryDiscoveryPosition[]};
type RegistryDiscovery = {
  contract:"charts2-registry-discovery/v1";candidate_only:true;can_publish:false;
  source_coverage:Coverage[];unresolved_count:number;catalogue_scanned:number;
  unique_positions:number;ambiguous_positions:number;unmatched_positions:number;
  groups:RegistryDiscoveryGroup[];
};
// Ephemeral operator draft, never an approval or an authority receipt.
// Exact current preview and source coordinates are required for restoration.
type RecordingReviewDraftContext = {
  preview:Preview; key:string; anchor:EvidenceRow; batch:boolean;
  groupRows:Array<EvidenceRow|RegistryDiscoveryPosition>;
};
type RecordingReviewDraft = {
  context:RecordingReviewDraftContext; registryQuery:string;
  registryMatches:RegistryTrack[]; registrySearchAttempted:boolean;
  selectedTrack:RegistryTrack|null; batchRows:EvidenceRow[];
  evidenceUrl:string; reviewNote:string;
};
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
const YOUTUBE_EXPORT_ENDPOINT = "https://charts.youtube.com/charts/TopSongs/ke";
const YOUTUBE_EXPORT_ACK = "I confirm this unmodified YouTube Charts CSV is Kenya Weekly Top Songs for the selected week.";
const YOUTUBE_EXPORT_PERIOD_AUTHORITY = "operator_confirmed_official_export";
const DECLARATION = "I have independently verified this exact recording and authorize its Registry provider link.";
const SHAZAM_DECLARATION = "I independently verified this exact Shazam position and authorize its private Registry recording resolution.";
const SHAZAM_REVOKE_DECLARATION = "I revoke this exact private Shazam recording resolution after independent re-review.";
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

async function invokeStudio(mode:string,body:Record<string,unknown>|FormData = {}) {
  const {data,error}=await supabase.functions.invoke("charts2-capture?mode="+mode,{
    body,
  });
  if(error || !data?.ok) {
    let detail=data&&typeof data.error==="string"?data.error:undefined;
    if(error&&typeof error==="object"&&"context" in error&&error.context instanceof Response){
      try {
        const responseBody=await error.context.clone().json();
        if(typeof responseBody?.error==="string")detail=responseBody.error;
      } catch { /* The transport error remains available. */ }
    }
    throw new Error(detail??error?.message??"charts2_studio_operation_failed");
  }
  return data;
}

export default function ChartsStudioPage() {
  const admin=useAdminUser();
  const navigate=useNavigate();
  const [urlParams,setUrlParams]=useSearchParams();
  const intakeSelection=useMemo(()=>parseChartIntakeBatch(urlParams),[urlParams]);
  const withIntakeBatch=(href:string)=>appendChartIntakeBatch(href,intakeSelection);
  const returnContext=parseChartReviewReference(urlParams);
  const returnContextKey=returnContext?JSON.stringify(returnContext):"";
  const returnLoaded=useRef("");
  const [tab,setTab]=useState<Tab>(intakeSelection.length?"review":"sources");
  const [snapshot,setSnapshot]=useState<StudioResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [week,setWeek]=useState("");
  const [youtubeExport,setYoutubeExport]=useState<{file:File;sha:string}|null>(null);
  const [exportConsent,setExportConsent]=useState(false);
  const [exportHashing,setExportHashing]=useState(false);
  const exportSelection=useRef(0);
  const [probes,setProbes]=useState<Partial<Record<SourceKey,Probe>>>({});
  const [sourceConsent,setSourceConsent]=useState<SourceKey|null>(null);
  const [holdReason,setHoldReason]=useState("");
  const [reviewFilter,setReviewFilter]=useState<SourceKey|"all">("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(0);
  const [selected,setSelected]=useState<EvidenceRow|null>(null);
  const recordingReviewHeading=useRef<HTMLHeadingElement>(null);
  const recordingQueueHeading=useRef<HTMLHeadingElement>(null);
  const reviewWasOpen=useRef(false);
  useEffect(()=>{
    if(tab!=="review")return;
    if(selected){
      recordingReviewHeading.current?.focus();
      reviewWasOpen.current=true;
    }else if(reviewWasOpen.current){
      recordingQueueHeading.current?.focus();
      reviewWasOpen.current=false;
    }
  },[selected,tab]);
  const [registryQuery,setRegistryQuery]=useState("");
  const [registryMatches,setRegistryMatches]=useState<RegistryTrack[]>([]);
  const [registrySearchAttempted,setRegistrySearchAttempted]=useState(false);
  const registrySearchSequence=useRef(0);
  const [selectedTrack,setSelectedTrack]=useState<RegistryTrack|null>(null);
  const [registryDiscovery,setRegistryDiscovery]=useState<{preview:Preview;result:RegistryDiscovery}|null>(null);
  const [registryDiscoveryError,setRegistryDiscoveryError]=useState("");
  const [registryDiscoveryLoading,setRegistryDiscoveryLoading]=useState(false);
  const [registryDiscoveryRetry,setRegistryDiscoveryRetry]=useState(0);
  const [showAllRegistryGroups,setShowAllRegistryGroups]=useState(false);
  const [reviewGroupRows,setReviewGroupRows]=useState<Array<EvidenceRow|RegistryDiscoveryPosition>>([]);
  const activeReviewContext=useRef<RecordingReviewDraftContext|null>(null);
  const [savedReviewDraft,setSavedReviewDraft]=useState<RecordingReviewDraft|null>(null);
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
  const [intakeResults,setIntakeResults]=useState<TrackIntakeBatchResult[]>([]);
  const [intakeConsent,setIntakeConsent]=useState(false);
  const intakeRunning=useRef(false);

  useEffect(()=>{
    if(tab!=="preview" && tab!=="review")return;
    const requested=new Map<string,string>();
    if(tab==="preview" && snapshot?.native_review){
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
    }
    if(tab==="review"){
      // Official exact-ID catalogue observation augments, never rewrites, the
      // Apple chart original, which does not contain artist credit fields.
      for(const row of snapshot?.preview?.unresolved??[]){
        if(row.source_key==="apple_ke" && row.provider_track_id)
          requested.set(row.provider_track_id,row.title);
      }
    }
    if(!requested.size)return;
    const controller=new AbortController();
    let current=true;
    void loadVerifiedAppleChartSongs([...requested].map(([id,title])=>({id,title})),
      controller.signal).then(songs=>{
        if(current)setAppleSongs(songs);
      }).catch(()=>{
        if(current)setAppleSongs({});
      });
    return ()=>{current=false;controller.abort();};
  },[tab,snapshot?.native_review,snapshot?.preview?.unresolved]);


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
    void supabase.from("registry_artist_aliases")
      .select("alias_slug,alias_display_name,canonical_artist_id,registry_artists!inner(id,display_name)")
      .eq("status","active").limit(1000).then(result=>{
        if(!active)return;
        if(result.error){
          setArtistAliases([]);setRegistryArtists([]);setAliasLookupWarning(true);
          return;
        }
        type AliasResult = ReviewedArtistAlias & {registry_artists:ReviewedArtist | null};
        const reviewed=(result.data??[]) as AliasResult[];
        setArtistAliases(reviewed.map(({alias_slug,alias_display_name,canonical_artist_id})=>({
          alias_slug,alias_display_name,canonical_artist_id,
        })));
        setRegistryArtists(reviewed.map(row=>row.registry_artists)
          .filter((artist):artist is ReviewedArtist=>Boolean(artist)));
        setAliasLookupWarning(false);
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
  const chooseYouTubeExport=async(file:File|null)=>{
    const selection=++exportSelection.current;
    setYoutubeExport(null);setExportConsent(false);setExportHashing(false);
    if(!file)return;
    setError("");setNotice("");
    if(!/\.csv$/i.test(file.name)||file.size<1||file.size>4000000){
      setError("Choose the original YouTube CSV, up to 4 MB.");return;
    }
    setExportHashing(true);
    try{
      const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
      const sha=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
      if(selection===exportSelection.current)setYoutubeExport({file,sha});
    }catch{
      if(selection===exportSelection.current)setError("Could not verify the selected file.");
    }finally{
      if(selection===exportSelection.current)setExportHashing(false);
    }
  };
  const importYouTubeExport=async()=>operate("youtube-export",async()=>{
    if(!youtubeExport||!exportConsent||!/^weekly:\d{8}:\d{8}:ke$/.test(week.trim()))
      throw new Error("Select the original file, enter its week, and confirm the source.");
    const selected=youtubeExport;
    const form=new FormData();
    form.append("source_key","youtube_ke");
    form.append("source_endpoint",YOUTUBE_EXPORT_ENDPOINT);
    form.append("target_period_key",week.trim());
    form.append("original_sha256",selected.sha);
    form.append("acknowledgement",YOUTUBE_EXPORT_ACK);
    form.append("original",new Blob([selected.file],{type:"text/csv"}),selected.file.name);
    const result=await invokeStudio("upload_official_youtube_export",form);
    if(result.original_sha256!==selected.sha||result.observed_depth!==100||
       typeof result.receipt_id!=="string"||result.status!=="succeeded"||
       result.source_method_state!=="official_export_not_collector_admitted"||
       result.can_score!==false||result.can_publish!==false)
      throw new Error("The receipt response could not be verified. Refresh Source History before retrying.");
    setYoutubeExport(null);setExportConsent(false);
    setNotice("YouTube: official CSV verified. Evidence receipt recorded. Automatic collection remains on hold.");
    await refresh();
  });
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
  const reviewShazamCorrection=async()=>operate("shazam-revoke",async()=>{
    if(!selected || selected.source_key!=="shazam_ke" || selected.provider_track_id)
      throw new Error("Only a previously reviewed Shazam position can be corrected.");
    const coverage=snapshot?.preview?.source_coverage.find(x=>
      x.source_key==="shazam_ke"&&x.receipt_id===selected.receipt_id);
    const previous=snapshot?.observation_reviews?.find(e=>
      e.source_key==="shazam_ke"&&e.receipt_id===selected.receipt_id&&
      e.rank===selected.rank&&e.action==="approve");
    if(!coverage||!previous)
      throw new Error("This approved Shazam review is no longer current.");
    if(!reviewConsent || reviewNote.trim().length<40 ||
       !/^https:\/\//.test(evidenceUrl.trim()))
      throw new Error("Independent evidence, explanation and explicit revocation consent are required.");
    await invokeStudio("studio_review_no_id",{
      action:"revoke",source_key:"shazam_ke",
      receipt_id:coverage.receipt_id,original_sha256:coverage.original_sha256,
      rank:selected.rank,track_id:null,review_note:reviewNote.trim(),
      evidence_url:evidenceUrl.trim(),acknowledgement:SHAZAM_REVOKE_DECLARATION,
    });
    setSavedReviewDraft(null);activeReviewContext.current=null;
    setSelected(null);setSelectedTrack(null);setReviewConsent(false);
    setNotice("Shazam position #"+selected.rank+" review revoked. Its private rank credit is removed.");
    await refresh();
  });
  const lookUpTrack=async()=>{
    const q=registryQuery.trim();
    const sequence=++registrySearchSequence.current;
    setRegistrySearchAttempted(false);
    setRegistryMatches([]);
    setSelectedTrack(null);setReviewConsent(false);
    await operate("track-search",async()=>{
      if(!selected)throw new Error("Select a source observation first.");
      if(q.length<2)throw new Error("Enter at least two characters.");
      const result=await invokeStudio("studio_track_search",{query:q});
      if(sequence!==registrySearchSequence.current)return;
      setRegistryMatches(result.tracks??[]);
      setRegistrySearchAttempted(true);
    });
  };
  const commitReview=async()=>operate("registry-link",async()=>{
    if(!admin.can("manage_registry")||!admin.can("manage_charts"))
      throw new Error("Both Registry and Charts review permission are required.");
    const rows=batchMode?batchRows:(selected?[selected]:[]);
    if(!rows.length||!selectedTrack||!reviewConsent)
      throw new Error("Select source rows, one existing Registry recording, and confirm your review.");
    if(rows.some(row=>!row.provider_track_id&&row.source_key!=="shazam_ke"))
      throw new Error("Only reviewed Shazam positions may resolve without a provider recording ID.");
    if(new Set(rows.map(row=>row.source_key)).size!==rows.length)
      throw new Error("Choose only one source position per recording for this review.");
    if(reviewNote.trim().length<40)
      throw new Error("Document at least 40 characters of independent recording identity evidence.");
    if(!/^https:\/\//.test(evidenceUrl.trim()))
      throw new Error("Provide an independent HTTPS recording evidence URL.");
    let accepted=0;
    for(const row of rows){
      const source=snapshot?.preview?.source_coverage.find(x=>x.source_key===row.source_key&&x.receipt_id===row.receipt_id);
      const original=snapshot?.preview?.unresolved.find(x=>
        x.source_key===row.source_key&&x.receipt_id===row.receipt_id&&x.rank===row.rank&&
        x.title===row.title&&x.artist===row.artist&&x.provider_track_id===row.provider_track_id);
      if(!source||!original)throw new Error("The source position has changed or already been resolved. Reload the Studio.");
      try {
        // No-ID Shazam is NOT a Registry provider link. Each source decision
        // has its own accepted caller-authorized broker and durable receipt.
        const noId=row.source_key==="shazam_ke"&&!row.provider_track_id;
        await invokeStudio(noId?"studio_review_no_id":"studio_review_link",{
          source_key:row.source_key,rank:row.rank,
          receipt_id:source.receipt_id,original_sha256:source.original_sha256,
          track_id:selectedTrack.id,review_note:reviewNote.trim(),
          evidence_url:evidenceUrl.trim(),
          ...(noId?{action:"approve" as const}:{}),
          acknowledgement:noId?SHAZAM_DECLARATION:DECLARATION,
        });
        accepted++;
      }catch(e){
        // A partially accepted batch must not be blindly resubmitted. Reopen
        // from the newly recomputed queue to review only outstanding sources.
        setSavedReviewDraft(null);activeReviewContext.current=null;
        setReviewConsent(false);
        await refresh();
        if(accepted>0){
          setBatchMode(false);setBatchRows([]);setSelected(null);
          setSelectedTrack(null);setReviewConsent(false);
        }
        const cause=e instanceof Error?e.message:"Review rejected";
        throw new Error(String(accepted)+" of "+String(rows.length)+
          " reviews accepted. "+SOURCE_LABEL[row.source_key]+" #"+row.rank+
          " was rejected: "+cause+". Accepted decisions remain recorded. Recheck before continuing.");
      }
    }
    setNotice(String(accepted)+" independently reviewed chart positions recorded for "+selectedTrack.title+
      ". Private rankings are being recalculated.");
    setSavedReviewDraft(null);activeReviewContext.current=null;
    setSelected(null);setSelectedTrack(null);setRegistryMatches([]);
    setBatchMode(false);setBatchRows([]);
    setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
    await refresh();
  });

  const gate=snapshot?.freeze_gate;
  const currentShazamReviews=(snapshot?.observation_reviews??[])
    .filter(item=>item.source_key==="shazam_ke"&&item.action==="approve");
  const selectedShazamReview=selected?.source_key==="shazam_ke"?
    currentShazamReviews.find(item=>item.receipt_id===selected.receipt_id&&
      item.rank===selected.rank):undefined;
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
  const canDiscoverRegistry=admin.can("manage_registry")&&admin.can("manage_charts");
  useEffect(()=>{
    if(tab!=="review"||!preview||!canDiscoverRegistry)return;
    let current=true;
    setRegistryDiscovery(null);
    setRegistryDiscoveryError("");
    setRegistryDiscoveryLoading(true);
    const sourceKey=(c:Coverage)=>c.source_key+":"+c.receipt_id+":"+c.original_sha256;
    void invokeStudio("studio_registry_discovery").then(raw=>{
      if(!current)return;
      const result=raw as RegistryDiscovery;
      if(result.contract!=="charts2-registry-discovery/v1"||
        result.candidate_only!==true||result.can_publish!==false||
        !Array.isArray(result.source_coverage)||!Array.isArray(result.groups)||
        result.unresolved_count!==preview.unresolved.length||
        result.source_coverage.map(sourceKey).sort().join("|")!==preview.source_coverage.map(sourceKey).sort().join("|"))
        throw new Error("Registry discovery and chart evidence changed. Refresh the Studio.");
      const byPosition=new Map(preview.unresolved.map(row=>[row.receipt_id+":"+row.rank,row]));
      if(result.groups.some(group=>group.track.status!=="active"||!group.positions.length||
        group.positions.some(row=>{
          const original=byPosition.get(row.receipt_id+":"+row.rank);
          return !original||original.source_key!==row.source_key||original.title!==row.title||
            original.artist!==row.artist||original.provider_track_id!==row.provider_track_id;
        })))
        throw new Error("Registry discovery returned a changed source position. Refresh the Studio.");
      setRegistryDiscovery({preview,result});
    }).catch(e=>{
      if(current)setRegistryDiscoveryError(e instanceof Error?e.message:"Registry discovery could not be completed.");
    }).finally(()=>{if(current)setRegistryDiscoveryLoading(false);});
    return ()=>{current=false;};
  },[tab,preview,canDiscoverRegistry,registryDiscoveryRetry]);
  const currentDiscovery=registryDiscovery?.preview===preview?registryDiscovery?.result:null;
  // A refresh or lost capability invalidates the in-page draft. Never carry
  // consent or stale decisions into a different evidence snapshot.
  useEffect(()=>{
    setSavedReviewDraft(draft=>draft&&draft.context.preview===preview&&canDiscoverRegistry?draft:null);
    setReviewConsent(false);
  },[preview,canDiscoverRegistry]);
  const createReviewContext=(anchor:EvidenceRow,rows:Array<EvidenceRow|RegistryDiscoveryPosition>,batch:boolean,candidateId?:string,reviewEventId?:string):RecordingReviewDraftContext|null=>{
    if(!preview)return null;
    const exact=rows.map(row=>{
      const source=preview.source_coverage.find(c=>c.source_key===row.source_key&&c.receipt_id===row.receipt_id);
      if(!source)return null;
      return JSON.stringify([row.source_key,row.receipt_id,source.original_sha256,row.rank,row.title,row.artist,row.provider_track_id]);
    });
    if(exact.some(item=>item===null))return null;
    return {preview,key:JSON.stringify([batch,candidateId??null,reviewEventId??null,exact.sort()]),anchor,batch,groupRows:rows};
  };
  const restoreReviewDraft=(draft:RecordingReviewDraft)=>{
    if(draft.context.preview!==preview||!canDiscoverRegistry)return;
    registrySearchSequence.current++;
    activeReviewContext.current=draft.context;
    setSelected(draft.context.anchor);
    setBatchMode(draft.context.batch);
    setReviewGroupRows(draft.context.groupRows);
    setBatchRows(draft.batchRows);
    setRegistryQuery(draft.registryQuery);
    setRegistryMatches(draft.registryMatches);
    setRegistrySearchAttempted(draft.registrySearchAttempted);
    setSelectedTrack(draft.selectedTrack);
    setEvidenceUrl(draft.evidenceUrl);setReviewNote(draft.reviewNote);
    setReviewConsent(false);setError("");
    setTab("review");
  };
  const resumeMatchingDraft=(context:RecordingReviewDraftContext|null)=>{
    activeReviewContext.current=context;
    if(context&&savedReviewDraft?.context.preview===context.preview&&savedReviewDraft.context.key===context.key){
      restoreReviewDraft(savedReviewDraft);
    }
  };
  const closeRecordingReview=()=>{
    if(busy)return;
    const context=activeReviewContext.current;
    if(selected&&context&&context.preview===preview&&canDiscoverRegistry){
      // Copy all preparation state, but deliberately omit reviewConsent.
      if(batchRows.length||selectedTrack||reviewNote.trim()||evidenceUrl.trim()||registrySearchAttempted)
        setSavedReviewDraft({context,registryQuery,registryMatches,registrySearchAttempted,
          selectedTrack,batchRows,evidenceUrl,reviewNote});
    }
    activeReviewContext.current=null;
    registrySearchSequence.current++;
    setSelected(null);setBatchMode(false);setBatchRows([]);
    setSelectedTrack(null);setRegistryMatches([]);setRegistrySearchAttempted(false);
    setReviewGroupRows([]);setReviewConsent(false);setError("");
  };
  const openSingleReview=(row:EvidenceRow,reviewEventId?:string)=>{
    setBatchMode(false);setBatchRows([]);setReviewGroupRows([]);
    setSelected(row);setRegistryQuery(row.title);
    registrySearchSequence.current++;
    setRegistryMatches([]);setRegistrySearchAttempted(false);setSelectedTrack(null);
    setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
    resumeMatchingDraft(createReviewContext(row,[row],false,undefined,reviewEventId));
  };
  // Restoration revalidates the receipt and SHA against the current Studio
  // preview, never URL-supplied song titles, artist or provider identifiers.
  useEffect(()=>{
    if(!returnContext || !snapshot?.preview || returnLoaded.current===returnContextKey)return;
    returnLoaded.current=returnContextKey;
    setTab("review");
    const coverage=snapshot.preview.source_coverage.find(source=>
      source.source_key===returnContext.source_key &&
      source.receipt_id===returnContext.receipt_id &&
      source.original_sha256===returnContext.original_sha256);
    const row=snapshot.preview.unresolved.find(entry=>
      entry.source_key===returnContext.source_key &&
      entry.receipt_id===returnContext.receipt_id &&
      entry.rank===returnContext.rank);
    if(!coverage || !row){
      setNotice("This chart position has changed or already been resolved. Review current evidence before making another decision.");
      return;
    }
    openSingleReview(row);
    setReviewFilter(row.source_key);
    setSearch(row.title);setPage(0);
  },[snapshot?.preview,returnContextKey]);
  const selectedReference=(()=>{
    if(!selected)return null;
    const original=preview?.source_coverage.find(source=>
      source.source_key===selected.source_key&&source.receipt_id===selected.receipt_id);
    if(!original)return null;
    const reference:ChartReviewReference={
      source_key:selected.source_key,receipt_id:selected.receipt_id,
      original_sha256:original.original_sha256,rank:selected.rank,
    };
    return reference;
  })();
  const startGovernedArtistIntake=async(reference=selectedReference,observedArtist=selected?.artist)=>operate("stage-artist-intake",async()=>{
    if(!reference||!observedArtist?.trim()||
       !admin.can("manage_charts")||!admin.can("manage_registry"))
      throw new Error("Exact original Artist credit and authorized review are required.");
    const staged=await invokeStudio("studio_stage_artist_intake",{
      ...reference,
      acknowledgement:"I request governed Artist Intake using this exact original chart credit. No Artist identity is approved.",
    });
    const id=String(staged.run_id??"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw new Error("Registry Artist Intake did not provide a valid reviewed run.");
    navigate(withIntakeBatch(appendChartReviewReference(
      "/admin/registry/artists/intake?run="+id,reference,
    )));
  });
  const startGovernedTrackIntake=async()=>operate("stage-track-intake",async()=>{
    if(!selectedReference||!admin.can("manage_registry")||!admin.can("manage_charts"))
      throw new Error("Exact Charts and Registry review authority required.");
    const staged=await invokeStudio("studio_stage_intake",{
      ...selectedReference,
      acknowledgement:"I request governed Track Intake for this exact chart position. No identity is approved.",
    });
    const id=String(staged.suggestion_id??"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      throw new Error("Registry did not return an exact Track Intake review reference.");
    navigate(withIntakeBatch(appendChartReviewReference(
      "/admin/registry/tracks/intake?suggestion="+id,selectedReference,
    )));
  });
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
  const sourceArtistDisplay=(row:{source_key:string;artist:string|null;provider_track_id:string|null})=>{
    if(row.artist)return row.artist;
    const verified=row.source_key==="apple_ke"&&row.provider_track_id
      ?appleSongs[row.provider_track_id]?.artist:null;
    return verified?"Verified Apple catalogue: "+verified:"Artist not supplied in original";
  };

  const duplicateGroups=useMemo(()=>suggestRecordingReviewGroups(
    preview?.unresolved??[],artistAliases,registryArtists,
  ),[preview?.unresolved,artistAliases,registryArtists]);
  const openDuplicateGroup=(rows: Array<EvidenceRow|RegistryDiscoveryPosition>,candidate?:RegistryTrack)=>{
    const selectable=rows.filter(row=>Boolean(row.provider_track_id)||row.source_key==="shazam_ke");
    if(!selectable.length)return;
    setBatchMode(true);setBatchRows([]);setReviewGroupRows(selectable);
    const anchor=selectable.find(row=>Boolean(row.artist))??selectable[0];
    setSelected(anchor);setRegistryQuery(anchor.title);
    registrySearchSequence.current++;
    setRegistryMatches(candidate?[candidate]:[]);setRegistrySearchAttempted(false);setSelectedTrack(null);
    setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
    resumeMatchingDraft(createReviewContext(anchor,selectable,true,candidate?.id));
    setTab("review");
  };
  const coverage=preview?.source_coverage??snapshot?.source_coverage??[];
  const methods=snapshot?.source_methods??[];
  const unresolved=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("en");
    return (preview?.unresolved??[]).filter(x=>
      (reviewFilter==="all"||x.source_key===reviewFilter) &&
      (!q||(x.title+" "+(x.artist??"")+" "+(x.provider_track_id??"")).toLocaleLowerCase("en").includes(q)));
  },[preview,search,reviewFilter]);
  const displayed=unresolved.slice(page*20,(page+1)*20);
  const intakeKey=(ref:ChartReviewReference)=>ref.source_key+":"+ref.receipt_id+":"+ref.rank+":"+ref.original_sha256;
  const updateIntakeSelection=(next:ChartReviewReference[])=>{
    setIntakeConsent(false);
    setIntakeResults(old=>old.filter(result=>next.some(ref=>intakeKey(ref)===intakeKey(result.reference))));
    setUrlParams(params=>writeChartIntakeBatch(params,next),{replace:true});
  };
  const currentIntakeRow=(ref:ChartReviewReference)=>{
    if(!preview?.source_coverage.some(c=>c.source_key===ref.source_key&&c.receipt_id===ref.receipt_id&&c.original_sha256===ref.original_sha256))return undefined;
    return preview.unresolved.find(row=>row.receipt_id===ref.receipt_id&&row.source_key===ref.source_key&&row.rank===ref.rank);
  };
  const intakeReference=(row:EvidenceRow):ChartReviewReference|null=>{
    const receipt=preview?.source_coverage.find(c=>c.source_key===row.source_key&&c.receipt_id===row.receipt_id);
    return receipt?{source_key:row.source_key,receipt_id:row.receipt_id,rank:row.rank,original_sha256:receipt.original_sha256}:null;
  };
  const pendingIntakes=intakeSelection.filter(ref=>!intakeResults.some(r=>r.suggestionId&&intakeKey(r.reference)===intakeKey(ref)));
  const prepareIntakes=()=>operate("prepare-intakes",async()=>{
    if(intakeRunning.current)return;
    if(!admin.can("manage_charts")||!admin.can("manage_registry")||!intakeConsent)
      throw new Error("Charts and Registry review permission and confirmation are required.");
    intakeRunning.current=true;
    try {
      const current=await invokeStudio("studio_preview") as StudioResponse;
      setSnapshot(current);
      if(!current.preview||pendingIntakes.some(ref=>
        !current.preview?.source_coverage.some(c=>c.source_key===ref.source_key&&c.receipt_id===ref.receipt_id&&c.original_sha256===ref.original_sha256)||
        !current.preview?.unresolved.some(row=>row.source_key===ref.source_key&&row.receipt_id===ref.receipt_id&&row.rank===ref.rank)))
        throw new Error("A selected source position changed. Clear the selection and review current evidence.");
      const results=await prepareChartTrackIntakes(pendingIntakes,ref=>invokeStudio("studio_stage_intake",{
        ...ref,acknowledgement:"I request governed Track Intake for this exact chart position. No identity is approved.",
      }),result=>setIntakeResults(old=>[...old.filter(r=>intakeKey(r.reference)!==intakeKey(result.reference)),result]));
      const failed=results.find(r=>r.error);
      setNotice(results.filter(r=>r.suggestionId).length+" intake items prepared. No recording identity approved."+
        (failed?" Preparation stopped. Review the failed item before retrying.":""));
    } finally {intakeRunning.current=false;setIntakeConsent(false);}
  });
  const activeCount=methods.filter(x=>x.review_state==="collector_admitted"&&
    x.authorization_expires_at&&Date.parse(x.authorization_expires_at)>Date.now()).length;

  return (
    <main className="mx-auto max-w-[1440px] space-y-5 p-4 pb-16 sm:p-6" aria-label="Private Charts Studio">
      <AdminChartsPageHeader eyebrow="WAKILISHA / Charts 2.0"
        title="Charts Studio"
        description="Review the songs behind the chart and check their sources.">
        <button type="button" onClick={()=>void refresh()} disabled={loading||!!busy||!!selected} className={buttonSecondary}>
          {loading?"Checking originals…":"Refresh verified evidence"}
        </button>
      </AdminChartsPageHeader>
      <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
        <span className={"rounded-full px-3 py-1 text-[11px] font-black "+chip(preview?"good":"warn")}>
          {loading?"Checking sources":preview?"Sources ready":coverage.length?"Sources incomplete":snapshot?"No verified sources":"Sources unavailable"}
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
          <button type="button" key={id} disabled={!!selected||!!busy} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined}
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
                    {source.weight}% · {cov?.native_period_authority===YOUTUBE_EXPORT_PERIOD_AUTHORITY
                      ?"Official CSV export":"Native "+source.method} ·
                    {" "}{cov?cov.observed_depth+" / "+cov.expected_depth+" ranks":"No accepted receipt"}
                  </p>
                  <p className="mt-1 text-[11px] text-wk-text-muted">
                    Observed {DATE(cov?.observed_at)} · {cov?.native_period_authority===YOUTUBE_EXPORT_PERIOD_AUTHORITY
                      ?"Confirmed export week":"Provider week"} {cov?.provider_week_ending_date??"Not declared"}
                    {cov?.provider_updated_at?" · Provider updated "+DATE(cov.provider_updated_at):""}
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1 text-[11px] font-black "+chip(admitted?"good":"warn")}>
                  {admitted?"Admission active":"Method held or expired"}
                </span>
              </div>
              {source.key==="youtube_ke" &&
                <div className="space-y-3 rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                  <h3 className="text-[13px] font-black text-wk-text">Import YouTube’s Official CSV</h3>
                  <p className="text-[12px] text-wk-text-muted">
                    Open <a href={YOUTUBE_EXPORT_ENDPOINT} target="_blank" rel="noopener noreferrer"
                      className="font-bold text-wk-text underline underline-offset-4">YouTube Charts</a>,
                    select Kenya Weekly Top Songs and download its CSV. Keep the file unchanged.
                  </p>
                  <p className="text-[12px] text-wk-text-muted">
                    The CSV does not include dates. Confirm the week shown on YouTube before importing.
                    This import does not approve automatic collection.
                  </p>
                  <div className="max-w-sm space-y-1">
                    <label htmlFor="charts2-week" className="text-[12px] font-bold text-wk-text">YouTube Chart Week</label>
                    <input id="charts2-week" value={week} disabled={!!busy}
                      onChange={e=>{setWeek(e.target.value);setExportConsent(false);}}
                      placeholder="weekly:YYYYMMDD:YYYYMMDD:ke" className={fieldClass}/>
                    <p className="text-[11px] text-wk-text-muted">Enter the Friday start and Thursday end dates.</p>
                  </div>
                  <WkUploadField accept=".csv,text/csv"
                    ariaLabel="Choose the official YouTube CSV"
                    label={exportHashing?"Checking File…":"Choose Official CSV"}
                    description="Original YouTube Charts file, up to 4 MB."
                    disabled={!!busy||loading||exportHashing}
                    onSelect={files=>void chooseYouTubeExport(files?.[0]??null)}/>
                  {youtubeExport&&<div className="space-y-2">
                    <p className="break-all text-[12px] font-semibold text-wk-text">{youtubeExport.file.name}</p>
                    <p className="break-all font-mono text-[11px] text-wk-text-muted">SHA-256: {youtubeExport.sha}</p>
                    <WkCheckbox checked={exportConsent} onChange={setExportConsent}>
                      {YOUTUBE_EXPORT_ACK}
                    </WkCheckbox>
                    <button type="button" className={buttonPrimary}
                      disabled={!exportConsent||!!busy||loading||!/^weekly:\d{8}:\d{8}:ke$/.test(week.trim())}
                      onClick={()=>void importYouTubeExport()}>Import Verified Original</button>
                  </div>}
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
        {!selected&&<>
        <WkSurface className="p-4">
          <h2 ref={recordingQueueHeading} tabIndex={-1} className="text-[15px] font-black text-wk-text outline-none">Review Recordings</h2>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            Find songs that may be the same recording. Compare the versions, then choose
            which Registry recording they belong to. Your approval preserves each chart position.
            Entries without a source ID remain on the review list.
          </p>
          <p className="mt-2 text-[12px] font-semibold text-wk-text">
            {admin.can("manage_registry")?"Registry review capability available":
              "You can inspect the queue. A manage_registry steward must approve recording links."}
          </p>
          <p className="mt-2 text-[12px] text-wk-text-muted">
            Search the Registry from a selected chart position. Missing Track and Artist
            intake will be connected here through governed, receipt-bound handoffs.
          </p>
        </WkSurface>
        {currentShazamReviews.length>0 &&
          <WkSurface className="space-y-2 p-4">
            <h3 className="text-[15px] font-black text-wk-text">Reviewed Shazam Positions</h3>
            <p className="text-[12px] text-wk-text-muted">
              Each Shazam position has a separate review receipt, not an invented
              provider ID. Incorrect reviews can be explicitly revoked.
            </p>
            {currentShazamReviews.map(item=>
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-wk-border pt-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-wk-text">#{item.rank} {item.title}</p>
                  <p className="text-[11px] text-wk-text-muted">
                    {item.artist??"No source Artist"} · Registry Track {item.track_id}
                  </p>
                </div>
                <button type="button" className={buttonSecondary}
                  disabled={!!busy||!admin.can("manage_registry")||!admin.can("manage_charts")}
                  onClick={()=>{
                    openSingleReview({source_key:"shazam_ke",receipt_id:item.receipt_id,
                      rank:item.rank,title:item.title,artist:item.artist,
                      provider_track_id:null,reason:"previously_reviewed"},item.id);
                  }}>
                  Inspect or Revoke
                </button>
              </div>)}
          </WkSurface>}
        {canDiscoverRegistry&&savedReviewDraft?.context.preview===preview&&savedReviewDraft&&
          <WkSurface className="space-y-2 p-4">
            <p className="text-[13px] font-black text-wk-text">Review Draft Saved</p>
            <p className="text-[12px] text-wk-text-muted">
              {savedReviewDraft.context.anchor.title} · {savedReviewDraft.context.batch?savedReviewDraft.batchRows.length:1} selected positions.
              Your preparation is kept on this page. Approval must be confirmed again.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonPrimary} disabled={!!busy}
                onClick={()=>restoreReviewDraft(savedReviewDraft)}>Resume Review</button>
              <button type="button" className={buttonSecondary} disabled={!!busy}
                onClick={()=>setSavedReviewDraft(null)}>Discard Draft</button>
            </div>
          </WkSurface>}
        {canDiscoverRegistry&&<WkSurface className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-black text-wk-text">Existing Registry Recordings</h3>
              <p className="mt-1 text-[12px] text-wk-text-muted">
                Unresolved source positions are checked automatically for active title candidates.
                These are review leads, not approved recordings.
              </p>
            </div>
            <button type="button" className={buttonSecondary} disabled={!!busy||registryDiscoveryLoading}
              onClick={()=>setRegistryDiscoveryRetry(n=>n+1)}>Check Registry Again</button>
          </div>
          {registryDiscoveryLoading&&<p role="status" className="text-[12px] text-wk-text-muted">Checking active Registry recordings…</p>}
          {registryDiscoveryError&&<p role="alert" className="text-[12px] text-wk-warning">
            Automatic candidate discovery could not finish: {registryDiscoveryError}. Manual search remains available.
          </p>}
          {currentDiscovery&&<>
            <p role="status" className="text-[12px] text-wk-text">
              {currentDiscovery.unique_positions} positions with one title candidate · {currentDiscovery.ambiguous_positions} with multiple · {currentDiscovery.unmatched_positions} with no exact title candidate
            </p>
            <p className="text-[11px] text-wk-text-muted">
              A unique title does not prove recording identity. Provider evidence, Artist credits and source versions still need review.
            </p>
            <div className="divide-y divide-wk-border">
              {currentDiscovery.groups.slice(0,showAllRegistryGroups?undefined:12).map(group=>
                <div key={group.track.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[13px] font-black text-wk-text">{group.track.title}</p>
                      <p className="text-[11px] text-wk-text-muted">{group.track.artist_names.join(", ")||"No recorded credits"} · ISRC: {group.track.isrc??"Not recorded"}</p>
                      <p className="break-all text-[10px] text-wk-text-muted">{group.track.id}</p>
                    </div>
                    <button type="button" className={buttonSecondary}
                      disabled={!!busy||!group.positions.some(row=>row.provider_track_id||row.source_key==="shazam_ke")}
                      onClick={()=>openDuplicateGroup(group.positions,group.track)}>Review Existing Recording</button>
                  </div>
                  {group.positions.map(row=><p key={row.receipt_id+":"+row.rank} className="break-words text-[11px] text-wk-text-muted">
                    {SOURCE_LABEL[row.source_key]} #{row.rank} · {sourceArtistDisplay(row)} · {row.credit_evidence==="artist_credit_agrees"?"Recorded Artist credit agrees":row.credit_evidence==="artist_not_supplied"?"Original Artist not supplied":"Artist credit unconfirmed"}
                    {row.candidate_count>1?" · Multiple active title candidates":""}
                  </p>)}
                </div>)}
              {!currentDiscovery.groups.length&&<p className="py-3 text-[12px] text-wk-text-muted">No exact active title candidates found. Continue with evidence-based search and governed Intake.</p>}
            </div>
            {currentDiscovery.groups.length>12&&<button type="button" className={buttonSecondary}
              onClick={()=>setShowAllRegistryGroups(value=>!value)}>{showAllRegistryGroups?"Show Fewer":"Show All Existing Candidates"}</button>}
          </>}
        </WkSurface>}
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
                      " #"+row.rank+" ("+sourceArtistDisplay(row)+")").join(" · ")}
                  </p>
                </div>
                <button type="button" className={buttonSecondary}
                  disabled={!!busy||!admin.can("manage_registry")||!admin.can("manage_charts")||
                    !group.observations.some(row=>row.provider_track_id||row.source_key==="shazam_ke")}
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
        <WkSurface className="space-y-3 p-4">
          <h3 className="text-[15px] font-black text-wk-text">Prepare Track Intake</h3>
          <p className="text-[12px] text-wk-text-muted">
            Choose up to ten source positions below. Prepare their existing Registry review items together.
            Review source Artists separately where needed. This does not approve identities, credits, or source links.
          </p>
          <p role="status" className="text-[12px] text-wk-text">{intakeSelection.length} selected · {pendingIntakes.length} remaining</p>
          {intakeSelection.map(ref=>{
            const result=intakeResults.find(r=>intakeKey(r.reference)===intakeKey(ref));
            const row=currentIntakeRow(ref);
            const canReview=Boolean(row)&&!busy&&admin.can("manage_registry")&&admin.can("manage_charts");
            return <div key={intakeKey(ref)} className="space-y-2 border-t border-wk-border py-2">
              <div className="min-w-0 text-[12px] text-wk-text">
                <p className="break-words">{SOURCE_LABEL[ref.source_key]} #{ref.rank} · {row?.title??"Source position"}</p>
                {row&&<p className="break-words text-wk-text-muted">{sourceArtistDisplay(row)}</p>}
                {!row&&<p className="text-wk-warning">Position changed or resolved. Remove it before preparing the remaining items.</p>}
                {row&&!row.artist&&<p className="text-wk-text-muted">The original has no Artist credit. Review separate catalogue evidence in Track Intake.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row&&result?.suggestionId&&canReview?<Link className={buttonSecondary}
                  to={withIntakeBatch(appendChartReviewReference("/admin/registry/tracks/intake?suggestion="+result.suggestionId,ref))}>Open Track Intake</Link>:
                  <span className="break-words text-[11px] text-wk-text-muted">{result?.error??(result?.suggestionId?"Prepared":"Not prepared")}</span>}
                {row?.artist?.trim()&&<button type="button" className={buttonSecondary} disabled={!canReview}
                  onClick={()=>void startGovernedArtistIntake(ref,row.artist)}>Review Source Artist</button>}
                <button type="button" className={buttonSecondary} disabled={!!busy}
                  onClick={()=>updateIntakeSelection(intakeSelection.filter(item=>intakeKey(item)!==intakeKey(ref)))}>Remove Position</button>
              </div>
            </div>;
          })}
          <WkCheckbox checked={intakeConsent} disabled={!!busy||!pendingIntakes.length}
            onChange={setIntakeConsent}>Prepare these review items only. No recording identity is approved.</WkCheckbox>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonPrimary} disabled={!!busy||!pendingIntakes.length||!intakeConsent||!admin.can("manage_charts")||!admin.can("manage_registry")}
              onClick={()=>void prepareIntakes()}>{busy==="prepare-intakes"?"Preparing…":"Prepare Selected Intake Items"}</button>
            <button type="button" className={buttonSecondary} disabled={!!busy||!intakeSelection.length}
              onClick={()=>updateIntakeSelection([])}>Clear Selection</button>
          </div>
          <p className="text-[11px] text-wk-text-muted">The selection stays with this review link. After returning or reloading, confirm preparation again to recover existing Registry items. No decisions or consent travel with the link.</p>
        </WkSurface>
        <div className="grid gap-4">
          <WkSurface className="overflow-hidden">
            <div className="border-b border-wk-border px-4 py-3 text-[12px] font-semibold text-wk-text-muted">
              {unresolved.length} unresolved · {preview?.conflicts.length??0} conflicts · page {page+1}
            </div>
            <div className="divide-y divide-wk-border">
              {displayed.map(row=>
                <div key={row.receipt_id+":"+row.rank} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-wk-text">#{row.rank} {row.title}</p>
                    <p className="text-[11px] text-wk-text-muted">
                      {row.artist??"Artist not supplied in original"} · {SOURCE_LABEL[row.source_key]}
                    </p>
                    {row.source_key==="apple_ke" && appleSongs[row.provider_track_id??""]?.artist &&
                      <p className="mt-1 text-[11px] text-wk-text-muted">
                        Verified Apple catalogue: {appleSongs[row.provider_track_id??""].artist}
                      </p>}
                    <p className="mt-1 text-[11px] text-wk-warning">{row.reason.replaceAll("_"," ")}</p>
                  </div>
                  {(()=>{
                    const ref=intakeReference(row);
                    if(!ref)return null;
                    const checked=intakeSelection.some(x=>intakeKey(x)===intakeKey(ref));
                    return <WkCheckbox checked={checked} disabled={!!busy||!admin.can("manage_registry")||!admin.can("manage_charts")||(!checked&&intakeSelection.length>=TRACK_INTAKE_BATCH_LIMIT)}
                      onChange={value=>updateIntakeSelection(value?
                        [...intakeSelection.filter(x=>intakeKey(x)!==intakeKey(ref)),ref]:intakeSelection.filter(x=>intakeKey(x)!==intakeKey(ref)))}>
                      Prepare intake
                    </WkCheckbox>;
                  })()}
                  <button type="button" className={buttonSecondary}
                    disabled={!!busy||(!row.provider_track_id&&row.source_key!=="shazam_ke")||
                      !admin.can("manage_registry")||!admin.can("manage_charts")}
                    onClick={()=>openSingleReview(row)}>
                    {row.provider_track_id?"Review exact identity":
                       row.source_key==="shazam_ke"?"Review Shazam Position":"No provider ID"}
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
        </div>
        </>}
        {selected&&<WkSurface role="region" aria-labelledby="studio-recording-review-title"
          className="mx-auto w-full min-w-0 max-w-3xl space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wk-border pb-4">
            <h2 id="studio-recording-review-title" ref={recordingReviewHeading} tabIndex={-1}
              className="min-w-0 break-words text-[18px] font-bold text-wk-text outline-none">Review This Recording</h2>
            <WkButton variant="soft" disabled={!!busy} onClick={closeRecordingReview}>Close review</WkButton>
          </div>
          <p className="text-[12px] text-wk-text-muted">Work through the evidence on this page. Closing the review keeps your preparation, not your approval.</p>
          {error && <p role="alert" className="mb-3 rounded-lg border border-wk-danger p-3 text-[12px] text-wk-danger">{error}</p>}
          <div className="space-y-4">
            {selected && <>
              {batchMode && <div className="space-y-2 rounded-lg border border-wk-border p-3">
                <p className="text-[12px] font-black text-wk-text">
                  Choose The Songs To Link ({batchRows.length} Selected)
                </p>
                <p className="text-[11px] text-wk-text-muted">
                  Select the verified matches. Choose only one position per source.
                </p>
                {reviewGroupRows.map(row=>{
                    const checked=batchRows.some(item=>item.receipt_id===row.receipt_id&&
                      item.rank===row.rank);
                    return <WkCheckbox key={row.receipt_id+":"+row.rank} className="w-full items-start"
                      checked={checked} disabled={!!busy||(!row.provider_track_id&&row.source_key!=="shazam_ke")}
                      onChange={value=>{
                        setReviewConsent(false);
                        setBatchRows(old=>value?
                          [...old.filter(item=>item.source_key!==row.source_key),row as EvidenceRow]:
                          old.filter(item=>!(item.receipt_id===row.receipt_id&&item.rank===row.rank)));
                      }}><span className="block min-w-0 flex-1 whitespace-normal leading-relaxed">
                      {SOURCE_LABEL[row.source_key as SourceKey].split(" ")[0]} #{row.rank}
                      {" "}· {row.title} · {sourceArtistDisplay(row)}
                      {!row.provider_track_id?" (no native ID, review chart position)":""}
                      {"candidate_count" in row&&row.candidate_count>1?" · Multiple title candidates":""}
                    </span></WkCheckbox>;
                  })}
              </div>}
              <div className="space-y-2 rounded-lg bg-wk-surface-raised p-3">
                <p className="font-bold text-wk-text">{selected.title}</p>
                <p className="text-[12px] text-wk-text-muted">
                  Original source artist: {selected.artist??"Not supplied"} · {SOURCE_LABEL[selected.source_key]} · #{selected.rank}
                </p>
                {selected.source_key==="apple_ke" &&
                  <p className="text-[12px] text-wk-text">
                    Official Apple catalogue artist: {appleSongs[selected.provider_track_id??""]?.artist??"Unavailable (no artist verified)"}
                  </p>}
                <p className="break-all font-mono text-[11px] text-wk-text-muted">
                  Source ID: {selected.provider_track_id??"Not supplied"}
                </p>
              </div>
              {selectedReference &&
                <div className="space-y-2 rounded-xl border border-wk-border p-3">
                  <h3 className="text-[13px] font-black text-wk-text">Work with the Registry</h3>
                  <p className="text-[11px] text-wk-text-muted">
                    Each Registry screen verifies this source receipt and rank.
                    Artist, Track, credit and duplicate decisions remain separately governed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonSecondary}
                      disabled={!!busy||!selected.artist||
                        !admin.can("manage_registry")||!admin.can("manage_charts")}
                      onClick={()=>void startGovernedArtistIntake()}>
                      {busy==="stage-artist-intake"?"Opening Artist Intake…":"Start Governed Artist Intake"}
                    </button>
                    <Link className={buttonSecondary}
                      to={withIntakeBatch(appendChartReviewReference("/admin/registry/artist-aliases",selectedReference))}>
                      Review Artist Aliases
                    </Link>
                    {selectedTrack?
                      <Link className={buttonSecondary}
                        to={withIntakeBatch(appendChartReviewReference("/admin/relationships/duplicates",selectedReference,selectedTrack.id))}>
                        Check Duplicate Risk for {selectedTrack.title}
                      </Link>:
                      <span className="self-center text-[11px] text-wk-text-muted">
                        Select an existing Registry Track before checking duplicate risk.
                      </span>}
                    <button type="button" className={buttonSecondary}
                      disabled={!!busy||!admin.can("manage_registry")||!admin.can("manage_charts")}
                      onClick={()=>void startGovernedTrackIntake()}>
                      {busy==="stage-track-intake"?"Opening Intake…":"Start Governed Track Intake"}
                    </button>
                  </div>
                  <p className="text-[11px] text-wk-text-muted">
                    Each Intake starts a receipt-bound review item only. New Artists remain
                    drafts until independently activated. Track identity, credits and source
                    links receive their own separately authorized decisions.
                  </p>
                </div>}
              <p className="text-[12px] font-bold text-wk-text">Find The Recording To Keep</p>
              <form onSubmit={e=>{e.preventDefault();void lookUpTrack();}}
                className="flex flex-col gap-2 sm:flex-row">
                <WkSearchField ariaLabel="Find The Recording To Keep" value={registryQuery}
                  disabled={!!busy} onChange={value=>{
                    registrySearchSequence.current++;
                    setRegistryQuery(value);
                    setRegistryMatches([]);setRegistrySearchAttempted(false);
                    setSelectedTrack(null);setReviewConsent(false);
                  }} placeholder="Title, Artist, ISRC or ID" className="sm:flex-1"/>
                <WkButton type="submit" variant="soft" className="min-h-11"
                  disabled={!!busy||registryQuery.trim().length<2}>
                  {busy==="track-search"?"Searching…":"Search Registry"}
                </WkButton>
              </form>
              {registrySearchAttempted && !registryMatches.length &&
                <p role="status" className="rounded-lg bg-wk-surface-raised p-3 text-[12px] text-wk-text-muted">
                  No active Registry recording matches this search.
                  A new Track requires governed Track Intake before it can be linked.
                </p>}
              <div aria-live="polite" className="space-y-2">
                {registryMatches.map(track=>
                  <button type="button" key={track.id} disabled={!!busy} onClick={()=>{setSelectedTrack(track);setReviewConsent(false);}}
                    aria-pressed={selectedTrack?.id===track.id}
                    className={"w-full rounded-xl border p-3 text-left text-[12px] "+
                      (selectedTrack?.id===track.id?
                        "border-wk-brand bg-wk-brand-soft text-wk-text":
                        "border-wk-border bg-wk-surface text-wk-text")}>
                    <span className="block font-black">{track.title}</span>
                    <span className="mt-1 block text-[11px] text-wk-text-muted">
                      Primary: {track.artist_credits?.filter(c=>c.is_primary)
                        .map(c=>c.name+(c.origin_iso2?" · "+c.origin_iso2:" · origin unrecorded")).join(", ")||"Not recorded"}
                    </span>
                    <span className="block text-[11px] text-wk-text-muted">
                      Other credited Artists: {track.artist_credits?.filter(c=>!c.is_primary)
                        .map(c=>c.name+(c.origin_iso2?" · "+c.origin_iso2:" · origin unrecorded")).join(", ")||"None recorded"}
                    </span>
                    <span className="block text-[11px] text-wk-text-muted">
                      ISRC: {track.isrc??"Not recorded"} · Duration: {track.duration_ms?
                        Math.round(track.duration_ms/1000)+" seconds":"Not recorded"}
                    </span>
                    <span className="block text-[11px] text-wk-text-muted">
                      Existing provider links (method, not proof): {track.provider_keys?.join(", ")||"None"}
                    </span>
                    <span className="mt-1 block break-all font-mono text-[10px] text-wk-text-muted">{track.id}</span>
                  </button>)}
              </div>
              <label htmlFor="studio-evidence" className="text-[12px] font-bold text-wk-text">Link To Recording Evidence</label>
              <input id="studio-evidence" type="text" inputMode="url" autoComplete="off" disabled={!!busy}
                className={"wk-input "+fieldClass+" text-[16px]"}
                placeholder="https://… recording evidence"
                value={evidenceUrl} onChange={e=>{setEvidenceUrl(e.target.value);setReviewConsent(false);}}/>
              <label htmlFor="studio-note" className="text-[12px] font-bold text-wk-text">Why Do These Songs Match?</label>
              <textarea id="studio-note" rows={6} disabled={!!busy} className={"wk-input "+fieldClass+" min-h-36 resize-none text-[16px]"}
                placeholder="Add the matching ISRC, release details, or other evidence that confirms the recording."
                value={reviewNote} onChange={e=>{setReviewNote(e.target.value);setReviewConsent(false);}}/>
              {batchMode &&
                <div className="space-y-2 rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                  <h3 className="text-[12px] font-black text-wk-text">Before You Approve</h3>
                  <p className="text-[12px] text-wk-text">
                    {batchRows.length} chart positions will be independently reviewed against
                    {" "}<strong>{selectedTrack?.title??"the Registry recording you choose"}</strong>.
                  </p>
                  <p className="text-[11px] text-wk-text-muted">
                    Identified provider recordings use Registry provider links. Shazam positions
                    without IDs use a distinct, receipt-bound review. Original ranks are
                    retained. An interrupted batch preserves individually accepted decisions.
                  </p>
                </div>}
              <div className="space-y-3 border-t border-wk-border pt-4">
                <WkCheckbox checked={reviewConsent} onChange={setReviewConsent} disabled={!!busy}
                  className="w-full items-start">
                  <span className="block min-w-0 whitespace-normal leading-relaxed">
                    {selectedShazamReview?
                      "I independently re-reviewed this exact Shazam position and authorize revoking its existing private recording resolution.":
                      "I independently verified every selected source position against the correct recording. I authorize its governed Registry provider link or exact no-ID Shazam resolution. Nothing will be published."}
                  </span>
                </WkCheckbox>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {selectedShazamReview?
                    <WkButton variant="soft" className="min-h-11 w-full sm:w-auto"
                      disabled={!!busy||!reviewConsent||reviewNote.trim().length<40||
                        !evidenceUrl.startsWith("https://")}
                      onClick={()=>void reviewShazamCorrection()}>
                      {busy==="shazam-revoke"?"Recording correction…":"Revoke This Shazam Resolution"}
                    </WkButton>:
                    <WkButton className="min-h-11 w-full sm:w-auto"
                      disabled={!!busy||!selectedTrack||(batchMode&&!batchRows.length)||
                        !reviewConsent||reviewNote.trim().length<40||
                        !evidenceUrl.startsWith("https://")}
                      onClick={()=>void commitReview()}>
                      {busy==="registry-link"?"Recording review…":
                        batchMode?"Confirm Selected Matches":"Confirm Recording Match"}
                    </WkButton>}
                </div>
                <p className="text-[11px] leading-relaxed text-wk-text-muted">
                  Provider matches are recorded in the Registry. Shazam positions without IDs
                  are reviewed separately. Neither changes the public chart.
                </p>
              </div>
            </>}
          </div>
          <div className="flex justify-end border-t border-wk-border pt-4">
            <WkButton variant="soft" disabled={!!busy} onClick={closeRecordingReview}>Close review</WkButton>
          </div>
        </WkSurface>}
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
          The Edge worker independently rehashed the selected originals for this Studio snapshot.
        </WkSurface>
        {(snapshot?.history??[]).map(row=>
          <WkSurface key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-black text-wk-text">{SOURCE_LABEL[row.source_key]}</p>
              <p className="text-[12px] text-wk-text-muted">{DATE(row.observed_at)} · {row.observed_depth}/{row.expected_depth} ranks · {row.observed_status}</p>
              <p className="mt-1 font-mono text-[11px] text-wk-text-muted">SHA {shorthand(row.original_sha256)} · Receipt {shorthand(row.id)}</p>
            </div>
            <span className={"rounded-full px-3 py-1 text-[11px] font-bold "+chip(row.observed_status==="succeeded"?"good":"warn")}>
              {row.native_period_authority===YOUTUBE_EXPORT_PERIOD_AUTHORITY
                ?"Operator-confirmed export":row.native_period_authority.replaceAll("_"," ")}
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
