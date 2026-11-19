import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "@/hooks/useAdminUser";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "@/pages/admin/charts/components/AdminChartsPageHeader";

type SourceKey = "youtube_ke" | "mdundo_ke" | "apple_ke" | "audiomack_ke" | "shazam_ke";
type Tab = "sources" | "review" | "preview" | "history";
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
type StudioResponse = {
  ok: boolean; state: string; preview?: Preview;
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

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try {setSnapshot(await invokeStudio("studio_preview") as StudioResponse);}
    catch(e){setError(e instanceof Error?e.message:"studio_load_failed");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);

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
      const firstParty=SOURCE_LABEL[source];
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
    if(!selected?.provider_track_id||!selectedTrack||!reviewConsent)
      throw new Error("Choose an existing Registry Track and affirm the exact recording evidence.");
    const source=snapshot?.preview?.source_coverage.find(x=>x.source_key===selected.source_key);
    if(!source)throw new Error("The source receipt is no longer available. Reload the Studio.");
    if(reviewNote.trim().length<40)
      throw new Error("Document at least 40 characters of independent recording identity evidence.");
    if(!/^https:\/\//.test(evidenceUrl.trim()))
      throw new Error("Provide an independent HTTPS evidence URL.");
    await invokeStudio("studio_review_link",{
      source_key:selected.source_key,rank:selected.rank,
      receipt_id:source.receipt_id,original_sha256:source.original_sha256,
      track_id:selectedTrack.id,review_note:reviewNote.trim(),
      evidence_url:evidenceUrl.trim(),acknowledgement:DECLARATION,
    });
    setNotice("Registry review accepted for "+selected.title+
      ". Recalculating private scores.");
    setSelected(null);setSelectedTrack(null);setRegistryMatches([]);
    setReviewNote("");setEvidenceUrl("");setReviewConsent(false);
    await refresh();
  });

  const preview=snapshot?.preview;
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
        description="Five first-party sources · private evidence and recording review. Scoring is not publication.">
        <button type="button" onClick={()=>void refresh()} disabled={loading||!!busy} className={buttonSecondary}>
          {loading?"Checking originals…":"Refresh verified evidence"}
        </button>
      </AdminChartsPageHeader>
      <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
        <span className={"rounded-full px-3 py-1 text-[11px] font-black "+chip(preview?"good":"warn")}>
          {loading?"Verifying private originals":preview?"Private evidence verified":"No qualified snapshot"}
        </span>
        <span className="text-[12px] text-wk-text-muted">
          {preview?.methodology_version??"Private methodology not yet available"} ·
          {" "}Frozen: NO · Publication: DISABLED
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
          ["First-party receipts",coverage.length+" / 5"],
          ["Rank observations",String(coverage.reduce((n,x)=>n+x.observed_depth,0))],
          ["Registry-qualified recordings",String(preview?.candidates.length??0)],
          ["Review needed",String((preview?.unresolved.length??0)+(preview?.conflicts.length??0))],
        ].map(([label,value])=>
          <WkSurface key={label} className="p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">{label}</p>
            <p className="mt-2 text-[27px] font-black tabular-nums text-wk-text">{loading?"—":value}</p>
          </WkSurface>
        )}
      </div>
      <nav aria-label="Charts Studio work areas" className="flex flex-wrap gap-2">
        {([
          ["sources","Source health & collect"],["review","Identity review"],
          ["preview","Top 100 private preview"],["history","Receipt history"],
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
                <label className="flex items-start gap-2 text-[12px] text-wk-text">
                  <input type="checkbox" checked={sourceConsent===source.key} onChange={e=>setSourceConsent(e.target.checked?source.key:null)}/>
                  I inspected this source, endpoint and original evidence, and explicitly approve a 24-hour evidence-only admission.
                </label>
                <button type="button" className={buttonPrimary} disabled={sourceConsent!==source.key||!!busy}
                  onClick={()=>void approval(source.key)}>Approve exact method</button>
              </div>}
              {method && <details className="text-[12px] text-wk-text-muted">
                <summary className="cursor-pointer font-bold">Method controls and revocation</summary>
                <p className="mt-2">Revision {method.method_revision} · Expires {DATE(method.authorization_expires_at)}</p>
                <label className="mt-2 block" htmlFor={"hold-"+source.key}>Reason for audited HOLD</label>
                <input id={"hold-"+source.key} value={holdReason} onChange={e=>setHoldReason(e.target.value)}
                  placeholder="Write a source-specific, factual hold reason" className={fieldClass}/>
                <button type="button" className={buttonSecondary} disabled={!!busy||holdReason.trim().length<24}
                  onClick={()=>void hold(source.key,method.method_revision)}>Hold / revoke method</button>
              </details>}
            </WkSurface>;
          })}
        </section>
      }
      {tab==="review" && <section aria-label="Recording identity review" className="space-y-4">
        <WkSurface className="p-4">
          <h2 className="text-[15px] font-black text-wk-text">Recording authority, not title similarity</h2>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            Every unresolved observation retains its exact receipt and native rank.
            Strong canonical links require separately corroborated recording evidence and the
            existing Registry's governed provider-link approval.
            Shazam records with no provider ID cannot be assigned an invented one.
          </p>
          <p className="mt-2 text-[12px] font-semibold text-wk-text">
            {admin.can("manage_registry")?"Registry review capability available":
              "You can inspect the queue. A manage_registry steward must approve recording links."}
          </p>
          <Link className="text-[12px] font-bold text-wk-brand underline" to="/admin/registry/tracks">
            Open existing Registry track authority
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
            <h2 className="text-[15px] font-black text-wk-text">Governed Registry review</h2>
            {!selected?<p className="text-[12px] text-wk-text-muted">
              Select a provider observation to review its exact recording. No automatic title match is made.
            </p>:<>
              <div className="rounded-lg bg-wk-surface-raised p-3">
                <p className="font-bold text-wk-text">{selected.title}</p>
                <p className="text-[12px] text-wk-text-muted">{selected.artist} · {SOURCE_LABEL[selected.source_key]} · #{selected.rank}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-wk-text-muted">{selected.provider_track_id}</p>
              </div>
              <label htmlFor="studio-registry-query" className="text-[12px] font-bold text-wk-text">Find an existing Registry recording</label>
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
              <label htmlFor="studio-evidence" className="text-[12px] font-bold text-wk-text">Independent HTTPS recording evidence</label>
              <input id="studio-evidence" type="url" className={fieldClass}
                placeholder="https://… specific recording / release evidence"
                value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)}/>
              <label htmlFor="studio-note" className="text-[12px] font-bold text-wk-text">Recording identity rationale</label>
              <textarea id="studio-note" rows={4} className={fieldClass}
                placeholder="Document corroborated performer, version, release or ISRC. Name similarity alone is insufficient."
                value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/>
              <label className="flex items-start gap-2 text-[12px] text-wk-text">
                <input type="checkbox" checked={reviewConsent} onChange={e=>setReviewConsent(e.target.checked)}/>
                {DECLARATION}
              </label>
              <button type="button" className={buttonPrimary} disabled={!!busy||!selectedTrack||
                !reviewConsent||reviewNote.trim().length<40||!evidenceUrl.startsWith("https://")}
                onClick={()=>void commitReview()}>Submit reviewed provider link to Registry</button>
              <p className="text-[11px] text-wk-text-muted">The Registry broker checks its own actor permission, exact evidence and audit. Charts Studio never directly writes canonical Track identities.</p>
            </>}
          </WkSurface>
        </div>
      </section>}
      {tab==="preview" && <section aria-label="Private Top 100 scoring" className="space-y-4">
        <WkSurface className="space-y-2 p-4">
          <h2 className="text-[15px] font-black text-wk-text">Private ordinal preview</h2>
          <p className="text-[12px] text-wk-text-muted">
            Methodology 30 / 25 / 20 / 15 / 10, exact integer credits per genuine native rank.
            Scores are a composition of provider positions, not aggregate streams or synchronized weeks.
            No freeze or publication action is enabled in Take 2.
          </p>
          <span className={"inline-block rounded-full px-3 py-1 text-[11px] font-black "+
            chip(preview?.review_status==="eligible_for_private_review"?"good":"warn")}>
            {preview?.review_status?.replaceAll("_"," ")??"Waiting for complete evidence"}
          </span>
        </WkSurface>
        <WkSurface className="overflow-hidden">
          <div className="border-b border-wk-border px-4 py-3 text-[12px] font-bold text-wk-text-muted">
            {preview?.candidates.length??0} Registry-authorized recordings · private only
          </div>
          <div className="divide-y divide-wk-border">
            {(preview?.candidates??[]).slice(0,100).map((c,i)=>
              <div key={c.track_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <strong className="w-7 text-[13px] text-wk-text">{i+1}</strong>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-[11px] text-wk-text">{c.track_id}</p>
                  <p className="text-[11px] text-wk-text-muted">
                    {c.source_count} verified sources · {c.source_contributions.map(x=>x.source_key+": "+x.credit_points).join(" · ")}
                  </p>
                </div>
                <strong className="text-[17px] tabular-nums text-wk-text">{c.score_points}</strong>
              </div>)}
            {(!preview?.candidates.length) && <p className="p-5 text-[13px] text-wk-text-muted">
              No canonical recording is sufficiently identified to receive a score. Resolve Registry identity rather than guessing.
            </p>}
          </div>
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
      <footer className="border-t border-wk-border pt-4 text-[11px] text-wk-text-muted">
        Five-source evidence is private. Identity review is performed through Registry/MIZIZI authority.
        No public edition is staged, frozen or published here.
        {" "}Verified methods active: {activeCount}/5.
      </footer>
    </main>
  );
}
