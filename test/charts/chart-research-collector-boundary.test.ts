import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const collector = readFileSync(
  "supabase/functions/chart-research-collect/index.ts",
  "utf8",
);
const adapters = readFileSync(
  "supabase/functions/chart-research-collect/adapters.ts",
  "utf8",
);

describe("D11B research collector boundary", () => {
  it("remains engineering-pilot-only", () => {
    expect(collector).toContain('phase: "engineering_pilot"');
    expect(collector).toContain("qualification_collection_not_authorized");
    expect(collector).not.toContain('phase: "confirmatory_holdout"');
  });

  it("authorizes gateway-verified service-role JWTs without token-string equality", () => {
    expect(collector).toContain("verifiedJwtRole");
    expect(collector).toContain('=== "service_role"');
    expect(collector).not.toContain("token === SERVICE_KEY");
  });

  it("exposes deterministic due collection without caller-controlled time", () => {
    expect(collector).toContain('action === "collect_due"');
    expect(collector).toContain("dueD11BCollectionTargets");
    expect(collector).toContain("expiredD11BCollectionTargets");
    expect(collector).toContain("current_only_checkpoint_missed");
    expect(collector).toContain('"partial_window"');
    expect(collector).toContain("qualification_collection_not_authorized");
    expect(collector).not.toContain("body.now");
  });

  it("uses only the frozen inaugural source constitution", () => {
    expect(collector).toContain('"youtube", "audiomack", "apple"');
    expect(collector).not.toContain('"mdundo"');
    expect(collector).not.toContain('"boomplay"');
    expect(adapters).not.toContain("shazam");
    expect(adapters).not.toContain("spotify");
  });

  it("writes only research evidence tables", () => {
    expect(collector).toContain('from("chart_research_windows")');
    expect(collector).toContain('from("chart_research_source_runs")');
    expect(collector).toContain('from("chart_research_observations")');
    expect(collector).not.toContain("wk_chart_editions_v2");
    expect(collector).not.toContain("wk_chart_entries_v2");
    expect(collector).not.toContain("chart_research_model_runs");
    expect(collector).not.toContain("chart_research_rank_outputs");
  });

  it("does not create or mutate Registry entities", () => {
    expect(collector).toContain('from("registry_track_provider_links")');
    expect(collector).toContain('from("registry_tracks")');
    expect(collector).not.toMatch(/\.from\("registry_tracks"\)\s*\.insert/);
    expect(collector).not.toContain("chart_materialize_candidate_registry_v1");
    expect(collector).not.toContain("ensure_registry_chart_artist_v1");
  });

  it("preserves Apple weekly aggregation as blocked until L034", () => {
    expect(adapters).toContain(
      'weekly_aggregation_authority: "blocked_until_L034"',
    );
  });

  it("selects the exact YouTube period instead of latest-only authority", () => {
    expect(adapters).toContain("youtube_target_period_unavailable");
    expect(adapters).toContain("chart_params_id=");
    expect(adapters).toContain("weekly:");
  });
});
