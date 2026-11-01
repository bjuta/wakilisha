import {useState, type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import {getWk100ArchivedResearchPortfolio} from "@/services/chartsIngestion/wk100ResearchPortfolio.mjs";
import {
  submitWk100ResearchEvidence, type Wk100ResearchIntakeAck,
} from "@/services/chartsIngestion/wk100ResearchIntakeClient.mjs";

type Props={weekStartEat:string;draftSaved:boolean};

const errors:Record<string,string>={
  week_invalid:"Choose a valid East Africa Time Monday for this week.",
  csv_invalid:"Choose the original Shazam Kenya CSV, up to 4 MiB.",
  receipt_invalid:"Choose its unchanged researcher receipt JSON, up to 4 KiB.",
  original_bytes_mismatch:"The CSV does not match its receipt. Select the original files.",
  transport_unavailable:"The private research service is unavailable.",
  authentication_required:"Your Admin session has expired. Sign in again before uploading.",
  not_authorized:"Your account needs chart and ingest stewardship to upload research.",
  capability_unavailable:"We could not confirm your permissions. Try again later.",
  intake_not_enabled:"Private research intake is not enabled for this environment.",
  backend_unavailable:"The restricted research service is not configured.",
  research_payload_invalid:"The server rejected the submitted files. Review the originals.",
  research_source_invalid:"The source or receipt did not pass server verification.",
  research_receipt_not_verified:"The private receipt was not finalized. Keep both files and retry the same observation.",
  unverified_ack:"The server did not confirm a complete private receipt. Nothing is marked saved.",
  server_unavailable:"The server could not confirm this upload. Keep both files and retry.",
};
function messageFor(error:unknown):string{
  const raw=error instanceof Error?error.message:"";
  const prefix="wk100_research_ui_";
  const code=raw.startsWith(prefix)?raw.slice(prefix.length):"server_unavailable";
  return errors[code]??errors.server_unavailable;
}

export function Wk100ResearchEvidencePanel({weekStartEat,draftSaved}:Props){
  const [originalCsv,setOriginalCsv]=useState<File|null>(null);
  const [receiptFile,setReceiptFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [ack,setAck]=useState<Wk100ResearchIntakeAck|null>(null);
  const archivedResearch=getWk100ArchivedResearchPortfolio(weekStartEat);
  const ready=draftSaved&&originalCsv!==null&&receiptFile!==null&&!busy;
  function changeCsv(file:File|null){
    if(busy)return;
    setOriginalCsv(file);setAck(null);setError(null);
  }
  function changeReceipt(file:File|null){
    if(busy)return;
    setReceiptFile(file);setAck(null);setError(null);
  }
  async function upload(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!ready||!originalCsv||!receiptFile)return;
    setBusy(true);setError(null);setAck(null);
    try{
      const result=await submitWk100ResearchEvidence({
        originalCsv,receiptFile,weekStartEat,
        invoke:(name,options)=>supabase.functions.invoke(name,options),
      });
      setAck(result);
    }catch(cause){setError(messageFor(cause));}
    finally{setBusy(false);}
  }
  return <section aria-labelledby="wk100-research-heading"
    className="rounded-xl border border-wk-border bg-wk-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="wk100-research-heading" className="text-base font-bold text-wk-text">
          Private Research Evidence
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-wk-text-soft">
          Select the original Shazam Kenya chart CSV and its existing researcher receipt.
          We verify and retain the original bytes in restricted private storage.
        </p>
      </div>
      <span className="rounded-full border border-wk-border px-3 py-1 text-xs font-semibold text-wk-text-soft">
        Research only
      </span>
    </div>
    <p className="mt-3 text-xs text-wk-text-muted">
      Week of {weekStartEat} (East Africa Time). The source’s native measurement period remains
      unknown. This observation does not authorize scoring, ranking or publication.
    </p>
    <form className="mt-4 space-y-3" onSubmit={upload}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
          <p className="text-sm font-semibold text-wk-text">Original Shazam CSV</p>
          <p className="mt-1 text-xs text-wk-text-muted">
            {originalCsv?"Original CSV selected":"No CSV selected"}
          </p>
          <label htmlFor="wk100-research-csv"
            className="wk-button wk-button-secondary wk-button-sm mt-3 inline-flex cursor-pointer">
            Select original CSV
          </label>
          <input id="wk100-research-csv" className="sr-only" type="file"
            accept=".csv,text/csv" disabled={busy}
            onChange={event=>changeCsv(event.currentTarget.files?.[0]??null)}/>
        </div>
        <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
          <p className="text-sm font-semibold text-wk-text">Research receipt</p>
          <p className="mt-1 text-xs text-wk-text-muted">
            {receiptFile?"Research receipt selected":"No receipt selected"}
          </p>
          <label htmlFor="wk100-research-receipt"
            className="wk-button wk-button-secondary wk-button-sm mt-3 inline-flex cursor-pointer">
            Select receipt JSON
          </label>
          <input id="wk100-research-receipt" className="sr-only" type="file"
            accept=".json,application/json" disabled={busy}
            onChange={event=>changeReceipt(event.currentTarget.files?.[0]??null)}/>
        </div>
      </div>
      {!draftSaved&&<p className="text-xs text-wk-text-muted">
        Save the full weekly Admin configuration to the server before submitting evidence.
      </p>}
      <button type="submit" disabled={!ready}
        className="wk-button wk-button-primary wk-button-sm disabled:cursor-not-allowed disabled:opacity-50">
        {busy?"Verifying private evidence…":"Verify and save research observation"}
      </button>
    </form>
    {error&&<p className="mt-3 text-sm text-wk-danger" role="alert">{error}</p>}
    {ack&&<p className="mt-3 text-sm text-wk-text" role="status" aria-live="polite">
      Private original bytes verified and receipt saved for {ack.weekStartEat}.
      {" "}{ack.observedDepth} discovery ranks recorded. Research only; not admitted for
      chart scoring or publication.
    </p>}
    {archivedResearch.length>0&&<div className="mt-5 border-t border-wk-border pt-4"
      aria-label="Previously captured source research">
      <h3 className="text-sm font-semibold text-wk-text">Research already captured for this week</h3>
      <p className="mt-1 text-xs text-wk-text-muted">
        These are October 29–30 operator-archive audit references, not live Supabase
        receipts. We will reuse the original files rather than request fresh downloads.
        No source is admitted to scoring or publication.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {archivedResearch.map(source=><li key={source.sourceKey}
          className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
          <p className="text-sm font-semibold text-wk-text">{source.displayName}</p>
          <p className="mt-1 text-xs text-wk-text-soft">
            {source.rankStructure==="verified"
              ?`${source.rankDepth} source-native ranks audited`
              :"Original preserved; ranked recording structure unresolved"}
          </p>
          <p className="mt-1 text-xs text-wk-text-muted">{source.note}</p>
        </li>)}
      </ul>
      <p className="mt-3 text-xs text-wk-text-muted">
        The existing secure upload above accepts Shazam CSV only. Mdundo and Apple
        HTML require their own reviewed server intake; Audiomack requires native
        recording-rank evidence. No provider-native measurement week is inferred.
      </p>
    </div>}
    <p className="mt-3 text-xs text-wk-text-muted">
      Original ranks and researcher details stay off this page and out of browser storage.
      Keep both files for reconciliation if the server cannot confirm the receipt.
    </p>
  </section>;
}
