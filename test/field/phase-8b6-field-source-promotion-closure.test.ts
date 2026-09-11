import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260911143000_phase_8b6_field_source_promotion_closure.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-8b6-field-source-promotion-closure.sql",
  "utf8",
);
const service = readFileSync("src/services/fieldNewsroom.ts", "utf8");
const page = readFileSync("src/pages/admin/field/page.tsx", "utf8");

describe("Phase 8B.6 Field Source promotion closure", () => {
  it("adds one narrow governed bridge without creating Field-owned review or Media authority", () => {
    expect(migration).toContain("editorial.field_submission_source_promotions");
    expect(migration).toContain("'field.submission.promote.source'");
    expect(migration).toContain("public.create_source");
    expect(migration).toContain("public.submit_source_version_for_review");
    expect(migration).not.toContain("create table editorial.field_submission_reviews");
    expect(migration).not.toContain("create table editorial.field_submission_versions");
    expect(migration).not.toContain("insert into public.registry_media_assets");
    expect(migration).not.toContain("public.attach_media_usage");
  });

  it("requires exact submitted Field and later accountable Media governance authority", () => {
    expect(migration).toContain("v_field.current_revision<>p_expected_submission_revision");
    expect(migration).toContain("v_field.submission_state<>'submitted'");
    expect(migration).toContain("i.intake_state='adopted'");
    expect(migration).toContain("u.usage_role='field_original'");
    expect(migration).toContain("g.version_number>1");
    expect(migration).toContain("g.public_safety_state='internal'");
    expect(migration).toContain("'governance_version_created'");
    expect(migration).toContain("nullif(btrim(e.reason),'') is not null");
  });

  it("pins exact protected Media identity and governance into append-only promotion provenance", () => {
    for (const field of [
      "submission_revision",
      "media_intake_id",
      "media_usage_link_id",
      "media_asset_id",
      "media_asset_revision_id",
      "media_governance_version_id",
      "source_id",
      "source_version_id",
      "command_receipt_id",
      "promoted_by_user_id",
      "correlation_id",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("Field Submission Source promotion provenance is append-only.");
    expect(migration).toContain("unique (submission_resource_id, media_intake_id)");
    expect(verifier).toContain("field_submission_source_promotions_immutable");
  });

  it("does not copy protected contributor contact identity into Source metadata", () => {
    expect(migration).not.toContain("'contact_point_id'");
    expect(migration).not.toContain("'preferred_contact_channel'");
    expect(migration).not.toContain("'owner_user_id'");
    expect(migration).toContain("'source_type','video_recording'");
    expect(migration).toContain("'rights_status','needs_clearance'");
    expect(migration).toContain("'consent_status','unknown'");
    expect(migration).toContain("'reliability_note','Promoted from governed Field Submission '");
  });

  it("keeps browser authority behind safe read and command RPCs", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table editorial.field_submission_source_promotions");
    expect(migration).toContain("grant execute on function public.get_field_submission_promotion_state_v1(uuid) to authenticated");
    expect(migration).toContain("grant execute on function public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid) to authenticated");
    expect(verifier).toContain("browser role has direct provenance-table authority");
  });

  it("surfaces the bridge through the existing Field newsroom instead of creating a parallel product", () => {
    expect(service).toContain('"get_field_submission_promotion_state_v1"');
    expect(service).toContain('"promote_field_submission_to_source_v1"');
    expect(page).toContain("Governed evidence");
    expect(page).toContain("Prepare Source for review");
    expect(page).toContain("Media library");
    expect(page).toContain('navigate("/admin/media/library")');
  });
});
