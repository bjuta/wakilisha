import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { parseChartReviewReference } from "@/services/chartsPrivate/chartReviewContext";

type Artist = {artist_id:string;artist_slug:string;display_name:string;status:string};
type Source = {
  state:"verified_chart_review_context";source_key:string;receipt_id:string;
  original_sha256:string;rank:number;title:string;artist:string|null;
  provider_track_id:string|null;
};
const DECLARATION="I independently verified this Artist identity and accept that this governed Alias operation may also correct existing public chart Artist references.";

export function ChartAliasReview() {
  const [params]=useSearchParams();
  const key=params.toString();
  const reference=useMemo(()=>parseChartReviewReference(new URLSearchParams(key)),[key]);
  const [source,setSource]=useState<Source|null>(null);
  const [query,setQuery]=useState("");
  const [artists,setArtists]=useState<Artist[]>([]);
  const [selected,setSelected]=useState<Artist|null>(null);
  const [reason,setReason]=useState("");
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    setSource(null);setArtists([]);setSelected(null);setConsent(false);
    setReason("");setNotice("");setError("");setQuery("");
    if(!reference)return;
    let active=true;
    void supabase.functions.invoke("charts2-capture?mode=studio_review_context",{
      body:reference,
    }).then(({data,error})=>{
      if(!active)return;
      if(error||data?.state!=="verified_chart_review_context"||
        data.receipt_id!==reference.receipt_id||
        data.original_sha256!==reference.original_sha256||
        data.rank!==reference.rank){
        setError("This chart-origin Artist claim could not be independently verified.");
        return;
      }
      setSource(data as Source);
      setQuery((data.artist as string|null)??"");
    }).catch(()=>{
      if(active)setError("The original chart Artist claim could not be verified.");
    });
    return ()=>{active=false;};
  },[reference]);
  if(!reference)return null;

  const findArtist=async()=>{
    if(query.trim().length<2)return;
    setBusy("search");setError("");setSelected(null);
    try{
      const {data,error}=await supabase.rpc("admin_search_registry_artists",{
        p_query:query.trim(),p_limit:12,
      });
      if(error)throw error;
      setArtists(((data??[]) as Artist[]).filter(item=>
        item.status==="active"||item.status==="draft"));
    }catch(e){
      setError(e instanceof Error?e.message:"Registry Artist search failed.");
      setArtists([]);
    }finally{setBusy("");}
  };
  const admitAlias=async()=>{
    if(!source?.artist||!selected||reason.trim().length<40||!consent){
      setError("Select an existing Registry Artist and document independent identity evidence.");
      return;
    }
    setBusy("save");setError("");
    try{
      const {error}=await supabase.rpc("admin_set_registry_artist_alias_v1",{
        p_alias_slug:source.artist,
        p_canonical_artist_id:selected.artist_id,
        p_alias_display_name:source.artist,
        p_source:"manual",p_status:"active",
        p_note:reason.trim()+" | Chart original "+source.source_key+
          " receipt "+source.receipt_id+" rank "+source.rank+
          " SHA "+source.original_sha256,
      });
      if(error)throw error;
      setNotice("Reviewed Artist Alias accepted through Registry authority. Reopen the original chart position to inspect the effect.");
      setSelected(null);setConsent(false);
    }catch(e){setError(e instanceof Error?e.message:"Alias review was rejected.");}
    finally{setBusy("");}
  };
  return <section className="mb-5 space-y-3 rounded-2xl border border-wk-border bg-wk-surface p-4"
    aria-label="Chart-source Artist Alias review">
    <h2 className="text-[15px] font-black text-wk-text">Review this Chart Artist Alias</h2>
    {!source?.artist?
      <p className="text-[12px] text-wk-warning">
        The original chart observation has no Artist name. Do not create an Alias from a missing credit.
      </p>:
      <>
        <p className="text-[12px] text-wk-text">
          Original credit: <strong>{source.artist}</strong> · {source.title} · #{source.rank}
        </p>
        <p className="text-[12px] text-wk-warning">
          Verify the Artist separately from the recording. This approved Alias operation
          can correct Artist references in existing PUBLIC chart editions, not just this
          private chart. Review that wider effect before applying.
        </p>
        <label className="block text-[12px] font-bold text-wk-text" htmlFor="chart-alias-canonical-search">
          Find the canonical Registry Artist to keep
        </label>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e=>{e.preventDefault();void findArtist();}}>
          <input id="chart-alias-canonical-search" value={query} onChange={e=>{
              setQuery(e.target.value);setArtists([]);setSelected(null);setConsent(false);
            }}
            className="min-w-0 flex-1 rounded-xl border border-wk-border bg-wk-surface p-3 text-sm"
            placeholder="Search Registry Artist"/>
          <button type="submit" disabled={!!busy||query.trim().length<2}
            className="rounded-xl border border-wk-border px-4 py-3 text-xs font-bold disabled:opacity-40">
            {busy==="search"?"Searching…":"Search Artists"}
          </button>
        </form>
        {artists.length===0 && !busy &&
          <p className="text-[12px] text-wk-text-muted">
            Select an existing canonical Artist after searching. No name is auto-approved.
          </p>}
        {artists.map(artist=>
          <button key={artist.artist_id} type="button"
            aria-pressed={selected?.artist_id===artist.artist_id}
            className={"block w-full rounded-xl border p-3 text-left text-[12px] "+
              (selected?.artist_id===artist.artist_id?"border-wk-brand bg-wk-brand-soft":"border-wk-border")}
            onClick={()=>{setSelected(artist);setConsent(false);}}>
            <strong>{artist.display_name}</strong> · {artist.status}
            <span className="mt-1 block font-mono text-[10px] text-wk-text-muted">{artist.artist_id}</span>
          </button>)}
        <label className="block text-[12px] font-bold text-wk-text" htmlFor="chart-alias-evidence">
          Why is this the same Artist?
        </label>
        <textarea id="chart-alias-evidence" rows={3} value={reason}
          onChange={e=>{setReason(e.target.value);setConsent(false);}}
          className="w-full rounded-xl border border-wk-border bg-wk-surface p-3 text-sm"
          placeholder="Independent Artist identity, verified credits and documentary evidence"/>
        <WkCheckbox checked={consent} onChange={setConsent}>
          {DECLARATION}
        </WkCheckbox>
        <div className="flex justify-end">
          <button type="button" disabled={!selected||reason.trim().length<40||!consent||!!busy||!!notice}
            onClick={()=>void admitAlias()}
            className="min-h-11 rounded-xl bg-wk-brand px-4 py-3 text-xs font-bold text-white disabled:opacity-40">
            {busy==="save"?"Reviewing Alias…":"Approve Exact Artist Alias"}
          </button>
        </div>
      </>}
    {error&&<p role="alert" className="text-[12px] text-wk-danger">{error}</p>}
    {notice&&<p role="status" className="text-[12px] text-wk-success">{notice}</p>}
  </section>;
