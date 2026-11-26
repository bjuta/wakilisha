import {describe,expect,it} from "vitest";
import {inspectCharts2FrozenEditionProjectionV1} from "../../supabase/functions/_shared/charts2-publication-bridge-v1.mjs";
import {buildCharts2PrivateNativeReviewV1,buildCharts2RegistryDiscoveryV1,readCharts2RegistryDiscoveryV1,buildCharts2InvestigationInputV1,verifyCharts2InvestigationParityV1} from "../../supabase/functions/_shared/charts2-private-native-review-v1.mjs";
import {suggestRecordingReviewGroups,buildRecordingInvestigationGroups,bindRecordingInvestigationGroups} from "../../src/services/chartsPrivate/recordingReviewSuggestions";
import {
  appendChartReviewReference,
  chartStudioReturnHref,
  parseChartReviewReference,
  isChartReviewReference,
  prepareChartTrackIntakes,
  appendChartIntakeBatch,
  parseChartIntakeBatch,
  writeChartIntakeBatch,
  matchesOriginalAppleChartSong,
} from "../../src/services/chartsPrivate/chartReviewContext";
import { readFileSync } from "node:fs";
import { getEntitySchema } from "../../src/services/registry/admin/entitySchemas";
import { normalizeForSave, validateField } from "../../src/services/registry/admin/fieldNormalization";
import { createHash } from "node:crypto";
import { decodeCharts2Original, verifyCharts2OriginalBytesV1 } from "../../supabase/functions/_shared/charts2-original-candidate.mjs";
import {
  parseYouTubeKenyaOfficialExport, YOUTUBE_EXPORT_ENDPOINT, YOUTUBE_EXPORT_MODE,
  YOUTUBE_EXPORT_PERIOD_AUTHORITY, YOUTUBE_EXPORT_PARSER_VERSION, YOUTUBE_EXPORT_ACK,
} from "../../supabase/functions/_shared/charts2-youtube-official-export.mjs";
import {
  CHARTS2_PRIVATE_METHODOLOGY_V1,
  scoreCharts2PrivatePreviewV1, summarizeCharts2SourceCoverageV1,
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
const REGISTRY_DISCOVERY_SHARED=readFileSync("supabase/functions/_shared/charts2-private-native-review-v1.mjs","utf8");
const CHART_REVIEW_REF=readFileSync("src/services/chartsPrivate/chartReviewContext.ts","utf8");
const CHART_RETURN=readFileSync("src/components/admin/charts/ChartReviewReturnContext.tsx","utf8");
const CHART_ALIAS_REVIEW=readFileSync("src/components/admin/charts/ChartAliasReview.tsx","utf8");
const CHART_ARTIST_INTAKE_SQL=readFileSync("docs/engineering/charts2-artist-origin-intake-proposed-sql-v1.sql","utf8");
const CHART_ARTIST_INTAKE_PAGE=readFileSync("src/pages/admin/registry/artists/intake/page.tsx","utf8");
const CHART_ARTIST_INTAKE_EDGE=readFileSync("supabase/functions/artist-registry-intake/index.ts","utf8");
const TRACK_INTAKE_PAGE=readFileSync("src/pages/admin/registry/tracks/intake/page.tsx","utf8");
const ALIAS_PAGE=readFileSync("src/pages/admin/registry/artist-aliases/page.tsx","utf8");
const DUPLICATE_PAGE=readFileSync("src/pages/admin/relationships/duplicates/page.tsx","utf8");
const STUDIO_PAGE=readFileSync("src/pages/admin/charts/studio/page.tsx","utf8");
const MUSIC_ROW=readFileSync("src/components/admin/charts/StudioChartMusicRow.tsx","utf8");
const APPLE_META=readFileSync("src/services/chartsPrivate/appleCatalogReview.ts","utf8");
const PUBLIC_CHART_ROW=readFileSync("src/components/design-system/music/ChartRow.tsx","utf8");
const PUBLIC_CHART_DIRECTORY=readFileSync("src/pages/charts/directory/page.tsx","utf8");
const PUBLIC_CHART_MODELS=readFileSync("src/services/chartsPublic/viewModels.ts","utf8");
const PUBLIC_CHART_EDITION=readFileSync("src/pages/charts/edition/page.tsx","utf8");
const PLAYLIST_ROW=readFileSync("src/pages/playlists/detail/page.tsx","utf8");

const ROUTER=readFileSync("src/router/config.tsx","utf8");
const SHELL=readFileSync("src/pages/admin/AdminShell.tsx","utf8");

describe("Charts 2.0 Phase 2 private deterministic ordinal scoring",()=>{
  it("binds every unresolved position and blocks conflicts against the immutable source manifest",()=>{
    const receipts=fullReceipts();
    const snapshot={contract:"charts2-private-studio/v1",receipts,
      registry_links:[link("apple_ke",1,200),link("apple_ke",2,201),link("apple_ke",2,202,2)],
      observation_reviews:[]};
    const input=buildCharts2InvestigationInputV1(snapshot);
    expect(input.total_positions).toBe(600);
    expect(input.resolved_positions).toBe(1);
    expect(input.unresolved).toHaveLength(598);
    expect(input.conflicts).toHaveLength(1);
    expect(input.conflicts[0]).toMatchObject({source_key:"apple_ke",rank:2,disposition:"blocked"});
    const groups=bindRecordingInvestigationGroups(input);
    const all=groups.flatMap(group=>group.observations);
    expect(all).toHaveLength(599);
    expect(new Set(all.map(row=>[row.source_key,row.receipt_id,row.rank].join(":"))).size).toBe(599);
    expect(groups.filter(group=>group.disposition==="blocked")).toHaveLength(1);
    expect(groups.filter(group=>group.disposition==="blocked")[0].observations).toEqual(input.conflicts);
    expect(all.every(row=>row.original_sha256===receipts.find(r=>r.id===row.receipt_id)?.original_sha256)).toBe(true);
    expect(all.some(row=>row.source_key==="apple_ke"&&row.rank===1)).toBe(false);
    const changed=structuredClone(input);
    changed.unresolved[0].original_sha256="f".repeat(64);
    expect(()=>bindRecordingInvestigationGroups(changed)).toThrow("Invalid chart investigation receipt binding");
    const duplicated=structuredClone(input);
    duplicated.unresolved[0]={...duplicated.conflicts[0],disposition:"research"};
    expect(()=>bindRecordingInvestigationGroups(duplicated)).toThrow("Invalid chart investigation receipt binding");
    expect(()=>buildCharts2InvestigationInputV1({...snapshot,receipts:receipts.slice(0,4)})).toThrow();
    const partial=structuredClone(receipts);
    partial[0].observations.pop();partial[0].observed_depth--;partial[0].observed_status="partial_depth";
    expect(()=>buildCharts2InvestigationInputV1({...snapshot,receipts:partial}))
      .toThrow("charts2_investigation_requires_full_receipts");
    expect(input.can_publish).toBe(false);
    const db={contract:"charts2-private-freeze-preflight/v1",methodology_version:input.methodology_version,
      scoring_policy_version:input.scoring_policy_version,can_publish:false,input_sha256:"a".repeat(64),
      eligible_count:input.eligible_recordings,unresolved_count:input.unresolved.length,conflict_count:input.conflicts.length,
      source_receipts:input.sources,investigation_positions:[...input.unresolved,...input.conflicts].reverse()};
    expect(verifyCharts2InvestigationParityV1(input,db)).toBe(db.input_sha256);
    const changedPosition=structuredClone(db);
    changedPosition.investigation_positions[0].artist="Unverified Artist";
    expect(()=>verifyCharts2InvestigationParityV1(input,changedPosition)).toThrow("charts2_investigation_position_disagreement");
    const wrongDisposition=structuredClone(db);
    wrongDisposition.investigation_positions[0].disposition="research";
    expect(()=>verifyCharts2InvestigationParityV1(input,wrongDisposition)).toThrow("charts2_investigation_position_disagreement");
    const repeated=structuredClone(db);
    repeated.investigation_positions[0]=repeated.investigation_positions[1];
    expect(()=>verifyCharts2InvestigationParityV1(input,repeated)).toThrow("charts2_investigation_position_disagreement");
    const wrongReceipt=structuredClone(db);
    wrongReceipt.source_receipts[0].original_sha256="f".repeat(64);
    expect(()=>verifyCharts2InvestigationParityV1(input,wrongReceipt)).toThrow("charts2_investigation_receipt_disagreement");
    expect(()=>verifyCharts2InvestigationParityV1(input,{...db,eligible_count:2})).toThrow("charts2_investigation_score_disagreement");
  });

  it("routes exact admission through existing original verification and actor authority, not browser grouping",()=>{
    const prepare=STUDIO_WORKER.slice(STUDIO_WORKER.indexOf("async function prepareMiziziChartCandidates("),
      STUDIO_WORKER.indexOf("async function studioAction("));
    expect(prepare.indexOf("verifyPrivateOriginal(server,r)")).toBeLessThan(prepare.indexOf("buildCharts2InvestigationInputV1(snapshot)"));
    expect(prepare).toContain('server.rpc("mizizi_charts_candidate_input_v1")');
    expect(prepare).toContain("verifyCharts2InvestigationParityV1(input,gate.data)");
    expect(prepare).toContain("bindRecordingInvestigationGroups(input)");
    const action=STUDIO_WORKER.slice(STUDIO_WORKER.indexOf('if(mode==="studio_mizizi_prepare"||mode==="studio_mizizi_admit")'),
      STUDIO_WORKER.indexOf('if(mode==="studio_registry_discovery")'));
    expect(action).toContain('authClient.rpc("admin_mizizi_admit_chart_candidates_v1"');
    expect(action).toContain("p_groups:prepared.positions");
    expect(action).not.toContain("p_groups:supplied");
    expect(action).not.toContain('server.rpc("admin_mizizi_admit_chart_candidates_v1"');
    expect(action).toContain('supplied.expected_input_sha256!==prepared.summary.input_sha256');
    expect(action).toContain("receipt.jobs_dispatched!==0");
  });

  it("keeps the native Top 100 preview private and visible only through Studio",()=>{
    expect(STUDIO_WORKER).toMatch(/import\s*\{[^}]*\bbuildCharts2PrivateNativeReviewV1\b[^}]*\}\s*from\s*["']\.\.\/_shared\/charts2-private-native-review-v1\.mjs["']/);
    expect(STUDIO_WORKER).toContain('native_review=buildCharts2PrivateNativeReviewV1({receipts})');
    expect(STUDIO_WORKER).toContain('return {state:"private_review",preview,native_review');
    expect(STUDIO_WORKER).toContain('await Promise.all(receipts.map((r:any)=>verifyPrivateOriginal(server,r)))');
    expect(STUDIO_WORKER).toContain('charts2_private_freeze_score_disagreement');
    expect(STUDIO_WORKER).not.toContain('mode==="studio_native_publish"');
    expect(STUDIO_PAGE).toContain('Top 100 to Review');
    expect(STUDIO_PAGE).toContain('Across More Than One Chart');
    expect(STUDIO_PAGE).toContain('Apple Music Matches to Check');
    expect(STUDIO_PAGE).toContain('Show All Matches');
    expect(STUDIO_PAGE).toContain('Show All Titles');
    expect(STUDIO_PAGE).toContain('snapshot.native_review.multi_source_occurrences');
    expect(STUDIO_PAGE).toContain('snapshot.native_review.apple_title_review');
    expect(STUDIO_PAGE).toContain('StudioChartMusicRow');
    expect(STUDIO_PAGE).toContain('Find a song or artist');
    expect(STUDIO_PAGE).toContain('Multiple Charts');
    expect(STUDIO_PAGE).toContain('Check before combining songs.');
    expect(STUDIO_PAGE).toContain('loadVerifiedAppleChartSongs');
    expect(MUSIC_ROW).toContain('entry.contributions.map');
    expect(MUSIC_ROW).toContain('object-contain');
    expect(MUSIC_ROW).toContain('catalogSong?.durationMs');
    expect(MUSIC_ROW).toContain('catalogSong?.artist');
    expect(MUSIC_ROW).toContain('Chart Appearances');
    expect(MUSIC_ROW).not.toContain('playTrack(');
    expect(APPLE_META).toContain('/v1/catalog/ke/songs');
    expect(APPLE_META).toContain('normalizeTitle(attributes.name) !== normalizeTitle(wantedTitle)');
    expect(APPLE_META).toContain('validateWkArtworkUrl(');
    expect(APPLE_META).not.toContain('/search?term=');
    expect(APPLE_META).not.toContain('title.ilike');
    expect(APPLE_META).toContain('batch.map(([id]) => id).join(",")');
    expect(PUBLIC_CHART_ROW).toContain('object-contain');
    expect(PUBLIC_CHART_ROW).toContain('visibleDuration');
    expect(PUBLIC_CHART_DIRECTORY).toContain('object-contain');
    expect(PUBLIC_CHART_EDITION).toContain('chart-podium-v2-img object-contain');
    expect(PUBLIC_CHART_MODELS).toContain('duration: rich.duration,');
    expect(PUBLIC_CHART_MODELS).not.toContain('180 + ((entry.trackTitle.length * 7) % 120)');
    expect(STUDIO_PAGE).not.toContain('consumption_led_cultural_presence_v1 ·');
    expect(STUDIO_PAGE).toContain('Private review only. Nothing is published from this page.');
    expect(PLAYLIST_ROW).toContain('h-full w-full object-contain');
  });

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

  it("retains every provisional multi-source occurrence, without making Registry identity claims",()=>{
    const receipts=fullReceipts();
    receipts.find(r=>r.source_key==="apple_ke")!.observations.forEach(o=>{o.artist=null as any;});
    receipts.find(r=>r.source_key==="shazam_ke")!.observations.forEach(o=>{o.provider_track_id=null as any;});
    expect(score(receipts).candidates).toHaveLength(0);
    const review=buildCharts2PrivateNativeReviewV1({receipts});
    expect(review.contract).toBe("charts2-private-native-review/v1");
    expect(review.count).toBe(100);
    expect(review.candidate_count).toBe(200);
    expect(review.multi_source_occurrences).toHaveLength(100);
    expect(review.multi_source_by_count["4"]).toBe(100);
    expect(review.source_occurrences_in_groups).toBe(400);
    expect(review.entries[0].score_units).toBe(16000);
    expect(review.entries[0].source_count).toBe(4);
    expect(review.entries[0].score_points).toBe("80.00");
    expect(review.native_recording_ids.shazam_ke).toBe(0);
    expect(review.native_recording_ids.apple_ke).toBe(100);
    expect(review.apple_title_review).toHaveLength(100);
    expect(review.apple_title_review.every(x=>x.contributes_extra_score===false)).toBe(true);
    expect(review.can_publish).toBe(false);
    expect(review.freeze_ready).toBe(false);
    expect(review.review_required).toBe(true);
  });

  it("suggests alias-aware duplicates for governed bulk review without claiming identity",()=>{
    const rows=[
      {source_key:"youtube_ke",receipt_id:UUID(1),rank:14,
        title:"Mboka",artist:"Mejja Genge",provider_track_id:"youtube:mboka"},
      {source_key:"audiomack_ke",receipt_id:UUID(2),rank:25,
        title:"Mboka",artist:"Mejja",provider_track_id:"audiomack:mboka"},
      {source_key:"youtube_ke",receipt_id:UUID(1),rank:1,
        title:"I'll Be Okay",artist:"Bien",provider_track_id:"youtube:bien"},
      {source_key:"apple_ke",receipt_id:UUID(3),rank:1,
        title:"I’ll Be Okay",artist:null,provider_track_id:"apple:bien"},
      {source_key:"mdundo_ke",receipt_id:UUID(4),rank:38,
        title:"I’ll Be Okey",artist:"Bien",provider_track_id:"mdundo:bien"},
      {source_key:"shazam_ke",receipt_id:UUID(5),rank:5,
        title:"I'll Be Okay",artist:"Bien",provider_track_id:null},
      {source_key:"mdundo_ke",receipt_id:UUID(4),rank:26,
        title:"Mboka",artist:"Unrelated Artist",provider_track_id:"mdundo:unrelated"},
      {source_key:"mdundo_ke",receipt_id:UUID(4),rank:10,
        title:"Mboka (Live)",artist:"Mejja",provider_track_id:"mdundo:live"},
    ];
    const proposed=suggestRecordingReviewGroups(rows);
    expect(proposed).toHaveLength(2);
    const mboka=proposed.find(group=>group.title==="Mboka");
    expect(mboka?.observations).toHaveLength(2);
    expect(mboka?.reason).toContain("Check Artist Alias");
    expect(mboka?.observations.some(row=>row.artist==="Unrelated Artist")).toBe(false);
    expect(mboka?.observations.some(row=>row.title==="Mboka (Live)")).toBe(false);
    const bien=proposed.find(group=>group.title==="I'll Be Okay");
    expect(bien?.observations).toHaveLength(4);
    expect(bien?.observations.find(row=>row.source_key==="shazam_ke")?.provider_track_id).toBeNull();
    expect(bien?.reason).toContain("Check Similar Titles");
    const alias=suggestRecordingReviewGroups(rows,
      [{alias_slug:"mejja-genge",alias_display_name:"Mejja Genge",canonical_artist_id:UUID(99)}],
      [{id:UUID(99),display_name:"Mejja"}]);
    expect(alias.find(group=>group.title==="Mboka")?.reason).toContain("Known Artist Alias");
    // These are leads only. Source receipts and Registry scoring remain unchanged.
    expect(score(fullReceipts()).candidates).toHaveLength(0);
    expect(STUDIO_PAGE).toContain("Review Matches");
    expect(STUDIO_PAGE).toContain("Before You Approve");
    expect(STUDIO_PAGE).toContain("Manage Artist Aliases");
    expect(STUDIO_PAGE).toContain('noId?"studio_review_no_id":"studio_review_link"');
    expect(STUDIO_PAGE).toContain("Choose only one source position per recording");
    expect(STUDIO_PAGE).toContain("setBatchMode(true);setBatchRows([]);");
    expect(STUDIO_PAGE).toContain("old.filter(item=>item.source_key!==row.source_key)");
    expect(STUDIO_PAGE).toContain("if(accepted>0)");
    expect(STUDIO_PAGE).toContain("setBatchMode(false);setBatchRows([]);setSelected(null);");
    expect(STUDIO_PAGE).toContain("Artist not supplied");
    expect(STUDIO_PAGE).toContain('{selected&&<WkSurface role="region" aria-labelledby="studio-recording-review-title"');
    expect(STUDIO_PAGE).toContain("Official Apple catalogue artist:");
    expect(STUDIO_PAGE).toContain("Artist not supplied in original");
    expect(STUDIO_PAGE).toContain("No active Registry recording matches this search.");
    expect(STUDIO_PAGE).toContain("setRegistrySearchAttempted(true)");
    expect(STUDIO_PAGE).not.toContain("Open existing Registry track authority");
    expect(STUDIO_PAGE).not.toContain("xl:grid-cols-[minmax(0,1fr)_420px]");
    expect(STUDIO_WORKER).toContain('server.from("registry_track_artists").select("track_id")');
    expect(STUDIO_WORKER).toContain('server.from("registry_track_provider_links").select("track_id")');
    expect(REGISTRY_DISCOVERY_SHARED).toMatch(/server\.from\("registry_artist_aliases"\)\s*\.select\("canonical_artist_id,alias_display_name,alias_slug"\)\.eq\("status","active"\)/);
    expect(STUDIO_WORKER).toContain('server.from("registry_tracks").select("id").eq("status","active")');
    expect(REGISTRY_DISCOVERY_SHARED).toContain('artist_names:artists.get(track.id)??[]');
    expect(REGISTRY_DISCOVERY_SHARED).toContain('artist_credits:artistCredits.get(track.id)??[]');
    expect(REGISTRY_DISCOVERY_SHARED).toContain('String(row.match_method??"unknown")');
    expect(STUDIO_PAGE).toContain('Other credited Artists:');
    expect(STUDIO_PAGE).toContain('Existing provider links (method, not proof):');
    expect(STUDIO_WORKER).not.toContain('mode==="studio_auto_admit"');
  });

  it("keeps artistless title observations from merging unrelated recording identities",()=>{
    const rows=[
      {source_key:"youtube_ke",receipt_id:UUID(1),rank:1,
        title:"Homebound",artist:"Artist A",provider_track_id:"youtube:a"},
      {source_key:"mdundo_ke",receipt_id:UUID(2),rank:2,
        title:"Homebound",artist:"Artist A",provider_track_id:"mdundo:a"},
      {source_key:"audiomack_ke",receipt_id:UUID(3),rank:3,
        title:"Homebound",artist:"Artist B",provider_track_id:"audiomack:b"},
      {source_key:"shazam_ke",receipt_id:UUID(4),rank:4,
        title:"Homebound",artist:"Artist B",provider_track_id:null},
      {source_key:"apple_ke",receipt_id:UUID(5),rank:5,
        title:"Homebound",artist:null,provider_track_id:"apple:unknown"},
    ];
    const leads=suggestRecordingReviewGroups(rows);
    expect(leads).toHaveLength(2);
    expect(leads.every(g=>g.observations.length===2)).toBe(true);
    expect(leads.every(g=>g.observations.every(row=>row.artist!==null))).toBe(true);
    expect(leads.flatMap(g=>g.observations).some(row=>row.source_key==="apple_ke")).toBe(false);
    // An unidentified artist cannot form a group from title alone.
    expect(suggestRecordingReviewGroups(rows.filter(row=>row.artist===null)))
      .toHaveLength(0);
    // MIZIZI needs complete workload coverage without inventing a match.
    const workload=buildRecordingInvestigationGroups(rows);
    expect(workload.map(group=>group.observations.length)).toEqual([2,2,1]);
    expect(workload.flatMap(group=>group.observations)).toHaveLength(rows.length);
    expect(workload.find(group=>group.observations.length===1)?.observations)
      .toEqual([rows[4]]);
    expect(buildRecordingInvestigationGroups([...rows].reverse())).toEqual(workload);
    expect(buildRecordingInvestigationGroups([])).toEqual([]);
    expect(()=>buildRecordingInvestigationGroups([...rows,{...rows[0],title:"Conflicting payload"}]))
      .toThrow("Duplicate chart investigation coordinate");
    expect(()=>buildRecordingInvestigationGroups([{...rows[0],rank:0}]))
      .toThrow("Invalid chart investigation coordinate");
    expect(rows[4].artist).toBeNull();
  });

  it("does not chain two same-source positions through a third chart",()=>{
    const rows=[
      {source_key:"youtube_ke",receipt_id:UUID(1),rank:8,
        title:"Mboka",artist:"Mejja",provider_track_id:"yt:one"},
      {source_key:"youtube_ke",receipt_id:UUID(1),rank:42,
        title:"Mboka",artist:"Mejja Genge",provider_track_id:"yt:two"},
      {source_key:"audiomack_ke",receipt_id:UUID(2),rank:11,
        title:"Mboka",artist:"Mejja",provider_track_id:"am:one"},
      {source_key:"apple_ke",receipt_id:UUID(3),rank:18,
        title:"Mboka",artist:null,provider_track_id:"apple:one"},
    ];
    const groups=suggestRecordingReviewGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].observations.filter(row=>row.source_key==="youtube_ke")).toHaveLength(1);
    expect(groups[0].observations.map(row=>row.source_key).sort())
      .toEqual(["apple_ke","audiomack_ke","youtube_ke"]);
    expect(groups[0].observations.find(row=>row.source_key==="youtube_ke")?.rank).toBe(8);
    const workload=buildRecordingInvestigationGroups(rows);
    expect(workload.flatMap(group=>group.observations)).toHaveLength(rows.length);
    expect(workload.every(group=>new Set(group.observations.map(row=>row.source_key)).size
      ===group.observations.length)).toBe(true);
    expect(buildRecordingInvestigationGroups([...rows].reverse())).toEqual(workload);
  });

  it("quarantines duplicate native IDs, incomplete receipts, and repeated same-source labels",()=>{
    const fixtures=fullReceipts();
    fixtures.find(r=>r.source_key==="shazam_ke")!.observations.forEach(o=>{o.provider_track_id=null as any;});
    const duplicate=structuredClone(fixtures);
    duplicate[0].observations[1].provider_track_id=duplicate[0].observations[0].provider_track_id;
    expect(()=>buildCharts2PrivateNativeReviewV1({receipts:duplicate}))
      .toThrow("charts2_native_review_duplicate_provider_recording");
    const partial=structuredClone(fixtures);
    partial[0].observed_status="partial_depth";
    expect(()=>buildCharts2PrivateNativeReviewV1({receipts:partial}))
      .toThrow("charts2_scoring_unqualified_receipt");
    const repeated=structuredClone(fixtures);
    repeated[0].observations[1].title=repeated[0].observations[0].title;
    const review=buildCharts2PrivateNativeReviewV1({receipts:repeated});
    expect(review.ambiguous_source_labels).toBe(2);
    expect(review.multi_source_occurrences).toHaveLength(100);
    expect(review.multi_source_occurrences.find(x=>x.title==="Unresolved recording 1")?.source_count)
      .toBe(3);
    expect(review.can_publish).toBe(false);
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

  it("scores exact reviewed Shazam positions with genuine missing provider IDs",()=>{
    const receipts=fullReceipts();
    const shazam=receipts.find(r=>r.source_key==="shazam_ke")!;
    shazam.observations.forEach(o=>{o.provider_track_id=null as any;});
    const review={
      id:UUID(501),source_key:"shazam_ke",receipt_id:shazam.id,
      original_sha256:shazam.original_sha256,rank:3,
      title:shazam.observations[2].title,artist:shazam.observations[2].artist,
      provider_track_id:null,track_id:UUID(900),track_status:"active",
      action:"approve",
      review_note:"I independently verified the same Shazam chart position against canonical recording and release evidence.",
      evidence_url:"https://example.com/canonical-release-evidence",
      event_fingerprint:"a".repeat(64),
    };
    const only=scoreCharts2PrivatePreviewV1({receipts,observation_reviews:[review]});
    expect(only.candidates).toHaveLength(1);
    expect(only.candidates[0].track_id).toBe(UUID(900));
    expect(only.candidates[0].source_count).toBe(1);
    expect(only.candidates[0].score_points).toBe("9.90");
    expect(only.candidates[0].source_contributions[0].registry_observation_resolution_id)
      .toBe(review.id);
    expect(only.candidates[0].source_contributions[0].registry_provider_link_id)
      .toBeUndefined();
    expect(only.unresolved).toHaveLength(599);
    const withProvider=scoreCharts2PrivatePreviewV1({
      receipts,registry_links:[link("youtube_ke",1,900)],observation_reviews:[review],
    });
    expect(withProvider.candidates.find(c=>c.track_id===UUID(900))?.score_points)
      .toBe("39.90");
    for(const [key, value] of [
      ["original_sha256","f".repeat(64)],
      ["title","Wrong title"],["artist","Unrelated Artist"],
      ["track_status","archived"],["review_note","Not independently verified"],
      ["evidence_url","http://untrusted.example"],["event_fingerprint","invalid"],
    ] as const){
      const invalid=scoreCharts2PrivatePreviewV1({receipts,observation_reviews:[
        {...review,[key]:value},
      ]});
      expect(invalid.candidates).toHaveLength(0);
    }
    const revoked=scoreCharts2PrivatePreviewV1({receipts,observation_reviews:[
      {...review,action:"revoke",track_id:null},
    ]});
    expect(revoked.candidates).toHaveLength(0);
    expect(()=>scoreCharts2PrivatePreviewV1({receipts,observation_reviews:[review,review]}))
      .toThrow("charts2_scoring_observation_review_conflict");
    expect(()=>scoreCharts2PrivatePreviewV1({receipts,observation_reviews:[
      {...review,provider_track_id:"invented"},
    ]})).toThrow("charts2_scoring_observation_review_unqualified");
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

  it("stages exact selected intake references independently and stops on uncertain failure",async()=>{
    const first={source_key:"youtube_ke" as const,receipt_id:UUID(1),original_sha256:"a".repeat(64),rank:1};
    const second={...first,rank:2}, third={...first,rank:3};
    const calls:number[]=[];
    const stage=async(ref:{rank:number})=>{
      calls.push(ref.rank);
      if(ref.rank===2)throw Error("denied");
      return {suggestion_id:UUID(ref.rank+10)};
    };
    const results=await prepareChartTrackIntakes([first,second,third],stage,()=>{});
    expect(calls).toEqual([1,2]);
    expect(results.map(r=>[r.suggestionId,r.error])).toEqual([[UUID(11),null],[null,"denied"]]);
    await expect(prepareChartTrackIntakes([first,first],stage,()=>{})).rejects.toThrow("Duplicate");
    await expect(prepareChartTrackIntakes([{...first,rank:101}],stage,()=>{})).rejects.toThrow();
    expect(calls).toEqual([1,2]);
    const retry=await prepareChartTrackIntakes([second,third],async ref=>({suggestion_id:UUID(ref.rank+10)}),()=>{});
    expect(retry.map(r=>r.suggestionId)).toEqual([UUID(12),UUID(13)]);
    expect(STUDIO_PAGE).toContain('invokeStudio("studio_stage_intake"');

    // Navigation is a bounded selection, not a stored review decision.
    const batch=[first,second,third];
    const destination=appendChartIntakeBatch(
      appendChartReviewReference("/admin/registry/tracks/intake?suggestion="+UUID(11),first),batch,
    );
    const params=new URLSearchParams(destination.split("?")[1]);
    expect(parseChartIntakeBatch(params)).toEqual(batch);
    expect(parseChartReviewReference(params)).toEqual(first);
    const back=chartStudioReturnHref(first,parseChartIntakeBatch(params));
    expect(parseChartIntakeBatch(new URLSearchParams(back.split("?")[1]))).toEqual(batch);
    expect(back).not.toContain("suggestion");
    expect(back).not.toContain("consent");
    expect(parseChartIntakeBatch(writeChartIntakeBatch(params,[]))).toEqual([]);
    expect(()=>writeChartIntakeBatch(params,[first,first])).toThrow();
    expect(()=>writeChartIntakeBatch(params,[first,{...first,original_sha256:"b".repeat(64)}])).toThrow();
    const malformed=new URLSearchParams(params);
    malformed.append("chart_batch","fake:invalid:1:"+"a".repeat(64));
    expect(parseChartIntakeBatch(malformed)).toEqual([]);
    const oversized=new URLSearchParams();
    for(let i=0;i<11;i++)oversized.append("chart_batch","youtube_ke:"+UUID(1)+":"+(i+1)+":"+"a".repeat(64));
    expect(parseChartIntakeBatch(oversized)).toEqual([]);
    expect(STUDIO_PAGE).toContain("startGovernedArtistIntake(ref,row.artist)");
    expect(STUDIO_PAGE).toContain("currentIntakeRow(ref)");
  });
  it("requires exact returned Apple song evidence and separates search failure from zero results",()=>{
    const song={id:"1234567890",type:"songs",attributes:{name:"I'll Be Okay"}};
    expect(matchesOriginalAppleChartSong(song.id,"I’ll Be Okay",{data:[song]})).toBe(true);
    expect(matchesOriginalAppleChartSong(song.id,"Different title",{data:[song]})).toBe(false);
    expect(matchesOriginalAppleChartSong(song.id,"I'll Be Okay",{data:[{...song,id:"1234567891"}]})).toBe(false);
    expect(matchesOriginalAppleChartSong(song.id,"I'll Be Okay",{data:[{...song,type:"albums"}]})).toBe(false);
    expect(matchesOriginalAppleChartSong(song.id,"I'll Be Okay",{data:[song,song]})).toBe(false);
    expect(matchesOriginalAppleChartSong(song.id,"I'll Be Okay",{data:[]})).toBe(false);
    expect(matchesOriginalAppleChartSong(song.id,"I'll Be Okay",null)).toBe(false);
    expect(matchesOriginalAppleChartSong("bad/id","I'll Be Okay",{data:[song]})).toBe(false);
    expect(matchesOriginalAppleChartSong(song.id,"!",{data:[{...song,attributes:{name:"!"}}]})).toBe(false);
    const search=TRACK_INTAKE_PAGE.slice(TRACK_INTAKE_PAGE.indexOf("async function searchTracks("),
      TRACK_INTAKE_PAGE.indexOf("function artistCreditKey("));
    const failure=search.slice(search.indexOf("} catch (reason)"));
    expect(failure).toContain("setTrackSearchAttempted");
    expect(failure).toContain("[suggestionId]: false");
    expect(failure).toContain("setTrackSearchFailed");
    expect(TRACK_INTAKE_PAGE).toContain("!trackSearchFailed[suggestionId] &&");
    expect(TRACK_INTAKE_PAGE).toContain("!trackSearchAttempted[suggestionId] ||");
    expect(TRACK_INTAKE_PAGE).toContain("matchesOriginalAppleChartSong(hit.providerEntityId, row.provider_title");
    expect(TRACK_INTAKE_PAGE).toContain("Inspect Original Apple Song");
  });
  it("passes only exact immutable chart observation coordinates to Registry workspaces",()=>{
    const item={
      source_key:"youtube_ke" as const,
      receipt_id:UUID(1),original_sha256:"a".repeat(64),rank:14,
    };
    expect(isChartReviewReference(item)).toBe(true);
    const href=appendChartReviewReference("/admin/registry/tracks/intake",item);
    const params=new URLSearchParams(href.split("?")[1]);
    expect(parseChartReviewReference(params)).toEqual(item);
    expect(chartStudioReturnHref(item)).toContain("tab=review");
    expect(chartStudioReturnHref(item)).toContain("chart_rank=14");
    expect(()=>appendChartReviewReference("https://example.com",item)).toThrow();
    expect(()=>appendChartReviewReference("/admin/evil",{
      ...item,original_sha256:"not-a-sha",
    })).toThrow();
    expect(parseChartReviewReference(new URLSearchParams("chart_source=shazam_ke&chart_rank=201"+
      "&chart_receipt="+UUID(1)+"&chart_sha="+"a".repeat(64)))).toBeNull();
    expect(CHART_REVIEW_REF).not.toContain("service_role");
    expect(CHART_RETURN).toContain("studio_review_context");
    expect(CHART_RETURN).toContain("item.original_sha256!==reference.original_sha256");
    expect(STUDIO_WORKER).toContain('mode==="studio_review_context"');
    expect(STUDIO_WORKER).toContain('await verifyPrivateOriginal(server,receipt)');
    expect(STUDIO_WORKER).toContain('"charts2_review_context_receipt_changed"');
    expect(STUDIO_WORKER).toContain('"charts2_review_context_position_changed"');
    expect(STUDIO_PAGE).toContain('"/admin/registry/tracks/intake?suggestion="+id');
    expect(STUDIO_PAGE).toContain('appendChartReviewReference("/admin/registry/artist-aliases"');
    expect(STUDIO_PAGE).toContain('appendChartReviewReference("/admin/relationships/duplicates"');
    expect(STUDIO_PAGE).toContain('startGovernedArtistIntake');
    expect(STUDIO_PAGE).toContain('studio_stage_artist_intake');
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('chartRunId');
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('<ChartReviewReturnContext />');
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('loadResults(initialChartRun.current,"no_match")');
    expect(CHART_ARTIST_INTAKE_EDGE).toContain('charts2_chart_observation');
    expect(CHART_ARTIST_INTAKE_EDGE).toContain('chart_artist_claim_only!==true');
    expect(CHART_ARTIST_INTAKE_SQL).toContain('admin_stage_charts2_artist_intake_v1');
    expect(CHART_ARTIST_INTAKE_SQL).toContain('registry_artist_intake_review_snapshot_v1');
    expect(CHART_ARTIST_INTAKE_SQL).toContain('registry_artist_intake_review_fingerprint_v1');
    expect(CHART_ARTIST_INTAKE_SQL).toContain('admin_review_registry_artist_intake_v1');
    expect(CHART_ARTIST_INTAKE_SQL).toContain('platform_private.assert_charts2_artist_intake_receipt_v1');
    expect(CHART_ARTIST_INTAKE_SQL).toContain("source_origin_iso2");
    expect(CHART_ARTIST_INTAKE_SQL).toContain("'charts2_chart_observation'");
    expect(CHART_ALIAS_REVIEW).toContain('admin_set_registry_artist_alias_v1');
    expect(CHART_ALIAS_REVIEW).toContain('may also correct existing public chart Artist references');
    expect(DUPLICATE_PAGE).toContain('track.id,');
    expect(DUPLICATE_PAGE).toContain('urlParams.get("chart_track")');
    expect(STUDIO_PAGE).toContain('source.original_sha256===returnContext.original_sha256');
    expect(TRACK_INTAKE_PAGE).toContain("<ChartReviewReturnContext />");
    expect(ALIAS_PAGE).toContain('<ChartReviewReturnContext consequence="artist_alias" />');
    expect(DUPLICATE_PAGE).toContain('<ChartReviewReturnContext consequence="track_duplicate" />');
    expect(CHART_RETURN).toContain("may also update existing public chart artist references");
    expect(CHART_RETURN).toContain("can move public chart rows");
    // This handoff does not claim to create intake records or auto-approve.
    expect(CHART_RETURN).not.toContain('admin_create_registry_track_intake_identity_v1');
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
    expect(STUDIO_WORKER).toContain('verifyCharts2OriginalBytesV1(receipt,bytes)');
    expect(STUDIO_WORKER).toContain('authClient.rpc("admin_admit_registry_track_provider_link_v1"');
    expect(STUDIO_WORKER).not.toContain('server.rpc("admin_admit_registry_track_provider_link_v1"');
    expect(STUDIO_WORKER).toContain('mode==="studio_review_no_id"');
    expect(STUDIO_WORKER).toContain('authClient.rpc("admin_review_charts2_no_id_observation_v1"');
    expect(STUDIO_WORKER).toContain('p_expected_previous_event_id:previous?.id??null');
    expect(STUDIO_WORKER).toContain('observation_reviews:snapshot.observation_reviews??[]');
    expect(STUDIO_WORKER).toContain('p_action:action');
    expect(STUDIO_WORKER).toContain('p_track_id:action==="revoke"?null:supplied.track_id');
    expect(STUDIO_PAGE).toContain('currentShazamReviews');
    expect(STUDIO_PAGE).toContain('Revoke This Shazam Resolution');
    expect(STUDIO_PAGE).toContain('SHAZAM_REVOKE_DECLARATION');
    expect(STUDIO_WORKER).not.toContain('server.rpc("admin_review_charts2_no_id_observation_v1"');
    expect(STUDIO_WORKER).toContain("observation_reviews:snapshot.observation_reviews??[]");
    expect(STUDIO_PAGE).toContain('SHAZAM_DECLARATION');
    expect(STUDIO_PAGE).toContain('noId?"studio_review_no_id":"studio_review_link"');
    expect(STUDIO_PAGE).toContain('"Review Shazam Position"');
    expect(PUBLIC_CHART_MODELS).not.toContain('registry_observation_resolution_id');
    const offlineBridge=readFileSync("supabase/functions/_shared/charts2-publication-bridge-v1.mjs","utf8");
    expect(offlineBridge).toContain("registry_observation_resolution_id");
    expect(offlineBridge).toContain("c.registry_provider_link_id == null");
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

  it("keeps Shazam no-ID SQL review decisions append-only and independently audited",()=>{
    const proposed=readFileSync("docs/engineering/charts2-no-id-observation-resolution-proposed-sql-v1.sql","utf8");
    const intake=readFileSync("docs/engineering/charts2-chart-origin-intake-proposed-sql-v1.sql","utf8");
    expect(proposed).toContain("platform_private.charts2_observation_review_events_v1");
    expect(proposed).toContain("before update or delete");
    expect(proposed).toContain("admin_review_charts2_no_id_observation_v1");
    expect(proposed).toContain("reviewer_id uuid not null");
    expect(proposed).toContain("p_expected_previous_event_id");
    expect(proposed).toContain("v_prev.action=p_action");
    expect(proposed).toContain("default 'shazam_ke'");
    expect(proposed).toContain("registry_observation_resolution_id");
    expect(proposed).toContain("review_policy','exact_manual_receipt_plus_shazam_v1'");
    expect(proposed).toContain("I revoke this exact private Shazam recording resolution");
    expect(intake).toContain("registry_provider_track_suggestions_chart_origin_evidence_check");
    expect(intake).toContain("public.admin_stage_charts2_track_intake_v1");
    expect(intake).toContain("insert into public.registry_provider_track_suggestion_artists(");
    expect(intake).toContain("v_item.id,1,'unresolved','unresolved',null,v_artist");
    expect(intake).toContain("admin_append_charts2_track_intake_credit_v1");
    expect(intake).toContain("chart_review_evidence");
    expect(intake).toContain("perform platform_private.assert_charts2_intake_receipt_v1(p_suggestion_id)");
    expect(TRACK_INTAKE_PAGE).toContain('row.intake_origin==="chart_studio"');
    expect(TRACK_INTAKE_PAGE).toContain('"admin_append_charts2_track_intake_credit_v1"');
    expect(TRACK_INTAKE_PAGE).toContain("Add Unresolved Credit");
    expect(TRACK_INTAKE_PAGE).toContain("Choose whether this artist is Primary or Featured.");
    expect(intake).toContain("platform_private.assert_charts2_intake_receipt_v1");
    expect(intake).toContain("order by newest.created_at desc,newest.id desc");
    expect(intake).toContain("'public_contribution','artist_submission','chart_studio'");
    expect(intake).not.toContain("insert into public.registry_tracks");
    expect(intake).not.toContain("insert into public.wk_chart_entries_v2");
    expect(proposed).not.toContain("insert into public.registry_track_provider_links");
    expect(proposed).not.toContain("insert into public.wk_chart_entries_v2");
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
    const official=clone();
    for(const sourceReceipts of [official.freeze.source_receipts,official.preflight.source_receipts]){
      sourceReceipts[0].native_period_authority=YOUTUBE_EXPORT_PERIOD_AUTHORITY;
    }
    const officialProjection=inspectCharts2FrozenEditionProjectionV1(official);
    expect(officialProjection.can_stage).toBe(false);
    expect(officialProjection.can_publish).toBe(false);
    official.freeze.source_receipts[0].provider_week_ending_date="2026-11-11";
    official.preflight.source_receipts[0].provider_week_ending_date="2026-11-11";
    expect(()=>inspectCharts2FrozenEditionProjectionV1(official)).toThrow("charts2_bridge_native_youtube_period_missing");
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


describe("Charts2 official YouTube CSV and partial source health",()=>{
  // Synthetic format fixture only. Never commit an actual provider export.
  const header="Rank,Previous Rank,Track Name,Artist Names,Periods on Chart,Views,Growth,YouTube URL";
  const records=Array.from({length:100},(_,i)=>{
    const n=i+1,id=String(n).padStart(11,"0");
    return [n,n,"Synthetic Track "+n,"Synthetic Artist",1,1000-n,"0%", "https://www.youtube.com/watch?v="+id].join(",");
  });
  const csv=[header,...records].join("\n")+"\n";
  const period="weekly:20261113:20261119:ke";
  const observed_at="2026-11-24T15:00:00.000Z";
  const access={endpoint:YOUTUBE_EXPORT_ENDPOINT,observed_at,acknowledgement:YOUTUBE_EXPORT_ACK};
  const parse=(raw=csv,target=period,ctx=access)=>parseYouTubeKenyaOfficialExport(raw,target,ctx);
  const input={
    source_key:"youtube_ke",endpoint:YOUTUBE_EXPORT_ENDPOINT,observed_at,
    target_period_key:period,original_bytes:new TextEncoder().encode(csv),
    capture_mode:YOUTUBE_EXPORT_MODE,operator_export_acknowledgement:YOUTUBE_EXPORT_ACK,
  };
  it("retains exact bytes and distinguishes operator-confirmed dates from embedded native dates",async()=>{
    const result=await decodeCharts2Original(input);
    expect(result.rows).toHaveLength(100);
    expect(result.rows[0]).toMatchObject({rank:1,provider_track_id:"00000000001",view_count:999});
    expect(result.provider_week_ending_date).toBe("2026-11-19");
    expect(result.native_period_authority).toBe(YOUTUBE_EXPORT_PERIOD_AUTHORITY);
    expect(result.payload_sha256).toBe(createHash("sha256").update(input.original_bytes).digest("hex"));
    expect(result.can_score).toBe(false);
    expect(result.can_publish).toBe(false);
    expect(result.source_access_authorized).toBe(false);
    expect(parse("\ufeff"+csv.replaceAll("\n","\r\n")).rows).toHaveLength(100);
    expect(parse(csv.replace("Synthetic Track 1,","\"Track, \"\"Mix\"\"\",")).rows[0].title).toBe('Track, "Mix"');
    await expect(decodeCharts2Original({...input,capture_mode:null,operator_export_acknowledgement:null}))
      .rejects.toThrow("charts2_source_endpoint_unreviewed");
    await expect(decodeCharts2Original({...input,source_key:"shazam_ke"}))
      .rejects.toThrow("charts2_source_endpoint_unreviewed");
  });
  it("rejects incomplete, malformed, contradictory, cross-market and unattested exports",()=>{
    for(const bad of [
      [header,...records.slice(0,99)].join("\n"),
      [header,...records,records[99]].join("\n"),
      csv.replace(/^2,2,/m,"1,2,"),
      csv.replace("00000000002","00000000001"),
      csv.replace(",999,",",-1,"),
      csv.replace(",998,",",999999,"),
      csv.replace("www.youtube.com","www.example.com"),
      csv.replace("00000000001\n","00000000001&x=1\n"),
      csv.replace("Track Name","Song"),
      csv.replace("Synthetic Track 1,","\"unclosed,"),
    ])expect(()=>parse(bad)).toThrow("charts2_youtube_export_");
    for(const bad of ["weekly:20261113:20261119:us","weekly:20261112:20261119:ke",
      "weekly:20261120:20261126:ke","weekly:20261131:20261207:ke"])
      expect(()=>parse(csv,bad)).toThrow("charts2_youtube_export_period_invalid");
    expect(()=>parse(csv,period,{...access,acknowledgement:""})).toThrow("charts2_youtube_export_attestation_required");
    expect(()=>parse(csv,period,{...access,endpoint:"https://example.com"})).toThrow("charts2_youtube_export_attestation_required");
  });
  it("uses the same receipt coverage for 0, 1, 4 and 5 originals without partial scoring",()=>{
    const receipts:any[]=fullReceipts();
    for(const size of [0,1,4,5]){
      const coverage=summarizeCharts2SourceCoverageV1(receipts.slice(0,size));
      expect(coverage).toHaveLength(size);
      expect(coverage.reduce((n,row)=>n+row.observed_depth,0))
        .toBe(receipts.slice(0,size).reduce((n,row)=>n+row.observed_depth,0));
      if(size<5)expect(()=>score(receipts.slice(0,size))).toThrow("charts2_scoring_receipt_set_incomplete");
    }
    expect(()=>summarizeCharts2SourceCoverageV1([receipts[0],receipts[0]]))
      .toThrow("charts2_scoring_duplicate_source_receipt");
    expect(STUDIO_WORKER).toContain("summarizeCharts2SourceCoverageV1(receipts)");
    expect(STUDIO_PAGE).toContain("preview?.source_coverage??snapshot?.source_coverage??[]");
  });
  it("accepts only the bounded official export mode into private identity review, not generic research uploads",()=>{
    const receipts:any[]=fullReceipts();
    const y=receipts[0];
    Object.assign(y,{
      capture_mode:YOUTUBE_EXPORT_MODE,source_endpoint:YOUTUBE_EXPORT_ENDPOINT,
      method_revision:null,original_content_type:"text/csv",
      parser_version:YOUTUBE_EXPORT_PARSER_VERSION,
      original_object_key:y.original_object_key.replace(/\.json$/,".csv"),
      native_period_authority:YOUTUBE_EXPORT_PERIOD_AUTHORITY,
      provider_week_ending_date:"2026-11-19",observed_at,
      original_verified_at:"2026-11-24T15:01:00.000Z",provider_updated_at:null,
      observations:parse().rows,
    });
    const result=score(receipts);
    expect(result.source_coverage).toHaveLength(5);
    expect(result.source_coverage.reduce((n,row)=>n+row.observed_depth,0)).toBe(600);
    expect(result.unresolved).toHaveLength(600);
    expect(result.candidates).toHaveLength(0);
    expect(result.can_publish).toBe(false);
    expect(result.source_coverage.find(row=>row.source_key==="youtube_ke")?.native_period_authority)
      .toBe(YOUTUBE_EXPORT_PERIOD_AUTHORITY);
    for(const changes of [
      {capture_mode:"research_original_upload"},
      {source_endpoint:"https://charts.youtube.com/youtubei/v1/browse?alt=json"},
      {method_revision:1},{original_content_type:"application/json"},
      {parser_version:"charts2-source-parsers-v1"},
      {native_period_authority:"provider_declared_end_date"},
      {provider_week_ending_date:"2026-11-18"},
      {provider_week_ending_date:"2026-11-26"},
      {original_object_key:y.original_object_key.replace(/\.csv$/,".json")},
      {observations:y.observations.slice(0,99),observed_depth:99,observed_status:"partial_depth"},
    ])expect(()=>score([{...y,...changes},...receipts.slice(1)])).toThrow();
    const wrong=structuredClone(receipts);
    wrong[0].observations[0].provider_track_id="unverified";
    expect(()=>score(wrong)).toThrow("charts2_scoring_youtube_export_rows_unqualified");
    expect(STUDIO_WORKER).toContain("charts2_youtube_export_digest_mismatch");
    expect(STUDIO_WORKER).toContain("official_export_not_collector_admitted");
    expect(STUDIO_PAGE).toContain('invokeStudio("upload_official_youtube_export",form)');
    expect(STUDIO_PAGE).toContain('YOUTUBE_EXPORT_ACK');
  });
});

// Keep chart-origin intake distinct from legacy Playlist provenance.
describe("Chart-origin Track Intake presentation",()=>{
  it("renders a distinct chart observation branch before the Playlist fallback",()=>{
    expect(TRACK_INTAKE_PAGE).toContain('const isChartOrigin = row.intake_origin === "chart_studio"');
    const origin=TRACK_INTAKE_PAGE.match(/\) : isChartOrigin \? \(([\s\S]*?)\) : \(\s*<div className="grid gap-3 md:grid-cols-2">[\s\S]*?Originating Playlist/);
    expect(origin?.[1]).toContain("Chart source observation");
    expect(origin?.[1]).toContain("row.provider_object_id");
    expect(origin?.[1]).not.toContain("row.playlist_id");
    expect(origin?.[1]).not.toContain("/admin/content/playlists/");
  });
});


describe("Charts 2 existing Registry candidate discovery",()=>{
  const position=(source_key:string,rank:number,title:string,artist:string|null,provider_track_id:string|null)=>({
    source_key,receipt_id:UUID(rank),rank,title,artist,provider_track_id,reason:"registry_authoritative_link_missing",
  });
  const track=(i:number,title:string,status="active",name="Ywaya Tajiri",alias_names:string[]=[])=>({
    id:UUID(i),title,status,artist_credits:[{canonical_name:name,artist_status:"active",alias_names}],
  });
  it("groups real source coordinates for one active candidate, excludes archived duplicate and preserves no-ID/null originals",()=>{
    const rows=[
      position("youtube_ke",9,"Chai ya saa kumi","Ywaya Tajiri","video"),
      position("apple_ke",15,"Chai ya saa kumi",null,"6796900642"),
      position("audiomack_ke",16,"Chai ya saa kumi","Ywaya Tajiri","101662128"),
      position("shazam_ke",52,"Chai ya saa kumi","Ywaya Tajiri",null),
    ];
    const result=buildCharts2RegistryDiscoveryV1({unresolved:rows,tracks:[
      track(100,"Chai ya saa kumi","archived"),track(101,"Chai ya saa kumi"),
    ]});
    expect(result).toMatchObject({candidate_only:true,can_publish:false,unique_positions:4,ambiguous_positions:0,unmatched_positions:0});
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].track.id).toBe(UUID(101));
    expect(result.groups[0].positions).toEqual(rows.map((row,i)=>({...row,candidate_count:1,
      credit_evidence:i===1?"artist_not_supplied":"artist_credit_agrees"})));
  });
  it("retains separate ambiguous identities and never promotes title-only or inactive credit evidence",()=>{
    const rows=[position("youtube_ke",1,"Finale","Bien","video"),
      position("apple_ke",2,"Not in Registry",null,"123")];
    const second=track(102,"Finale","active","Bien");
    second.artist_credits[0].artist_status="draft";
    const result=buildCharts2RegistryDiscoveryV1({unresolved:rows,tracks:[track(101,"Finale","active","Other Artist"),second]});
    expect(result).toMatchObject({unique_positions:0,ambiguous_positions:1,unmatched_positions:1,candidate_only:true});
    expect(result.groups).toHaveLength(2);
    expect(result.groups.every(group=>group.positions[0].candidate_count===2&&
      group.positions[0].credit_evidence==="artist_credit_unconfirmed")).toBe(true);
  });
  it("uses accepted active aliases as credit corroboration, not approval",()=>{
    const row=position("youtube_ke",14,"Mboka","Mejja Genge","VZ1b6gF8DsU");
    const result=buildCharts2RegistryDiscoveryV1({unresolved:[row],tracks:[track(100,"Mboka","active","Mejja",["Mejja Genge"])]});
    expect(result.groups[0].positions[0]).toMatchObject({credit_evidence:"artist_credit_agrees",provider_track_id:row.provider_track_id,candidate_count:1});
    expect(result.candidate_only).toBe(true);
    expect(result.can_publish).toBe(false);
  });
  it("does not return positions outside the unresolved input and fails on candidate bounds",()=>{
    const result=buildCharts2RegistryDiscoveryV1({unresolved:[],tracks:[track(100,"Mboka")]});
    expect(result.groups).toEqual([]);
    expect(()=>buildCharts2RegistryDiscoveryV1({unresolved:[],tracks:Array.from({length:301},(_,i)=>track(i,"Mboka"))})).toThrow("charts2_registry_discovery_input_bounds");
  });
  it("keeps the discovery transport read-only, receipt-verified, capability-gated and explicit in the review",()=>{
    const start=STUDIO_WORKER.indexOf('if(mode==="studio_registry_discovery")');
    const end=STUDIO_WORKER.indexOf('if(mode==="studio_preview")',start);
    const lane=STUDIO_WORKER.slice(start,end);
    expect(lane).toContain("await requireRegistryReviewer(authClient)");
    expect(lane).toContain("verifyPrivateOriginal(server,r)");
    expect(lane).toContain("preview.unresolved");
    expect(lane).toContain('readCharts2RegistryDiscoveryV1(server,preview.unresolved)');
    expect(REGISTRY_DISCOVERY_SHARED).toContain('charts2_registry_discovery_catalogue_bound');
    const sharedRead=REGISTRY_DISCOVERY_SHARED.slice(
      REGISTRY_DISCOVERY_SHARED.indexOf("export async function readCharts2RegistryTracksV1("),
      REGISTRY_DISCOVERY_SHARED.indexOf("// Server-side read-only admission input."));
    expect(sharedRead).not.toMatch(/\.(insert|upsert|update|delete)\(/);
    expect(lane).not.toMatch(/\.(insert|upsert|update|delete)\(/);
    expect(lane).not.toContain("admin_admit_registry_track_provider_link_v1");
    expect(STUDIO_PAGE).toContain('invokeStudio("studio_registry_discovery")');
    expect(STUDIO_PAGE).toContain("registryDiscovery?.preview===preview");
    expect(STUDIO_PAGE).toContain("x.receipt_id===row.receipt_id");
    expect(STUDIO_PAGE).toContain("setRegistryMatches(candidate?[candidate]:[]);setRegistrySearchAttempted(false);setSelectedTrack(null)");
    expect(STUDIO_PAGE).toContain("setBatchMode(true);setBatchRows([]);setReviewGroupRows(selectable)");
  });
});


describe("Charts Studio recording-review draft and scroll safety",()=>{
  it("retains only preparation state in an exact current-snapshot draft and requires fresh approval",()=>{
    const save=STUDIO_PAGE.slice(STUDIO_PAGE.indexOf("const closeRecordingReview="),STUDIO_PAGE.indexOf("const openSingleReview="));
    expect(save).toContain("context.preview===preview");
    expect(save).toContain("selectedTrack,batchRows,evidenceUrl,reviewNote");
    expect(save).not.toMatch(/setSavedReviewDraft\(\{[^}]*reviewConsent/);
    const restore=STUDIO_PAGE.slice(STUDIO_PAGE.indexOf("const restoreReviewDraft="),STUDIO_PAGE.indexOf("const resumeMatchingDraft="));
    for(const field of ["batchRows","selectedTrack","registryMatches","registryQuery","evidenceUrl","reviewNote"])expect(restore).toContain("draft."+field);
    expect(restore).toContain("draft.context.preview!==preview||!canDiscoverRegistry");
    expect(restore).toContain("setReviewConsent(false)");
    expect(STUDIO_PAGE).toContain("savedReviewDraft.context.key===context.key");
    expect(STUDIO_PAGE).toContain("source.original_sha256,row.rank,row.title,row.artist,row.provider_track_id");
    expect(STUDIO_PAGE).toContain("Resume Review");
    expect(STUDIO_PAGE).toContain("Discard Draft");
  });
  it("clears approval when source, recording or evidence changes and drops drafts on reviewed writes",()=>{
    expect(STUDIO_PAGE).toContain("setSelectedTrack(track);setReviewConsent(false)");
    expect(STUDIO_PAGE).toContain("setEvidenceUrl(e.target.value);setReviewConsent(false)");
    expect(STUDIO_PAGE).toContain("setReviewNote(e.target.value);setReviewConsent(false)");
    expect(STUDIO_PAGE).toContain("setReviewConsent(false);\n                        setBatchRows");
    expect(STUDIO_PAGE.match(/setSavedReviewDraft\(null\);activeReviewContext.current=null/g)?.length).toBe(3);
  });
  it("composes the recording review in the existing page without a modal or nested scroller",()=>{
    const start=STUDIO_PAGE.indexOf('{selected&&<WkSurface role="region" aria-labelledby="studio-recording-review-title"');
    expect(start).toBeGreaterThan(0);
    const review=STUDIO_PAGE.slice(start,STUDIO_PAGE.indexOf("</WkSurface>}",start)+13);
    expect(review).toContain("Review This Recording");
    expect(review).toContain("onClick={closeRecordingReview}");
    expect(review).toContain("WkSearchField");
    expect(review).toContain("WkCheckbox");
    expect(review).toContain("WkButton");
    expect(review).toContain("resize-none");
    expect(review).not.toMatch(/<Modal|<Sheet|overflow-y-auto|100dvh|type="url"/);
    expect(STUDIO_PAGE).toContain("recordingReviewHeading.current?.focus()");
    expect(STUDIO_PAGE).toContain("recordingQueueHeading.current?.focus()");
    expect(STUDIO_PAGE).toContain("disabled={loading||!!busy||!!selected}");
    expect(STUDIO_PAGE).toContain("disabled={!!selected||!!busy}");
  });
});


describe("Chart-origin Artist Intake presentation", () => {
  it("inherits WAKILISHA theme and keeps review actions near the identity", () => {
    for (const forbidden of ["bg-[#", "text-[#", "border-[#", "ring-[#", "bg-white", "text-white"]) {
      expect(CHART_ARTIST_INTAKE_PAGE).not.toContain(forbidden);
    }
    for (const primitive of ["WkSurface", "WkButton", "WkCheckbox", "WkSearchField", "AdminStatusBadge"]) {
      expect(CHART_ARTIST_INTAKE_PAGE).toContain("<" + primitive);
    }
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('data-wk-artist-intake-actions className="flex flex-wrap items-start gap-2"');
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('onClick={() => handleDecision(record.id, "accepted")}');
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('onClick={handleApplyAll}');
    expect(CHART_ARTIST_INTAKE_PAGE).toContain('<ChartReviewReturnContext />');
  });
});


describe("Registry Artists shared theme convergence", () => {
  it("uses semantic palette across the list, filters, cards and embedded enrichment panels", () => {
    const page = readFileSync("src/pages/admin/registry/artists/page.tsx", "utf8");
    const panels = readFileSync("src/components/admin/registry/ArtistEnrichmentGovernancePanels.tsx", "utf8");
    for (const source of [page, panels]) {
      for (const forbidden of ["bg-[#", "text-[#", "border-[#", "ring-[#", "bg-white", "text-white", "bg-black", "bg-red-", "bg-amber-", "text-red-", "text-amber-"]) {
        expect(source).not.toContain(forbidden);
      }
      expect(source).toContain("bg-wk-surface");
      expect(source).toContain("text-wk-text");
    }
    for (const marker of ["data-wk-registry-artists", "data-wk-registry-artist-card", "data-wk-registry-artist-filters"]) expect(page).toContain(marker);
    expect(page).toContain('data-wk-registry-artists className="min-w-0 bg-wk-bg');
    expect(page).toContain("saveRegistryEntityPatch(");
    expect(page).toContain('{ status: "active" }');
    const quality = readFileSync("src/services/registry/admin/completeness.ts", "utf8");
    for (const tone of ["success", "warning", "danger"]) expect(quality).toContain("bg-wk-" + tone + "-soft text-wk-" + tone);
  });
});


describe("Shared Registry editor field authority", () => {
  it("uses exact persisted classification values and existing country catalogue", () => {
    const artist = getEntitySchema("artist");
    const find = (key: string) => artist.editableFields.find(field => field.key === key)!;
    expect(find("artist_type").options).toEqual(["solo", "group", "collective", "band", "duo", "unknown"]);
    expect(find("gender").options).toEqual(["female", "male", "mixed", "nonbinary", "unknown", "not_applicable"]);
    for (const [key, valid, invalid] of [["artist_type", "solo", "Solo"], ["gender", "nonbinary", "non_binary"], ["origin_iso2", "NG", "QQ"]]) {
      const field = find(key);
      expect(field.type).toBe("select");
      expect(field.allowUnset).toBe(true);
      expect(validateField(valid, field)).toBeNull();
      expect(validateField(invalid, field)).not.toBeNull();
      expect(normalizeForSave("", field)).toBeNull();
    }
    expect(find("origin_iso2").searchable).toBe(true);
    expect(find("origin_iso2").optionLabels?.NG).toBe("Nigeria (NG)");
    expect(getEntitySchema("label").editableFields.find(field => field.key === "country_code")?.options).toEqual(find("origin_iso2").options);
    expect(getEntitySchema("release").editableFields.find(field => field.key === "release_type")?.options).toEqual(["single", "ep", "album", "mixtape", "compilation", "video", "live", "unknown"]);
    const number = getEntitySchema("track").editableFields.find(field => field.key === "duration_ms")!;
    expect(normalizeForSave("", number)).toBeNull();
    expect(normalizeForSave("0", number)).toBe(0);
  });
  it("composes shared fields instead of bypassing primitives or injecting fixed colours", () => {
    const source = readFileSync("src/components/admin/registry/RegistryEntityEditorDrawer.tsx", "utf8");
    const choice = readFileSync("src/components/admin/registry/RegistryChoiceField.tsx", "utf8");
    const detail = readFileSync("src/pages/admin/registry/artists/detail/page.tsx", "utf8");
    for (const forbidden of ["bg-[#", "text-[#", "border-[#", "divide-[#", "bg-white", "text-white", "<input", "<textarea", "<select", "resize-y"]) expect(source).not.toContain(forbidden);
    for (const component of ["WkTextField", "RegistryChoiceField", "WkNumberField", "WkDatePicker", "WakilishaToggle", "WkButton"]) expect(source).toContain("<" + component);
    expect(choice).toContain("<SearchableSelect");
    expect(choice).toContain("<WkSelect");
    expect(choice).toContain('next === UNSET ? "" : next');
    expect(detail.match(/<RegistryChoiceField/g)).toHaveLength(3);
    expect(detail).not.toContain('value="non_binary"');
  });
});


it("keeps the Registry list and next Track Intake route on owned field and theme authority", () => {
  for (const path of ["artists", "tracks", "releases", "labels", "genres", "tracks/intake"]) {
    const source = readFileSync("src/pages/admin/registry/" + path + "/page.tsx", "utf8");
    for (const forbidden of ["bg-[#", "text-[#", "border-[#", "bg-white", "text-white", "<input", "<textarea", "<select", "resize-y"]) expect(source).not.toContain(forbidden);
    expect(source).toContain("<WkSearchField");
    expect(source).toContain("<WkSelect");
  }
  expect(TRACK_INTAKE_PAGE).toContain("<WkTextField multiline");
  expect(TRACK_INTAKE_PAGE).toContain("searchRegistryArtists(");
});

describe("Shared exact private original byte authority",()=>{
 it("accepts only the exact bounded archived bytes; does not infer provider authorization",async()=>{
  const bytes=new TextEncoder().encode("fixture original");
  const sha=createHash("sha256").update(bytes).digest("hex");
  const receipt={original_bucket:"charts2-evidence-private-v1",
   original_object_key:"shazam_ke/"+sha.slice(0,2)+"/"+sha+".csv",
   original_sha256:sha,original_byte_length:bytes.length};
  await expect(verifyCharts2OriginalBytesV1(receipt,bytes)).resolves.toBe(true);
  await expect(verifyCharts2OriginalBytesV1(receipt,bytes.slice(1))).rejects.toThrow("bytes_mismatch");
  const wrong=bytes.slice();wrong[0]^=1;
  await expect(verifyCharts2OriginalBytesV1(receipt,wrong)).rejects.toThrow("bytes_mismatch");
  await expect(verifyCharts2OriginalBytesV1({...receipt,original_bucket:"public"},bytes)).rejects.toThrow("receipt_invalid");
 });
});

describe("Shared Registry-first catalogue transport",()=>{
  const trackId=UUID(501),otherId=UUID(502),artistId=UUID(800);
  const catalogue=Array.from({length:502},(_,i)=>({
    id:UUID(i+1),title:i>=500?"Home Bound":"Unrelated "+i,status:"active",
    isrc:null,slug:"track-"+i,duration_ms:null,release_id:null,
  }));
  const unresolved=[{source_key:"youtube_ke",receipt_id:UUID(900),rank:1,
    original_sha256:"a".repeat(64),title:"Home-bound",artist:"Alias A",provider_track_id:"video:one"}];
  function client(options:{duplicatePage?:boolean;missingDetail?:boolean;unavailable?:boolean;aliasOverflow?:boolean}={}){
    const calls:Array<{table:string;fields:string;cursor:string|null;limit:number|null}>= [];
    const server={from:(table:string)=>{
      let fields="",cursor:string|null=null,limit:number|null=null,ids:string[]|null=null;
      const q={
        select:(v:string)=>{fields=v;return q;},
        eq:()=>q,order:()=>q,
        gt:(_field:string,v:string)=>{cursor=v;return q;},
        limit:(v:number)=>{limit=v;return q;},
        in:(_field:string,v:string[])=>{ids=v;return q;},
        then(resolve:(v:unknown)=>unknown){
          calls.push({table,fields,cursor,limit});
          let data:unknown[]=[];
          if(options.unavailable)return Promise.resolve({data:null,error:{message:"offline"}}).then(resolve);
          if(table==="registry_tracks"&&fields==="id,title"){
            data=catalogue.filter(t=>!cursor||options.duplicatePage||t.id>cursor).slice(0,limit??500);
          }else if(table==="registry_tracks"){
            data=catalogue.filter(t=>ids?.includes(t.id)&&!(options.missingDetail&&t.id===otherId));
          }else if(table==="registry_track_artists"){
            data=[{track_id:trackId,artist_id:artistId,artist_name_text:"Artist A",is_primary:true}];
          }else if(table==="registry_track_provider_links"){
            data=[{track_id:trackId,provider_key:"youtube",match_method:"manual"}];
          }else if(table==="registry_artists"){
            data=[{id:artistId,display_name:"Artist A",origin_iso2:"KE",status:"active"}];
          }else if(table==="registry_artist_aliases"){
            const alias={canonical_artist_id:artistId,alias_display_name:"Alias A",alias_slug:"alias-a"};
            data=options.aliasOverflow?Array(501).fill(alias):[alias];
          }else throw Error("unexpected table");
          return Promise.resolve({data,error:null}).then(resolve);
        }
      };
      return q;
    }};
    return {server,calls};
  }
  it("scans past the first 500 tracks, keeps both same-title candidates, and reads canonical artist aliases",async()=>{
    const {server,calls}=client();
    const result=await readCharts2RegistryDiscoveryV1(server,unresolved);
    expect(result).toMatchObject({candidate_only:true,can_publish:false,catalogue_scanned:502,
      unique_positions:0,ambiguous_positions:1,unmatched_positions:0});
    expect(result.groups.map(g=>g.track.id).sort()).toEqual([trackId,otherId]);
    expect(result.groups.find(g=>g.track.id===trackId)?.positions[0]).toMatchObject({
      candidate_count:2,credit_evidence:"artist_credit_agrees",receipt_id:UUID(900)});
    expect(result.groups.find(g=>g.track.id===otherId)?.positions[0].credit_evidence).toBe("artist_credit_unconfirmed");
    expect(calls.filter(c=>c.table==="registry_tracks"&&c.fields==="id,title").map(c=>c.cursor))
      .toEqual([null,UUID(500)]);
    expect(calls.some(c=>c.table==="registry_artist_aliases")).toBe(true);
  });
  it("rejects cursor repeats, missing candidate details, unavailable catalogue and truncated alias reads",async()=>{
    for(const [options,code] of [
      [{duplicatePage:true},"cursor_invalid"],[{missingDetail:true},"catalogue_changed"],
      [{unavailable:true},"catalogue_unavailable"],[{aliasOverflow:true},"alias_bound"],
    ] as const){
      await expect(readCharts2RegistryDiscoveryV1(client(options).server,unresolved)).rejects.toThrow(code);
    }
  });
});
