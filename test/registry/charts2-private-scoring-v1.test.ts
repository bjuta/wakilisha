import {describe,expect,it} from "vitest";
import {inspectCharts2FrozenEditionProjectionV1} from "../../supabase/functions/_shared/charts2-publication-bridge-v1.mjs";
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
const FREEZE_SQL=readFileSync("supabase/migrations/20261119111655_charts2_private_freeze_authority_v1.sql","utf8");
const ORIGIN_SQL=readFileSync("supabase/migrations/20261119180542_charts2_top100_origin_neutral_integrity_v1.sql","utf8");
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

  it("allows 100 separately reviewed canonical recordings while preserving 500 unresolved observations",()=>{
    const receipts=fullReceipts();
    const links=Array.from({length:100},(_,i)=>link("apple_ke",i+1,1000+i));
    const preview=score(receipts,links);
    expect(preview.candidates).toHaveLength(100);
    expect(preview.unresolved).toHaveLength(500);
    expect(preview.conflicts).toHaveLength(0);
    expect(preview.review_status).toBe("eligible_for_private_review");
    expect(preview.candidates[0].score_points).toBe("20.00");
    expect(preview.candidates[99].score_points).toBe("0.20");
    expect(preview.frozen).toBe(false);
    expect(preview.can_publish).toBe(false);
  });

  it("freezes only an immutable reviewed private 100 with exact SQL digest and revision",()=>{
    expect(FREEZE_SQL).toContain("create table platform_private.charts2_private_freezes_v1");
    expect(FREEZE_SQL).toContain("before update or delete");
    expect(FREEZE_SQL).toContain("charts2_private_freezes_immutable_v1");
    expect(FREEZE_SQL).toContain("enable row level security");
    expect(FREEZE_SQL).toContain("jsonb_array_length(ranking)=100");
    expect(FREEZE_SQL).toContain("to authenticated;");
    expect(FREEZE_SQL).toContain("to service_role;");
    expect(FREEZE_SQL).toContain("from public,anon,authenticated,service_role;");
    expect(FREEZE_SQL).toContain("public.current_user_has_capability('manage_charts')");
    expect(FREEZE_SQL).toContain("public.current_user_has_capability('manage_registry')");
    expect(FREEZE_SQL).toContain("auth.uid()");
    expect(FREEZE_SQL).toContain("pg_advisory_xact_lock");
    expect(FREEZE_SQL).toContain("charts2_private_freeze_stale_snapshot");
    expect(FREEZE_SQL).toContain("charts2_private_freeze_revision_conflict");
    expect(FREEZE_SQL).toContain("charts2_private_freeze_insufficient_registry_authority");
    expect(FREEZE_SQL).toContain("charts2_private_freeze_digest_conflict");
    expect(FREEZE_SQL).toContain("return jsonb_build_object('id',duplicate.id");
    expect(FREEZE_SQL).toContain("source_receipts jsonb not null");
    expect(FREEZE_SQL).toContain("input_sha256 text not null unique");
    expect(FREEZE_SQL).toContain("can_publish boolean not null default false");
    expect(FREEZE_SQL).toContain("jsonb_array_length(material->'ranking')<>100");
    expect(FREEZE_SQL).not.toContain("insert into public.wk_chart_entries_v2");
    expect(FREEZE_SQL).not.toContain("insert into public.wk_chart_editions_v2");
  });

  it("never accepts browser-crafted ranks or a service-role actor for freezing",()=>{
    expect(STUDIO_WORKER).toContain('mode==="studio_freeze"');
    expect(STUDIO_WORKER).toContain('await requireRegistryReviewer(authClient)');
    expect(STUDIO_WORKER).toContain('authClient.rpc("charts2_freeze_private_candidate_v1"');
    expect(STUDIO_WORKER).not.toContain('server.rpc("charts2_freeze_private_candidate_v1"');
    expect(STUDIO_WORKER).toContain('server.rpc("charts2_private_freeze_preflight_v1"');
    expect(STUDIO_WORKER).toContain('charts2_private_freeze_score_disagreement');
    expect(STUDIO_WORKER).toContain('await Promise.all(receipts.map((r:any)=>verifyPrivateOriginal(server,r)))');
    expect(STUDIO_PAGE).toContain('Freeze Exact 100-Recording Private Candidate');
    expect(STUDIO_PAGE).toContain('freeze_gate');
    expect(STUDIO_PAGE).toContain('WkCheckbox');
    expect(STUDIO_PAGE).toContain('freezeConsent');
    expect(STUDIO_PAGE).toContain('!gate?.freeze_ready');
    expect(STUDIO_PAGE).not.toContain('publish_edition');
  });

  it("limits artist-origin neutrality to the new top100 method and blocks its publisher",()=>{
    expect(ORIGIN_SQL).toContain("CREATE OR REPLACE FUNCTION public.chart_get_edition_integrity_report");
    for(const term of [
      "public.chart_get_edition_integrity_report(p_edition_id text)",
      "e.program_id='top100'",
      "p.public_slug='top100'",
      "p.market_slug='KE'",
      "e.methodology_version='consumption_led_cultural_presence_v1'",
      "e.scoring_policy_version='charts2-private-ordinal-v1'",
      "then true else false end as charts2_origin_neutral",
      "s.unresolved_origin_entries > 0 and not s.charts2_origin_neutral",
      "s.country_ineligible_entries > 0 and not s.charts2_origin_neutral",
      "not ed.charts2_origin_neutral",
      "'charts2_requires_exact_100'",
      "'charts2_publisher_not_enabled'",
    ]) expect(ORIGIN_SQL).toContain(term);
    expect(ORIGIN_SQL).not.toContain("update public.wk_chart_programs_v2");
    expect(ORIGIN_SQL).not.toContain("insert into public.wk_chart_editions_v2");
    expect(ORIGIN_SQL).not.toContain("insert into public.wk_chart_entries_v2");
    expect(ORIGIN_SQL).not.toContain("create or replace function public.chart_assert_publishable_edition");
    expect(ORIGIN_SQL).not.toContain("create or replace function public.wk_chart_editions_publish_integrity_guard");
    expect(ORIGIN_SQL).not.toContain("create policy");
    // No frontend copy or wording is changed by the migration.
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
  it("preflights only an actual immutable private 100-recording freeze for an offline Chart V2 projection",()=>{
    const ROW_UUID=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
    const READ_RECEIPTS=SOURCE.map(([source_key],i)=>({
      source_key,receipt_id:ROW_UUID(500+i),original_sha256:String(i+1).repeat(64),
      observed_at:"2026-11-19T09:27:00+00:00",
      native_period_authority:source_key==="youtube_ke"?"provider_declared_end_date":"unknown",
      provider_week_ending_date:source_key==="youtube_ke"?"2026-11-12":null,
      provider_updated_at:null,
    }));
    const rows=Array.from({length:100},(_,i)=>{
      const rank=i+1,units=40*(101-rank);
      return {position:rank,track_id:ROW_UUID(1001+i),score_units:units,
        score_points:(units/200).toFixed(2),source_contributions:[{
          source_key:"apple_ke",receipt_id:READ_RECEIPTS[2].receipt_id,
          original_sha256:READ_RECEIPTS[2].original_sha256,rank,
          source_weight_points:20,credit_units:units,
          registry_provider_link_id:ROW_UUID(4001+i),
        }]};
    });
    const freeze={id:ROW_UUID(200),frozen_by:ROW_UUID(300),frozen_at:"2026-11-19T18:30:00Z",
      lifecycle:"frozen_private",can_publish:false,
      methodology_version:"consumption_led_cultural_presence_v1",
      scoring_policy_version:"charts2-private-ordinal-v1",
      input_sha256:"a".repeat(64),ranking_sha256:"b".repeat(64),
      source_receipts:READ_RECEIPTS,ranking:rows,unresolved_observations:500};
    const preflight={contract:"charts2-private-freeze-preflight/v1",freeze_ready:true,
      can_publish:false,eligible_count:100,conflict_count:0,
      input_sha256:freeze.input_sha256,ranking_sha256:freeze.ranking_sha256,
      latest_freeze_id:freeze.id,
      recent_freezes:[{id:freeze.id,input_sha256:freeze.input_sha256,
        ranking_sha256:freeze.ranking_sha256,frozen_private:true}],
      source_receipts:structuredClone(READ_RECEIPTS),ranking:structuredClone(rows)};
    const programme={id:"top100",series_slug:"top100",public_slug:"top100",
      market_slug:"KE",chart_size:100,default_methodology_version:"weighted_streaming_v1"};
    const methodology={methodology_version:freeze.methodology_version,
      scoring_policy_version:freeze.scoring_policy_version,
      rule_set:{scope:"private_review_only",can_publish:false,unit_denominator:200,
        weights:{youtube_ke:30,mdundo_ke:25,apple_ke:20,audiomack_ke:15,shazam_ke:10}}};
    const registryTracks=Array.from({length:100},(_,i)=>({
      id:ROW_UUID(1001+i),slug:"recording-"+(i+1),title:"Recording "+(i+1),status:"active"}));
    const fixture={freeze,preflight,programme,methodology,registryTracks};
    const clone=()=>structuredClone(fixture);
    const projection=inspectCharts2FrozenEditionProjectionV1(clone());
    expect(projection.contract).toBe("charts2-chart-v2-projection/v1");
    expect(projection.entries).toHaveLength(100);
    expect(projection.entries[0].score_points).toBe("20.00");
    expect(projection.entries[99].score_points).toBe("0.20");
    expect(projection.can_stage).toBe(false);
    expect(projection.can_publish).toBe(false);
    expect(projection.artist_origin_policy).toBe("informational_non_blocking");
    expect(projection.outstanding_gates).toContain("top100_scoped_origin_neutral_integrity");
    expect(projection.outstanding_gates).not.toContain("actual_registry_artist_origin_integrity");
    // No artist country-of-origin is supplied by the valid 100-row fixture.
    // Missing, unknown or non-KE origins must never reject a Chart 2.0 track.
    expect(projection).not.toHaveProperty("edition_id");
    expect(projection).not.toHaveProperty("publish");
    const deny=(mutate:(x:any)=>void,reason:string)=>{
      const candidate=clone(); mutate(candidate);
      expect(()=>inspectCharts2FrozenEditionProjectionV1(candidate))
        .toThrow("charts2_bridge_"+reason);
    };
    deny(x=>{delete x.freeze;},"immutable_private_freeze_required");
    deny(x=>{x.freeze.can_publish=true;},"immutable_private_freeze_required");
    deny(x=>{x.freeze.frozen_by="browser";},"immutable_private_freeze_required");
    deny(x=>{x.preflight.freeze_ready=false;},"current_authority_or_digest_missing");
    deny(x=>{x.preflight.input_sha256="c".repeat(64);},"current_authority_or_digest_missing");
    deny(x=>{x.preflight.latest_freeze_id=ROW_UUID(201);},"current_authority_or_digest_missing");
    deny(x=>{x.programme.id="toprnb";},"programme_not_prospectively_authorized");
    deny(x=>{x.methodology.rule_set.weights.youtube_ke=40;},"methodology_authority_drift");
    deny(x=>{x.freeze.source_receipts.pop();},"five_receipts_required");
    deny(x=>{x.preflight.source_receipts[2].original_sha256="f".repeat(64);},"source_original_changed");
    deny(x=>{x.freeze.ranking.pop();},"exact_100_rank_required");
    deny(x=>{x.freeze.ranking[1].track_id=x.freeze.ranking[0].track_id;},"ranking_or_track_identity_invalid");
    deny(x=>{x.freeze.ranking[0].score_units=3900;x.freeze.ranking[0].score_points="19.50";},"current_ranking_changed");
    deny(x=>{x.freeze.ranking[0].source_contributions[0].credit_units=3999;},"source_credit_invalid");
    deny(x=>{x.freeze.ranking[0].source_contributions[0].registry_provider_link_id=null;},"source_credit_invalid");
    deny(x=>{x.registryTracks[0].status="needs_review";},"registry_track_invalid");
    // The private projection is never permission to mutate retained Chart V2 tables.
    const contract=readFileSync("supabase/functions/_shared/charts2-publication-bridge-v1.mjs","utf8");
    expect(contract).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+INTO\s+public\.wk_chart_/i);
    expect(contract).not.toContain("supabase.functions.invoke");
  });

});
