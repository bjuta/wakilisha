import {describe,expect,it} from "vitest";
import { readFileSync } from "node:fs";
import {
  CHARTS2_PRIVATE_METHODOLOGY_V1,
  scoreCharts2PrivatePreviewV1,
} from "../../supabase/functions/_shared/charts2-private-scoring-v1.mjs";

const SOURCE = [
  ["youtube_ke",100,"https://charts.youtube.com/youtubei/v1/browse?alt=json",".json"],
  ["mdundo_ke",100,"https://play.mdundo.com/top-charts/ke",".html"],
  ["apple_ke",100,"https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172",".html"],
  ["audiomack_ke",100,"https://audiomack.com/geo-charts/playlist/kenya",".html"],
  ["shazam_ke",200,"https://www.shazam.com/services/charts/csv/top-200/kenya",".csv"],
] as const;
const KEY:Record<string,string>={
  youtube_ke:"youtube",mdundo_ke:"mdundo",apple_ke:"apple_music",
  audiomack_ke:"audiomack",shazam_ke:"shazam",
};
const UUID=(i:number)=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0");
const fullReceipts=()=>SOURCE.map(([source_key,depth,source_endpoint,ext],i)=>{
  const hash=String(i+1).repeat(64);
  return {
    id:UUID(i+1),receipt_schema:"charts2-original-receipt/v1",
    source_key,market:"KE",source_endpoint,method_revision:1,
    capture_mode:"service_original",original_bucket:"charts2-evidence-private-v1",
    original_sha256:hash,original_byte_length:1000,
    original_object_key:source_key+"/"+hash.slice(0,2)+"/"+hash+ext,
    observed_at:"2026-11-19T09:27:20.000Z",
    original_verified_at:"2026-11-19T09:27:21.000Z",
    native_period_authority:source_key==="youtube_ke"
      ?"provider_declared_end_date":"unknown",
    provider_week_ending_date:source_key==="youtube_ke"?"2026-11-12":null,
    provider_updated_at:source_key==="audiomack_ke"?"2026-11-18T16:57:11Z":null,
    observed_status:"succeeded",observed_depth:depth,expected_depth:depth,
    candidate_only:true,can_score:false,can_publish:false,
    observations:Array.from({length:depth},(_,j)=>({
      rank:j+1,title:"Unresolved recording "+String(j+1),artist:"A",
      provider_track_id:source_key+":"+String(j+1),
    })),
  };
});
function link(source_key:string,rank:number,track:number,version:number=1){
  return {
    id:UUID(version*100000+SOURCE.findIndex(s=>s[0]===source_key)*1000+rank),
    track_id:UUID(track),provider_key:KEY[source_key],
    provider_track_id:source_key+":"+String(rank),
    match_status:"matched",match_method:"manual",
    match_confidence:1,track_status:"active",
    review_evidence:{
      charts2_studio_review_v1:true,source_key,
      receipt_id:fullReceipts().find(r=>r.source_key===source_key)!.id,
      original_sha256:fullReceipts().find(r=>r.source_key===source_key)!.original_sha256,
      provider_track_id:source_key+":"+String(rank),
      review_note:"Independent version-specific recording evidence has been reviewed against the Registry.",
      evidence_url:"https://example.com/recording-evidence",
    },
  };
}
function score(receipts:any[],registry_links:any[]=[]){
  return scoreCharts2PrivatePreviewV1({receipts,registry_links});
}

const STUDIO_SQL=readFileSync("supabase/migrations/20261119101415_charts2_studio_private_reader_v1.sql","utf8");
const STUDIO_WORKER=readFileSync("supabase/functions/charts2-capture/index.ts","utf8");
const STUDIO_PAGE=readFileSync("src/pages/admin/charts/studio/page.tsx","utf8");
const ROUTER=readFileSync("src/router/config.tsx","utf8");
const SHELL=readFileSync("src/pages/admin/AdminShell.tsx","utf8");

describe("Charts 2.0 Phase 2 private deterministic ordinal scoring",()=>{
  it("locks five weights, exact 200-unit scale and never publishes",()=>{
    expect(CHARTS2_PRIVATE_METHODOLOGY_V1.version)
      .toBe("consumption_led_cultural_presence_v1");
    const p=CHARTS2_PRIVATE_METHODOLOGY_V1.sources;
    expect(Object.fromEntries(Object.entries(p).map(([k,v]:any)=>[k,v.weight_points])))
      .toEqual({
        youtube_ke:30,mdundo_ke:25,apple_ke:20,audiomack_ke:15,shazam_ke:10,
      });
    expect(CHARTS2_PRIVATE_METHODOLOGY_V1.score_unit_denominator).toBe(200);
  });

  it("requires all five genuine, distinct, privately verified receipts",()=>{
    const r=fullReceipts();
    expect(()=>score(r.slice(0,4))).toThrow("charts2_scoring_receipt_set_incomplete");
    expect(()=>score([...r.slice(0,4),r[0]])).toThrow("charts2_scoring_duplicate_source_receipt");
    expect(()=>score([...r.slice(0,4),{...r[4],can_publish:true}]))
      .toThrow("charts2_scoring_unqualified_receipt");
    expect(()=>score([...r.slice(0,4),{...r[4],original_sha256:"a".repeat(64)}]))
      .toThrow("charts2_scoring_original_key_mismatch");
    expect(()=>score([...r.slice(0,4),{...r[4],source_endpoint:"https://untrusted.example/chart"}]))
      .toThrow("charts2_scoring_unqualified_receipt");
    expect(()=>score([...r.slice(0,4),{...r[4],original_verified_at:"2026-11-19T09:26:00Z"}]))
      .toThrow("charts2_scoring_unqualified_receipt");
  });

  it("does not infer recording identity or award invented zero ranks",()=>{
    const r=score(fullReceipts());
    expect(r.candidates).toHaveLength(0);
    expect(r.unresolved).toHaveLength(600);
    expect(r.conflicts).toHaveLength(0);
    expect(r.review_status).toBe("identity_review_required");
    expect(r.can_publish).toBe(false);
    expect(r.frozen).toBe(false);
    expect(r.source_coverage).toHaveLength(5);
    expect(r.source_coverage.find((s:any)=>s.source_key==="apple_ke")
      .native_period_authority).toBe("unknown");
  });

  it("credits 30/25/20/15/10 exactly for the same proven recording at rank 1",()=>{
    const links=SOURCE.map(([name])=>link(name,1,900));
    const result=score(fullReceipts(),links);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].score_units).toBe(20000);
    expect(result.candidates[0].score_points).toBe("100.00");
    expect(result.candidates[0].source_count).toBe(5);
    expect(result.candidates[0].source_contributions.reduce(
      (n:number,x:any)=>n+x.credit_units,0)).toBe(20000);
    expect(result.unresolved).toHaveLength(595);
  });

  it("uses 200 native Shazam ranks and never treats recognitions as streams",()=>{
    const result=score(fullReceipts(),[
      link("shazam_ke",200,18),link("youtube_ke",100,19),
    ]);
    expect(result.candidates.find((c:any)=>c.track_id===UUID(18))?.score_points)
      .toBe("0.05");
    expect(result.candidates.find((c:any)=>c.track_id===UUID(19))?.score_points)
      .toBe("0.30");
  });

  it("rejects holes, duplicate ranks, and fake full-depth responses",()=>{
    const original=fullReceipts();
    const dup=fullReceipts(); dup[1].observations[1].rank=1;
    expect(()=>score(dup)).toThrow("charts2_scoring_observation_unqualified");
    const hole=fullReceipts();hole[1].observations[1].rank=3;
    expect(()=>score(hole)).toThrow("charts2_scoring_observation_unqualified");
    const partial=fullReceipts();
    partial[1].observations.pop();partial[1].observed_depth=99;
    partial[1].observed_status="partial_depth";
    expect(score(partial).source_coverage.find((s:any)=>s.source_key==="mdundo_ke")
      .observed_depth).toBe(99);
    expect(()=>score([...partial.slice(0,1),{
      ...partial[1],observed_status:"succeeded",
    },...partial.slice(2)])).toThrow("charts2_scoring_unqualified_receipt");
    expect(original).toHaveLength(5);
  });

  it("never merges based on existing weak title/artist Registry links",()=>{
    const weak={...link("apple_ke",1,67),match_method:"exact_title_artist"};
    const result=score(fullReceipts(),[weak]);
    expect(result.candidates).toHaveLength(0);
    expect(result.unresolved).toHaveLength(600);
  });

  it("does not guess Shazam provider IDs from title/artist strings",()=>{
    const r=fullReceipts();
    for(const o of r[4].observations)o.provider_track_id=null as any;
    const result=score(r,[link("shazam_ke",1,88)]);
    expect(result.candidates).toHaveLength(0);
    expect(result.unresolved.filter((o:any)=>o.source_key==="shazam_ke"))
      .toHaveLength(200);
    expect(result.unresolved.find((o:any)=>o.source_key==="shazam_ke")
      ?.reason).toBe("provider_recording_id_missing");
  });

  it("fails closed on ambiguous Registry links and double-counted source tracks",()=>{
    const conflict=score(fullReceipts(),[
      link("apple_ke",1,20,1),link("apple_ke",1,21,2),
    ]);
    expect(conflict.review_status).toBe("identity_conflict");
    expect(conflict.conflicts[0].reason).toBe("registry_provider_identity_conflict");
    const duplicate=score(fullReceipts(),[
      link("mdundo_ke",1,45),link("mdundo_ke",2,45),
    ]);
    expect(duplicate.review_status).toBe("identity_conflict");
    expect(duplicate.conflicts[0].reason).toBe("duplicate_source_recording");
    expect(duplicate.candidates[0].source_count).toBe(1);
  });

  it("keeps the exact deterministic tie-break and ignores input order",()=>{
    const r=fullReceipts(),links=[
      link("apple_ke",1,100),link("mdundo_ke",1,101),
    ];
    const a=score(r,links),b=score([...r].reverse(),[...links].reverse());
    expect(a).toEqual(b);
    // Equal-scoring independent videos tie by Track UUID, not artist/title.
    const c=score(r,[link("youtube_ke",1,300),link("youtube_ke",2,301)]);
    expect(c.candidates.map((x:any)=>x.score_units))
      .toEqual([6000,5940]);
  });

  it("credits only receipt-bound, exact corroborated manual Registry admission",()=>{
    const receipts=fullReceipts();
    const method={
      ...link("mdundo_ke",1,701),match_method:"manual",match_confidence:1,
      review_evidence:{
        charts2_studio_review_v1:true,source_key:"mdundo_ke",
        receipt_id:receipts[1].id,
        original_sha256:receipts[1].original_sha256,
        provider_track_id:"mdundo_ke:1",
        review_note:"Independent recording version identity was verified against reliable source metadata.",
        evidence_url:"https://example.com/recording",
      },
    };
    expect(score(receipts,[method]).candidates[0].score_points).toBe("25.00");
    expect(score(receipts,[{...method,review_evidence:{
      ...method.review_evidence,receipt_id:UUID(789),
    }}]).candidates).toHaveLength(0);
    expect(score(receipts,[{...method,match_confidence:0.5}]).candidates).toHaveLength(0);
    expect(score(receipts,[{...method,review_evidence:{
      ...method.review_evidence,evidence_url:"http://example.com/",
    }}]).candidates).toHaveLength(0);
  });

  it("protects private Studio snapshot, real JWT broker and no-publication route",()=>{
    expect(STUDIO_SQL).toContain("charts2_studio_private_snapshot_v1");
    expect(STUDIO_SQL).toContain("to service_role;");
    expect(STUDIO_SQL).toContain("from public,anon,authenticated,service_role;");
    expect(STUDIO_SQL).toContain("consumption_led_cultural_presence_v1");
    expect(STUDIO_SQL).toContain("platform_private.charts2_capture_receipts_v1");
    expect(STUDIO_SQL).not.toContain("insert into public.wk_chart_editions_v2");
    expect(STUDIO_SQL).not.toContain("insert into public.wk_chart_entries_v2");
    expect(STUDIO_WORKER).toContain('server.rpc("charts2_studio_private_snapshot_v1"');
    expect(STUDIO_WORKER).toContain('required_capability:"manage_registry"');
    expect(STUDIO_WORKER).toContain('crypto.subtle.digest("SHA-256",bytes)');
    expect(STUDIO_WORKER).toContain('authClient.rpc("admin_admit_registry_track_provider_link_v1"');
    expect(STUDIO_WORKER).not.toContain('server.rpc("admin_admit_registry_track_provider_link_v1"');
    expect(STUDIO_WORKER).toContain('p_match_method:"manual",p_match_confidence:1');
    expect(STUDIO_WORKER).toContain('storedWeights[name]!==policy.weight_points');
    expect(ROUTER).toContain('path: "studio", element: <AdminGuard capabilities={["manage_charts"]}><AdminChartsStudioPage /></AdminGuard>');
    expect(SHELL).toContain('path: "/admin/charts/studio"');
    for (const action of ["studio_preview","studio_review_link","studio_track_search","verify_method","review_method"]) {
      expect(STUDIO_PAGE).toContain(action);
    }
    expect(STUDIO_PAGE).toContain("Collect / retry");
    expect(STUDIO_PAGE).not.toContain("publish_edition");
  });

  it("preserves provider time without inventing synchronized weeks",()=>{
    const r=fullReceipts();
    const result=score(r);
    expect(result.source_coverage.find((s:any)=>s.source_key==="youtube_ke")
      ?.provider_week_ending_date).toBe("2026-11-12");
    for(const k of ["apple_ke","mdundo_ke","audiomack_ke","shazam_ke"]){
      const c=result.source_coverage.find((s:any)=>s.source_key===k);
      expect(c.provider_week_ending_date).toBeNull();
      expect(c.native_period_authority).toBe("unknown");
    }
    expect(result.source_coverage.find((s:any)=>s.source_key==="audiomack_ke")
      ?.provider_updated_at).toBe("2026-11-18T16:57:11Z");
  });
});
